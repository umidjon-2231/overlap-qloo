// Bake-off: models × effort × toolset on the same presets.
// Metrics: groundedness (report items not found in cited calls), tool-use quality, cost and latency.
// Usage: pnpm bakeoff [quick]
import { count, eq } from "drizzle-orm";
import { runHeadless } from "../agent/headless.js";
import type { AgentConfig } from "../agent/orchestrator.js";
import { db, sql } from "../db/client.js";
import { activations, bakeoffResults, brandMatches, cityCells, cityProfiles } from "../db/schema.js";
import { presets } from "../presets.js";

const PRESETS = ["phoebe-us", "riverlight-festival"];
const MATRIX: AgentConfig[] = [
  ...(["claude-sonnet-5-5", "claude-haiku-5-5"] as const).flatMap((model) =>
    (["low", "medium", "high"] as const).map((effort) => ({ model, effort, toolset: "business" as const })),
  ),
  { model: "claude-sonnet-5-5", effort: "medium", toolset: "raw" },
  { model: "claude-haiku-5-5", effort: "high", toolset: "raw" },
];
const matrix = process.argv[2] === "quick" ? MATRIX.slice(0, 1) : MATRIX;

interface Row {
  preset: string;
  model: string;
  effort: string;
  toolset: string;
  status: string;
  costUsd: number;
  elapsedS: number;
  firstToolS: number | null;
  agentToolCalls: number;
  qlooCalls: number;
  badToolResults: number;
  validationErrors: number;
  violations: number;
  checked: number;
  brands: number;
  cities: number;
  localCells: number;
  partners: number;
  error?: string;
}

const rows: Row[] = [];

for (const presetId of PRESETS) {
  const preset = presets.find((p) => p.id === presetId)!;
  for (const config of matrix) {
    const label = `${presetId} ${config.model} ${config.effort} ${config.toolset}`;
    console.log(`\n▶ ${label}`);
    const started = Date.now();
    const run = await runHeadless({ ...preset, presetId: `bakeoff:${presetId}` }, config, { autoResolve: true });
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const u = (run.usage ?? {}) as any;
    const g = (run.grounding ?? { violations: [], checked: 0 }) as any;
    const n = async (table: typeof brandMatches | typeof cityProfiles | typeof activations) =>
      (await db.select({ c: count() }).from(table).where(eq(table.runId, run.id)))[0]!.c;
    const localCells = (await db.select().from(cityCells).where(eq(cityCells.runId, run.id))).filter(
      (c) => c.coverage !== "none",
    ).length;
    const statusCounts = (u.toolStatusCounts ?? {}) as Record<string, number>;

    const row: Row = {
      preset: presetId,
      model: config.model.replace("claude-", ""),
      effort: config.effort,
      toolset: config.toolset,
      status: run.status,
      costUsd: u.costUsd ?? 0,
      elapsedS: Math.round((Date.now() - started) / 1000),
      firstToolS: u.firstToolMs != null ? Math.round(u.firstToolMs / 100) / 10 : null,
      agentToolCalls: u.agentToolCalls ?? 0,
      qlooCalls: (u.qloo?.calls ?? 0) + (u.qloo?.cached ?? 0),
      badToolResults: (statusCounts.error ?? 0) + (statusCounts.empty ?? 0),
      validationErrors: u.validationErrors ?? 0,
      violations: g.violations?.length ?? 0,
      checked: g.checked ?? 0,
      brands: await n(brandMatches),
      cities: await n(cityProfiles),
      localCells,
      partners: await n(activations),
      error: run.error ?? undefined,
    };
    rows.push(row);
    console.log(row);
    await db.insert(bakeoffResults).values({
      preset: presetId,
      model: config.model,
      effort: config.effort,
      toolset: config.toolset,
      runId: run.id,
      metrics: row,
    });
  }
}

const cols: (keyof Row)[] = [
  "preset", "model", "effort", "toolset", "status", "costUsd", "elapsedS", "firstToolS", "agentToolCalls",
  "qlooCalls", "badToolResults", "validationErrors", "violations", "checked", "brands", "cities", "localCells", "partners",
];
console.log(`\n| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|`);
for (const r of rows) console.log(`| ${cols.map((c) => String(r[c] ?? "")).join(" | ")} |`);
await sql.end();
