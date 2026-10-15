// submit_report: the agent's final structured answer. The agent supplies IDs, call references and
// interpretation; every number is looked up server-side from the logged Qloo results.
import { z } from "zod";
import { BRAND_CATEGORIES, type BrandCategory, type Coverage } from "@overlap/shared";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { activations, brandMatches, cityCells, cityProfiles, toolCalls } from "../db/schema.js";

const categoryKeys = Object.keys(BRAND_CATEGORIES) as [BrandCategory, ...BrandCategory[]];
const callId = z.number().int().positive();

export const reportSchema = z.object({
  summary: z.string().describe("2–4 sentence overview for the seller; your interpretation"),
  brands: z
    .array(
      z.object({
        brand_id: z.string(),
        call_id: callId.describe("Call whose result contains this brand"),
        category: z.enum([...categoryKeys, "any"]),
        source: z.enum(["seller_category", "agent_wildcard"]),
        why: z.string().describe("One or two sentences: why this brand fits, citing the evidence"),
      }),
    )
    .min(1)
    .max(12),
  cities: z.array(
    z.object({
      city: z.string(),
      local_fit_call_ids: z.array(callId).describe("Calls with this city's localised brand rankings"),
      heatmap_call_id: callId.nullable(),
      crowd_profile: z.string().describe("Plain-English crowd profile from localised taste evidence; aggregate only"),
      crowd_call_ids: z.array(callId),
      partners: z
        .array(z.object({ place_id: z.string(), call_id: callId, idea: z.string().describe("Activation idea at this place") }))
        .max(6),
    }),
  ),
});

export type Report = z.infer<typeof reportSchema>;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Summary = any;

interface Grounding {
  /** Items whose ID was not found in the cited call (or the call is not from this run). */
  violations: { kind: string; id: string; callId: number }[];
  checked: number;
}

/** Validate the report against this run's logged calls, then write the result tables. */
export async function materializeReport(runId: string, report: Report): Promise<Grounding> {
  const ids = new Set<number>([
    ...report.brands.map((b) => b.call_id),
    ...report.cities.flatMap((c) => [
      ...c.local_fit_call_ids,
      ...c.crowd_call_ids,
      ...c.partners.map((p) => p.call_id),
      ...(c.heatmap_call_id ? [c.heatmap_call_id] : []),
    ]),
  ]);
  const rows = ids.size
    ? await db.select().from(toolCalls).where(inArray(toolCalls.id, [...ids]))
    : [];
  const calls = new Map(rows.filter((r) => r.runId === runId).map((r) => [r.id, r]));
  const items = (id: number): Summary[] => {
    const s = calls.get(id)?.resultSummary as Summary;
    return Array.isArray(s?.items) ? s.items : Array.isArray(s) ? s : [];
  };

  const g: Grounding = { violations: [], checked: 0 };
  const check = (kind: string, id: string, cid: number) => {
    g.checked++;
    const found = items(cid).find((x) => x.entityId === id);
    if (!found) g.violations.push({ kind, id, callId: cid });
    return found;
  };

  // Brands
  const brands = report.brands
    .map((b) => ({ b, q: check("brand", b.brand_id, b.call_id) }))
    .filter((x) => x.q);
  const brandIds = brands.map((x) => x.b.brand_id);

  await db.delete(brandMatches).where(eq(brandMatches.runId, runId));
  await db.delete(cityCells).where(eq(cityCells.runId, runId));
  await db.delete(cityProfiles).where(eq(cityProfiles.runId, runId));
  await db.delete(activations).where(eq(activations.runId, runId));

  if (brands.length) {
    await db
      .insert(brandMatches)
      .values(
        brands.map(({ b, q }) => ({
          runId,
          brandEntityId: b.brand_id,
          brandName: q.name,
          category: b.category,
          source: b.source,
          affinity: q.affinity,
          popularity: q.popularity,
          overlapScore: q.affinity != null ? Math.round(q.affinity * 100) : null,
          evidence: { callId: b.call_id, qloo: q },
          agentNote: b.why,
        })),
      )
      .onConflictDoNothing();
  }

  for (const c of report.cities) {
    // Grid: best local rank for each shortlisted brand across the city's cited ranking calls.
    const fitCalls = c.local_fit_call_ids.filter((id) => calls.has(id));
    for (const id of c.local_fit_call_ids) if (!calls.has(id)) g.violations.push({ kind: "city_fit_call", id: c.city, callId: id });
    const cells = brandIds.map((brandId) => {
      let best: { affinity: number | null; rank: number; callId: number } | null = null;
      for (const cid of fitCalls) {
        const idx = items(cid).findIndex((x) => x.entityId === brandId);
        if (idx >= 0 && (!best || idx + 1 < best.rank)) best = { affinity: items(cid)[idx].affinity, rank: idx + 1, callId: cid };
      }
      const coverage: Coverage = best ? "strong" : "none";
      return { runId, brandEntityId: brandId, city: c.city, affinity: best?.affinity ?? null, rankInCity: best?.rank ?? null, coverage, callId: best?.callId };
    });
    if (cells.length) {
      await db
        .insert(cityCells)
        .values(cells.map(({ callId: _c, ...cell }) => cell))
        .onConflictDoNothing();
    }

    const hm = c.heatmap_call_id ? (calls.get(c.heatmap_call_id)?.resultSummary as Summary) : null;
    if (c.heatmap_call_id && !hm) g.violations.push({ kind: "heatmap_call", id: c.city, callId: c.heatmap_call_id });
    const cellCount: number = hm?.cellCount ?? 0;
    const coverage: Coverage = cellCount >= 500 ? "strong" : cellCount > 0 ? "thin" : "none";

    const partners = c.partners
      .map((p) => ({ p, q: check("place", p.place_id, p.call_id) }))
      .filter((x) => x.q);

    await db
      .insert(cityProfiles)
      .values({
        runId,
        city: c.city,
        hotspot: hm ? { locality: hm.locality, hotspots: hm.hotspots, devotedPockets: hm.devotedPockets } : null,
        cellCount: hm ? cellCount : null,
        coverage,
        crowdProfile: c.crowd_profile,
        evidence: {
          heatmapCallId: c.heatmap_call_id,
          crowdCallIds: c.crowd_call_ids,
          localFitCallIds: c.local_fit_call_ids,
          crowd: c.crowd_call_ids.map((id) => calls.get(id)?.resultSummary ?? null),
        },
      })
      .onConflictDoNothing();

    if (partners.length) {
      await db.insert(activations).values(
        partners.map(({ p, q }) => ({
          runId,
          city: c.city,
          placeEntityId: p.place_id,
          placeName: q.name,
          latitude: q.lat ?? null,
          longitude: q.lon ?? null,
          distanceM: q.distanceM ?? null,
          idea: p.idea,
          evidence: { callId: p.call_id, qloo: q },
        })),
      );
    }
  }

  return g;
}
