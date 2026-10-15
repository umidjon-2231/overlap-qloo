// Pitch pack: one Claude call over the run's stored evidence for a single brand.
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { activations, brandMatches, cityCells, cityProfiles, pitchPacks, runs } from "../db/schema.js";
import { env } from "../env.js";
import { addUsage, anthropic, emptyUsage, fallbackParams } from "../agent/claude.js";
import { PITCH_SYSTEM } from "../agent/prompts.js";

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
  const qloo = (brand.evidence as { callId: number; qloo: Record<string, unknown> }) ?? {};

  return {
    property: {
      name: run.propertyName,
      type: run.propertyType,
      artists: run.artists.map((a) => a.name ?? a.query),
      cities: run.cities,
    },
    brand: {
      name: brand.brandName,
      category: brand.category,
      affinity: brand.affinity,
      popularity: brand.popularity,
      evidenceCallId: qloo.callId,
      industries: qloo.qloo?.industries,
      targetAgeGroup: qloo.qloo?.targetAgeGroup,
      customerSegments: qloo.qloo?.customerSegments,
      knownPartnerships: qloo.qloo?.knownPartnerships,
      description: qloo.qloo?.shortDescription,
      analystNote: brand.agentNote,
    },
    cities: run.cities.map((city) => {
      const cell = cells.find((c) => c.city === city);
      const prof = profiles.find((p) => p.city === city);
      const ev = (prof?.evidence ?? {}) as { localFitCallIds?: number[]; heatmapCallId?: number | null; crowdCallIds?: number[] };
      return {
        city,
        localRank: cell?.rankInCity ?? null,
        localAffinity: cell?.affinity ?? null,
        localSignal: cell?.coverage ?? "none",
        localRankingCallIds: ev.localFitCallIds ?? [],
        fanCoverage: prof?.coverage ?? "none",
        heatmapCells: prof?.cellCount ?? null,
        heatmapCallId: ev.heatmapCallId ?? null,
        crowdCallIds: ev.crowdCallIds ?? [],
        crowdProfile: prof?.crowdProfile ?? null,
        partners: partners
          .filter((p) => p.city === city)
          .map((p) => ({
            name: p.placeName,
            distanceM: p.distanceM,
            idea: p.idea,
            callId: (p.evidence as { callId?: number }).callId,
          })),
      };
    }),
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
      output_config: { effort: "medium" },
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
