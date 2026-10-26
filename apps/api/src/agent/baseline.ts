// LLM-only baseline: the same model picks sponsor brands for the same tour with no Qloo data.
// The UI sets it beside the Qloo-grounded shortlist so the difference is visible, not claimed.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { BRAND_CATEGORIES, type BrandCategory } from "@overlap/shared";
import { db } from "../db/client.js";
import { brandMatches, runs } from "../db/schema.js";
import { env } from "../env.js";
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
    .min(1),
});

export type LlmOnlyPick = z.infer<typeof pickSchema>["brands"][number] & { onShortlist: number | null };

export interface LlmOnlyResult {
  model: string;
  createdAt: string;
  picks: LlmOnlyPick[];
  /** Qloo shortlist brands (rank, name) the model did not name. */
  missed: { rank: number; name: string; affinity: number | null }[];
  usage: ReturnType<typeof emptyUsage>;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

export async function llmOnlyBaseline(runId: string): Promise<LlmOnlyResult | null> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return null;
  if (run.llmOnly) return run.llmOnly as LlmOnlyResult;

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
          `Brand categories to pitch: ${categories.join(", ")}\n\nName up to 10 brands across these categories.`,
      },
    ],
  });
  const parse = (m: Awaited<ReturnType<typeof ask>>) => {
    const call = m.content.find((b) => b.type === "tool_use");
    return pickSchema.safeParse(call?.type === "tool_use" ? call.input : null);
  };
  // One retry on a malformed answer; then report it.
  let message = await ask();
  let parsed = parse(message);
  if (!parsed.success) {
    console.error("llm-only: malformed answer, retrying:", parsed.error.message.slice(0, 300));
    message = await ask();
    parsed = parse(message);
  }
  if (!parsed.success) throw new Error("The model did not return a usable brand list. Try again.");

  const rankOf = new Map(ranked.map((b, i) => [norm(b.brandName), i + 1]));
  const picks = parsed.data.brands.slice(0, 10).map((p) => ({ ...p, onShortlist: rankOf.get(norm(p.name)) ?? null }));
  const named = new Set(picks.map((p) => norm(p.name)));
  const missed = ranked
    .map((b, i) => ({ rank: i + 1, name: b.brandName, affinity: b.affinity }))
    .filter((b) => !named.has(norm(b.name)));

  const usage = emptyUsage();
  addUsage(usage, model, message.usage);
  const result: LlmOnlyResult = { model, createdAt: new Date().toISOString(), picks, missed, usage };
  await db.update(runs).set({ llmOnly: result }).where(eq(runs.id, runId));
  return result;
}
