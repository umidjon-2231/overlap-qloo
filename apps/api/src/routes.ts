import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { BRAND_CATEGORIES, type BrandCategory } from "@overlap/shared";
import { eventsAfter, subscribe } from "./agent/events.js";
import { defaultConfig, resolveInput, startRun, type AgentConfig } from "./agent/orchestrator.js";
import { db } from "./db/client.js";
import { env } from "./env.js";
import { activations, brandMatches, cityCells, cityProfiles, pitchPacks, runs, toolCalls } from "./db/schema.js";
import { llmOnlyBaseline } from "./agent/baseline.js";
import { draftPitch } from "./pitch/draft.js";
import { renderPitchPdf } from "./pitch/pdf.js";
import { presets } from "./presets.js";
import { clientIp, demoStatus, fromOwnSite, guard, record } from "./demo/guard.js";

export const api = new Hono();

const categoryKeys = Object.keys(BRAND_CATEGORIES) as [BrandCategory, ...BrandCategory[]];

const createRunSchema = z.object({
  presetId: z.string().optional(),
  /** Re-run a preset live instead of loading its cached result. */
  fresh: z.boolean().optional(),
  propertyType: z.enum(["artist_tour", "festival"]),
  propertyName: z.string().trim().min(1).max(120),
  artists: z.array(z.object({ query: z.string().trim().min(1).max(100), entityId: z.string().optional() })).min(1).max(5),
  cities: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  categories: z.array(z.enum(categoryKeys)).min(1).max(6),
  config: z
    .object({
      model: z.enum(["claude-sonnet-5-5", "claude-haiku-5-5"]).optional(),
      effort: z.enum(["low", "medium", "high"]).optional(),
      toolset: z.enum(["business", "raw"]).optional(),
    })
    .optional(),
});

/* Public-demo protection: global concurrency here; budgets, per-IP limits and alerts in demo/guard.ts. */
const MAX_CONCURRENT_RUNS = 3;
const MAX_CONCURRENT_PITCHES = 2;
let pitchesInFlight = 0;
const OWN_SITE_ONLY = "Live runs start from the Overlap website.";

const PRESET_CACHE_MS = env.PRESET_CACHE_HOURS * 3_600_000;

api.get("/presets", (c) => c.json(presets));

/** Whether live runs are open right now (no spend figures; those go to the owner's Telegram). */
api.get("/demo-status", async (c) => {
  const s = await demoStatus();
  return c.json({ live: s.live, reason: s.reason ?? null });
});

api.get("/runs", async (c) => {
  const rows = await db
    .select({
      id: runs.id,
      propertyName: runs.propertyName,
      status: runs.status,
      presetId: runs.presetId,
      model: runs.model,
      createdAt: runs.createdAt,
    })
    .from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(20);
  return c.json(rows);
});

api.post("/runs", async (c) => {
  const parsed = createRunSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid input", issues: parsed.error.issues }, 400);
  const { presetId, fresh, config: overrides, ...input } = parsed.data;
  // The public demo always runs the default model; overrides are for local experiments.
  const config: AgentConfig = { ...defaultConfig(), ...(env.ALLOW_RUN_CONFIG ? overrides : {}) };

  if (presetId && !fresh) {
    const [cached] = await db
      .select({ id: runs.id })
      .from(runs)
      .where(
        and(
          eq(runs.presetId, presetId),
          eq(runs.status, "done"),
          eq(runs.model, config.model),
          gt(runs.createdAt, new Date(Date.now() - PRESET_CACHE_MS)),
        ),
      )
      .orderBy(desc(runs.createdAt))
      .limit(1);
    if (cached) return c.json({ runId: cached.id, cached: true });
  }

  if (!fromOwnSite(c)) return c.json({ error: OWN_SITE_ONLY }, 403);
  const active = await db.select({ id: runs.id }).from(runs).where(eq(runs.status, "running"));
  if (active.length >= MAX_CONCURRENT_RUNS) return c.json({ error: "Too many runs in progress. Try again in a minute." }, 429);
  const ip = clientIp(c);
  const blocked = await guard("run", ip);
  if (blocked) return c.json({ error: blocked.error }, blocked.status);

  const runId = await startRun({ ...input, presetId }, config);
  await record("run", ip, runId);
  return c.json({ runId, cached: false }, 201);
});

api.get("/runs/:id", async (c) => {
  const id = c.req.param("id");
  if (!z.uuid().safeParse(id).success) return c.json({ error: "Not found" }, 404);
  const [run] = await db.select().from(runs).where(eq(runs.id, id));
  if (!run) return c.json({ error: "Not found" }, 404);
  const { agentState: _state, ...rest } = run;
  const [brands, cells, profiles, partners, pitches] = await Promise.all([
    db.select().from(brandMatches).where(eq(brandMatches.runId, id)),
    db.select().from(cityCells).where(eq(cityCells.runId, id)),
    db.select().from(cityProfiles).where(eq(cityProfiles.runId, id)),
    db.select().from(activations).where(eq(activations.runId, id)),
    db.select().from(pitchPacks).where(eq(pitchPacks.runId, id)),
  ]);
  brands.sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
  return c.json({ run: rest, brands, cells, profiles, partners, pitches, standouts: await localStandouts(profiles, brands) });
});

/** Per city: brands that rank high in the local rankings but are not on the shortlist (from logged calls). */
async function localStandouts(
  profiles: (typeof cityProfiles.$inferSelect)[],
  brands: (typeof brandMatches.$inferSelect)[],
): Promise<Record<string, { brandId: string; name: string; localAffinity: number | null; callId: number }[]>> {
  const shortlist = new Set(brands.map((b) => b.brandEntityId));
  const callIdsByCity = new Map(
    profiles.map((p) => [p.city, ((p.evidence as { localFitCallIds?: number[] }).localFitCallIds ?? []) as number[]]),
  );
  const allIds = [...new Set([...callIdsByCity.values()].flat())];
  if (!allIds.length) return {};
  const rows = await db.select().from(toolCalls).where(inArray(toolCalls.id, allIds));
  const out: Record<string, { brandId: string; name: string; localAffinity: number | null; callId: number }[]> = {};
  for (const [city, ids] of callIdsByCity) {
    const seen = new Map<string, { brandId: string; name: string; localAffinity: number | null; callId: number }>();
    for (const row of rows.filter((r) => ids.includes(r.id))) {
      const items = ((row.resultSummary as { items?: { entityId: string; name: string; affinity: number | null }[] })?.items ?? []).slice(0, 5);
      for (const b of items) {
        if (!shortlist.has(b.entityId) && !seen.has(b.entityId)) {
          seen.set(b.entityId, { brandId: b.entityId, name: b.name, localAffinity: b.affinity, callId: row.id });
        }
      }
    }
    out[city] = [...seen.values()].sort((a, b) => (b.localAffinity ?? 0) - (a.localAffinity ?? 0)).slice(0, 5);
  }
  return out;
}

api.get("/runs/:id/stream", (c) => {
  const id = c.req.param("id");
  const after = Number(c.req.query("after") ?? 0) || 0;
  return streamSSE(c, async (stream) => {
    let last = after;
    const queue: unknown[] = [];
    let wake: (() => void) | null = null;
    const unsubscribe = subscribe(id, (e) => {
      queue.push(e);
      wake?.();
    });
    stream.onAbort(() => {
      unsubscribe();
      wake?.();
    });
    for (const e of await eventsAfter(id, after)) {
      last = e.seq;
      await stream.writeSSE({ id: String(e.seq), event: e.type, data: JSON.stringify(e) });
    }
    while (!stream.aborted) {
      const e = queue.shift() as { seq: number; type: string } | undefined;
      if (e) {
        if (e.seq <= last) continue;
        last = e.seq;
        await stream.writeSSE({ id: String(e.seq), event: e.type, data: JSON.stringify(e) });
        continue;
      }
      await Promise.race([
        new Promise<void>((r) => (wake = r)),
        stream.sleep(15_000).then(() => stream.writeSSE({ event: "ping", data: "{}" })),
      ]);
      wake = null;
    }
  });
});

api.post("/runs/:id/resolve", async (c) => {
  const body = z
    .object({ entityId: z.string().min(1), name: z.string().optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  try {
    await resolveInput(c.req.param("id"), body.data);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Cannot resolve" }, 409);
  }
});

api.post("/runs/:id/llm-only", async (c) => {
  const runId = c.req.param("id");
  try {
    // A saved comparison costs nothing to serve; only a new one asks the model.
    const [run] = await db.select({ llmOnly: runs.llmOnly }).from(runs).where(eq(runs.id, runId));
    if (!run) return c.json({ error: "Run not found" }, 404);
    const ip = clientIp(c);
    if (!run.llmOnly) {
      if (!fromOwnSite(c)) return c.json({ error: OWN_SITE_ONLY }, 403);
      const blocked = await guard("llm_only", ip);
      if (blocked) return c.json({ error: blocked.error }, blocked.status);
    }
    const out = await llmOnlyBaseline(runId);
    if (!out) return c.json({ error: "Run not found" }, 404);
    if (!run.llmOnly) await record("llm_only", ip, runId, out.usage?.costUsd ?? 0);
    return c.json(out);
  } catch (e) {
    console.error("llm-only failed:", e);
    return c.json({ error: e instanceof Error ? e.message : "LLM-only comparison failed" }, 502);
  }
});

const pitchKey = (runId: string, brandId: string) =>
  and(eq(pitchPacks.runId, runId), eq(pitchPacks.brandEntityId, brandId));

const EXAMPLE_READ_ONLY = "Example pitches are read-only. Try your own tour to write and edit pitches.";

/** True for the shared example runs, whose pitches every visitor sees. */
async function isExample(runId: string): Promise<boolean> {
  const [run] = await db.select({ presetId: runs.presetId }).from(runs).where(eq(runs.id, runId));
  return !!run?.presetId;
}

api.post("/runs/:id/pitch/:brandId", async (c) => {
  const runId = c.req.param("id");
  const brandId = c.req.param("brandId");
  // "Write it again" sends ?again=1; anything else reuses a saved draft instead of paying for a new one.
  const again = c.req.query("again") === "1";
  const [existing] = await db.select().from(pitchPacks).where(pitchKey(runId, brandId));
  if (existing && !again) return c.json({ bodyMd: existing.bodyMd, reused: true });
  if (existing && (await isExample(runId))) return c.json({ error: EXAMPLE_READ_ONLY }, 403);
  if (!fromOwnSite(c)) return c.json({ error: OWN_SITE_ONLY }, 403);
  if (pitchesInFlight >= MAX_CONCURRENT_PITCHES) return c.json({ error: "Other pitches are being written. Try again in a minute." }, 429);

  const ip = clientIp(c);
  const blocked = await guard("pitch", ip);
  if (blocked) return c.json({ error: blocked.error }, blocked.status);

  pitchesInFlight++;
  try {
    const out = await draftPitch(runId, brandId);
    if (!out) return c.json({ error: "Brand not found in this run" }, 404);
    await record("pitch", ip, runId, (out.usage as { costUsd?: number } | undefined)?.costUsd ?? 0);
    return c.json(out);
  } catch (e) {
    console.error("pitch failed:", e);
    return c.json({ error: e instanceof Error ? e.message : "Pitch failed" }, 502);
  } finally {
    pitchesInFlight--;
  }
});

api.patch("/runs/:id/pitch/:brandId", async (c) => {
  const body = z.object({ bodyMd: z.string().min(1).max(50_000) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  if (await isExample(c.req.param("id"))) return c.json({ error: EXAMPLE_READ_ONLY }, 403);
  // Any edit withdraws approval: the seller approves the exact text that gets exported.
  const [row] = await db
    .update(pitchPacks)
    .set({ bodyMd: body.data.bodyMd, approved: false, approvedAt: null, updatedAt: new Date() })
    .where(pitchKey(c.req.param("id"), c.req.param("brandId")))
    .returning();
  return row ? c.json(row) : c.json({ error: "Not found" }, 404);
});

api.post("/runs/:id/pitch/:brandId/approve", async (c) => {
  const [row] = await db
    .update(pitchPacks)
    .set({ approved: true, approvedAt: new Date() })
    .where(pitchKey(c.req.param("id"), c.req.param("brandId")))
    .returning();
  return row ? c.json(row) : c.json({ error: "Not found" }, 404);
});

api.get("/runs/:id/pitch/:brandId/pdf", async (c) => {
  const runId = c.req.param("id");
  const brandId = c.req.param("brandId");
  const [pitch] = await db.select().from(pitchPacks).where(pitchKey(runId, brandId));
  if (!pitch) return c.json({ error: "Not found" }, 404);
  if (!pitch.approved) return c.json({ error: "Approve the pitch pack before exporting" }, 403);
  const [brand] = await db
    .select({ name: brandMatches.brandName })
    .from(brandMatches)
    .where(and(eq(brandMatches.runId, runId), eq(brandMatches.brandEntityId, brandId)));
  const [run] = await db.select({ name: runs.propertyName }).from(runs).where(eq(runs.id, runId));
  const title = `${run?.name ?? "Overlap"} × ${brand?.name ?? "Brand"}`;
  const pdf = await renderPitchPdf(title, pitch.bodyMd, pitch.approvedAt);
  const filename = `${title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}.pdf`;
  return c.body(new Uint8Array(pdf), 200, {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${filename}"`,
  });
});

/** Provenance: one logged Qloo call (request has no key; only entity IDs, tags and cities). */
api.get("/calls/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Not found" }, 404);
  const [row] = await db.select().from(toolCalls).where(eq(toolCalls.id, id));
  return row ? c.json(row) : c.json({ error: "Not found" }, 404);
});

api.get("/calls", async (c) => {
  const ids = (c.req.query("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
  if (!ids.length) return c.json([]);
  return c.json(
    await db
      .select({ id: toolCalls.id, tool: toolCalls.tool, status: toolCalls.status, cached: toolCalls.cached, requestRedacted: toolCalls.requestRedacted })
      .from(toolCalls)
      .where(inArray(toolCalls.id, ids)),
  );
});
