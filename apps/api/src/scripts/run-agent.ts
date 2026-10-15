// Run one preset through the agent and print the trace: pnpm agent <presetId> [model] [effort] [toolset]
import { runHeadless } from "../agent/headless.js";
import { defaultConfig, type AgentConfig } from "../agent/orchestrator.js";
import { sql } from "../db/client.js";
import { presets } from "../presets.js";

const [presetId, model, effort, toolset] = process.argv.slice(2);
const preset = presets.find((p) => p.id === presetId);
if (!preset) {
  console.log("usage: pnpm agent <presetId> [model] [effort] [toolset]\npresets:", presets.map((p) => p.id).join(", "));
  process.exit(1);
}
const config: AgentConfig = {
  ...defaultConfig(),
  ...(model ? { model } : {}),
  ...(effort ? { effort: effort as AgentConfig["effort"] } : {}),
  ...(toolset ? { toolset: toolset as AgentConfig["toolset"] } : {}),
};
console.log("config:", config);

const short = (v: unknown, n = 160) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

const run = await runHeadless(preset, config, {
  autoResolve: true,
  onEvent: (e) => {
    const p = e.payload as Record<string, unknown>;
    if (e.type === "tool_start") console.log(`→ ${p.name} ${short(p.input)}`);
    else if (e.type === "tool_end") console.log(`  ← ${p.name} ${p.status} calls=${short(p.callIds ?? "")}${p.note ? ` note=${short(p.note)}` : ""}`);
    else if (e.type === "agent_text") console.log(`  [${p.kind}] ${short(p.text, 300)}`);
    else console.log(`* ${e.type} ${short(p, 300)}`);
  },
});

console.log("\nstatus:", run.status, run.error ?? "");
console.log("summary:", run.summary);
console.log("usage:", JSON.stringify(run.usage));
console.log("grounding:", JSON.stringify(run.grounding));
await sql.end();
