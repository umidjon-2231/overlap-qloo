// Pitch pack: one Claude call over the run's stored evidence for a single brand.
// The evidence is rebuilt from logged Qloo calls (not from the agent's notes), so the
// pitch cannot inherit analyst-note mistakes and every figure has exactly one call ID.
import { and, eq, inArray } from "drizzle-orm";
import { BRAND_CATEGORIES, isSensitiveTag, type BrandCategory } from "@overlap/shared";
import { db } from "../db/client.js";
import { activations, brandMatches, cityCells, cityProfiles, pitchPacks, runs, toolCalls } from "../db/schema.js";
import { env } from "../env.js";
import { addUsage, anthropic, emptyUsage, fallbackParams } from "../agent/claude.js";
import { PITCH_SYSTEM } from "../agent/prompts.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Summary = any;

const LOCAL_DEPTH = 30;

export async function pitchEvidence(runId: string, brandId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  const [brand] = await db
    .select()
    .from(brandMatches)
    .where(and(eq(brandMatches.runId, runId), eq(brandMatches.brandEntityId, brandId)));
  if (!run || !brand) return null;
  const cells = await db
    .select()
    .from(cityCells)
    .where(and(eq(cityCells.runId, runId), eq(cityCells.brandEntityId, brandId)));
  const profiles = await db.select().from(cityProfiles).where(eq(cityProfiles.runId, runId));
  const partners = await db.select().from(activations).where(eq(activations.runId, runId));

  const ev = (brand.evidence ?? {}) as { callId: number; qloo: Record<string, any> };
  const profileEv = (p?: typeof profiles[number]) =>
    (p?.evidence ?? {}) as { localFitCallIds?: number[]; crowdCallIds?: number[] };

  // Load every call we may cite, once.
  const callIds = new Set<number>([ev.callId]);
  for (const p of profiles) for (const id of [...(profileEv(p).localFitCallIds ?? []), ...(profileEv(p).crowdCallIds ?? [])]) callIds.add(id);
  const calls = new Map(
    (await db.select().from(toolCalls).where(inArray(toolCalls.id, [...callIds]))).map((c) => [c.id, c]),
  );
  const items = (id?: number | null): Summary[] => {
    const s = id != null ? (calls.get(id)?.resultSummary as Summary) : null;
    return Array.isArray(s?.items) ? s.items : [];
  };

  // National standing: position in the category list the brand was found in.
  const national = items(ev.callId);
  const nationalIdx = national.findIndex((x) => x.entityId === brandId);
  const categoryKey = brand.category as BrandCategory | "any" | null;
  const categoryLabel = categoryKey && categoryKey in BRAND_CATEGORIES ? BRAND_CATEGORIES[categoryKey as BrandCategory].label : "all brands";

  // Audience demographics are global (same for every city): take them once.
  let demographics: { age: Record<string, number>; gender: Record<string, number>; callId: number } | null = null;

  const cities = run.cities.map((city) => {
    const prof = profiles.find((p) => p.city === city);
    const pe = profileEv(prof);
    const cell = cells.find((c) => c.city === city);

    // Exact call for the local rank (stored on the cell; derived for older runs).
    let rankCallId = cell?.callId ?? null;
    if (cell?.rankInCity != null && rankCallId == null) {
      rankCallId = (pe.localFitCallIds ?? []).find((id) => items(id)[cell.rankInCity! - 1]?.entityId === brandId) ?? null;
    }

    let taste: { tags: string[]; callId: number } | null = null;
    for (const id of pe.crowdCallIds ?? []) {
      const s = calls.get(id)?.resultSummary as Summary;
      if (Array.isArray(s?.items) && !taste) {
        const safe = s.items.filter((t: Summary) => !isSensitiveTag(t));
        taste = { tags: safe.slice(0, 8).map((t: Summary) => t.name), callId: id };
      }
      if (s?.age && !demographics) demographics = { age: s.age, gender: s.gender, callId: id };
    }

    const hotspot = prof?.hotspot as Summary;
    return {
      city,
      qlooResolvedCityAs: hotspot?.locality?.disambiguation ?? null,
      localRank:
        cell?.rankInCity != null
          ? { rank: cell.rankInCity, outOf: LOCAL_DEPTH, category: categoryLabel, callId: rankCallId }
          : null,
      cityTasteTags: taste,
      partnerPlaces: partners
        .filter((p) => p.city === city)
        .map((p) => {
          const q = (p.evidence as { callId: number; qloo: Summary }).qloo ?? {};
          return {
            name: p.placeName,
            kind: q.genre ?? null,
            neighborhood: q.neighborhood ?? null,
            liveMusic: q.liveMusic ?? null,
            description: q.shortDescription ?? null,
            distanceFromFanHotspotM: p.distanceM != null ? Math.round(p.distanceM) : null,
            callId: (p.evidence as { callId: number }).callId,
          };
        }),
    };
  });

  return {
    property: {
      name: run.propertyName,
      type: run.propertyType === "festival" ? "festival" : "artist tour",
      artists: run.artists.map((a) => a.name ?? a.query),
      cities: run.cities,
    },
    brand: {
      name: brand.brandName,
      category: categoryLabel,
      affinity: { value: brand.affinity, callId: ev.callId },
      nationalRank: nationalIdx >= 0 ? { rank: nationalIdx + 1, outOf: national.length, category: categoryLabel, callId: ev.callId } : null,
      description: ev.qloo?.shortDescription ?? null,
      customerSegments: ev.qloo?.customerSegments ?? [],
      targetAgeGroup: ev.qloo?.targetAgeGroup ?? [],
    },
    audience: { demographics },
    cities,
    notes: {
      localRank: `localRank = the brand's position in Qloo's top-${LOCAL_DEPTH} ${categoryLabel} ranking localised to that city. null = not in that local top ${LOCAL_DEPTH}; this is NOT evidence of weak fit (Qloo's localised ranking favours brands with local signal and often omits national leaders).`,
      comparability: "Local affinity is rescaled per city. Compare local ranks across cities, never local scores.",
    },
  };
}

export async function draftPitch(runId: string, brandId: string): Promise<{ bodyMd: string; usage: unknown } | null> {
  const evidence = await pitchEvidence(runId, brandId);
  if (!evidence) return null;
  const model = env.PITCH_MODEL;

  const message = await anthropic.beta.messages
    .stream({
      model,
      max_tokens: 16000,
      system: PITCH_SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [
        {
          role: "user",
          content: `Write the pitch pack for ${evidence.brand.name}.\n\nEvidence (JSON):\n${JSON.stringify(evidence, null, 1)}`,
        },
      ],
      ...fallbackParams(model),
    })
    .finalMessage();

  if (message.stop_reason === "refusal") throw new Error("Model declined to draft this pitch");
  const bodyMd = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const usage = emptyUsage();
  addUsage(usage, model, message.usage);

  await db
    .insert(pitchPacks)
    .values({ runId, brandEntityId: brandId, bodyMd })
    .onConflictDoUpdate({
      target: [pitchPacks.runId, pitchPacks.brandEntityId],
      set: { bodyMd, approved: false, approvedAt: null, updatedAt: new Date() },
    });
  return { bodyMd, usage };
}
