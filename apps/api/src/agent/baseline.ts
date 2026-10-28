// LLM-only baseline: the same model picks sponsor brands for the same tour with no Qloo data.
// The UI sets it beside the Qloo-grounded shortlist so the difference is visible, not claimed.
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { BRAND_CATEGORIES, type BrandCategory } from "@overlap/shared";
import { db } from "../db/client.js";
import { brandMatches, runs, toolCalls } from "../db/schema.js";
import { env } from "../env.js";
import * as qloo from "../qloo/api.js";
import { newContext } from "../qloo/client.js";
import { addUsage, anthropic, emptyUsage } from "./claude.js";

const pickSchema = z.object({
  brands: z
    .array(
      z.object({
        name: z.string().min(1).describe("Brand name"),
        category: z.string().describe("One of the seller's categories"),
        why: z.string().describe("One sentence on why this brand fits the artist's fans"),
      }),
    )
    // The model sometimes names a few more than asked; its first ten are kept rather than failing.
    // Fewer than five is a broken answer (once: a single "placeholder" brand), so it is retried.
    .min(5),
});

export type LlmOnlyPick = z.infer<typeof pickSchema>["brands"][number] & {
  onShortlist: number | null;
  /** Qloo audience affinity of this brand for the same fans; null when Qloo has no exact brand match. */
  qlooAffinity?: number | null;
  qlooCallId?: number | null;
};

export interface LlmOnlyResult {
  model: string;
  createdAt: string;
  picks: LlmOnlyPick[];
  /** True once every pick was looked up in Qloo (older results predate the lookup). */
  scored?: boolean;
  /** Qloo shortlist brands (rank, name) the model did not name. */
  missed: { rank: number; name: string; affinity: number | null }[];
  usage: ReturnType<typeof emptyUsage>;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

/**
 * Looks each pick up in Qloo and scores it against the same fans, so "not on the shortlist" becomes a number.
 * Only exact brand-name matches count; anything else stays null rather than borrowing another brand's score.
 */
async function scorePicks(runId: string, artistIds: string[], picks: LlmOnlyPick[]): Promise<LlmOnlyPick[]> {
  const ctx = newContext(runId);
  const found = await Promise.all(
    picks.map(async (p) => {
      if (!artistIds.length) return null;
      const r = await qloo.search({ query: p.name, types: ["urn:entity:brand"], take: 5 }, ctx);
      const want = norm(p.name);
      // Exact name first; else a result whose name contains the pick's or vice versa ("Bose" ↔ "Bose Corporation", "Levi's" ↔ "Levi Strauss & Co.").
      const hit =
        r.data?.find((e) => norm(e.name) === want) ??
        r.data?.find((e) => {
          const n = norm(e.name);
          return n.length >= 3 && want.length >= 3 && (n.includes(want) || want.includes(n));
        });
      return hit?.entityId ?? null;
    }),
  );
  const ids = [...new Set(found.filter((id): id is string => !!id))];
  const scores = new Map<string, number | null>();
  let callId: number | null = null;
  if (ids.length) {
    const r = await qloo.brandInsights({ entities: artistIds, resultEntities: ids, take: ids.length }, ctx);
    callId = r.callId;
    for (const b of r.data?.items ?? []) scores.set(b.entityId, b.affinity);
  }
  return picks.map((p, i) => {
    const id = found[i];
    return { ...p, qlooAffinity: id ? (scores.get(id) ?? null) : null, qlooCallId: id && scores.has(id) ? callId : null };
  });
}

/**
 * The artist entity IDs the run's brand lookups used as their signal. Seller input usually holds names only
 * (the agent resolves them), so the IDs are read back from a logged brand-insights request.
 */
async function signalArtists(runId: string, artists: { entityId?: string }[]): Promise<string[]> {
  const given = artists.map((a) => a.entityId).filter((id): id is string => !!id);
  if (given.length === artists.length && given.length) return given;
  const [call] = await db
    .select({ req: toolCalls.requestRedacted })
    .from(toolCalls)
    .where(and(eq(toolCalls.runId, runId), eq(toolCalls.tool, "insights.brand")))
    .limit(1);
  const ids = (call?.req as { params?: Record<string, string> } | undefined)?.params?.["signal.interests.entities"];
  return ids ? ids.split(",").filter(Boolean) : given;
}

export async function llmOnlyBaseline(runId: string): Promise<LlmOnlyResult | null> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return null;
  const artistIds = await signalArtists(runId, run.artists as { entityId?: string }[]);
  if (run.llmOnly) {
    const cached = run.llmOnly as LlmOnlyResult;
    if (cached.scored) return cached;
    // Results saved before picks were scored get their Qloo numbers once, without asking the model again.
    const upgraded = { ...cached, picks: await scorePicks(runId, artistIds, cached.picks), scored: true };
    await db.update(runs).set({ llmOnly: upgraded }).where(eq(runs.id, runId));
    return upgraded;
  }

  const shortlist = await db.select().from(brandMatches).where(eq(brandMatches.runId, runId));
  const ranked = [...shortlist].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
  const artists = (run.artists as { query: string; name?: string }[]).map((a) => a.name ?? a.query);
  const categories = (run.categories as BrandCategory[]).map((c) => BRAND_CATEGORIES[c]?.label ?? c);
  const model = env.AGENT_MODEL;

  const tool = {
    name: "submit_brands",
    description: "Submit the brands you would pitch.",
    input_schema: (({ $schema: _s, ...rest }) => rest)(z.toJSONSchema(pickSchema) as Record<string, unknown>) as { type: "object" },
  };
  const ask = () => anthropic.messages.create({
    model,
    max_tokens: 3000,
    system:
      "You are a sponsorship analyst at a live-music promoter. You have no audience data, only your own knowledge. " +
      "Pick the brands you would pitch first for this property, best first.",
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_brands" },
    messages: [
      {
        role: "user",
        content:
          `${run.propertyType === "festival" ? "Festival" : "Artist tour"}: ${run.propertyName}\n` +
          `Artists: ${artists.join(", ")}\nCities: ${(run.cities as string[]).join(", ")}\n` +
          `Brand categories to pitch: ${categories.join(", ")}\n\nName 10 real brands across these categories.`,
      },
    ],
  });
  const parse = (m: Awaited<ReturnType<typeof ask>>) => {
    const call = m.content.find((b) => b.type === "tool_use");
    return pickSchema.safeParse(call?.type === "tool_use" ? call.input : null);
  };
  // Up to two retries on a malformed answer; then report it.
  let message = await ask();
  let parsed = parse(message);
  for (let i = 0; i < 2 && !parsed.success; i++) {
    console.error("llm-only: malformed answer, retrying:", parsed.error.message.slice(0, 300));
    message = await ask();
    parsed = parse(message);
  }
  if (!parsed.success) throw new Error("The model did not return a usable brand list. Try again.");

  const rankOf = new Map(ranked.map((b, i) => [norm(b.brandName), i + 1]));
  const picks = await scorePicks(
    runId,
    artistIds,
    parsed.data.brands.slice(0, 10).map((p) => ({ ...p, onShortlist: rankOf.get(norm(p.name)) ?? null })),
  );
  const named = new Set(picks.map((p) => norm(p.name)));
  const missed = ranked
    .map((b, i) => ({ rank: i + 1, name: b.brandName, affinity: b.affinity }))
    .filter((b) => !named.has(norm(b.name)));

  const usage = emptyUsage();
  addUsage(usage, model, message.usage);
  const result: LlmOnlyResult = { model, createdAt: new Date().toISOString(), picks, scored: true, missed, usage };
  await db.update(runs).set({ llmOnly: result }).where(eq(runs.id, runId));
  return result;
}
