// The agent loop: Claude plans and calls Qloo tools, pauses on ask_user, finishes with submit_report.
// The conversation is append-only and persisted every turn, so a needs_input run resumes exactly.
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, isNull, notLike, or } from "drizzle-orm";
import { z } from "zod";
import type { CreateRunInput } from "@overlap/shared";
import { db } from "../db/client.js";
import { runs } from "../db/schema.js";
import { env } from "../env.js";
import { newContext, type QlooContext } from "../qloo/client.js";
import { runTool, toAnthropicTool, toolsets, type Toolset } from "../tools/index.js";
import { addUsage, anthropic, budgetTokens, emptyUsage, fallbackParams, type Effort, type UsageTotals } from "./claude.js";
import { emit } from "./events.js";
import { kickoffMessage, systemPrompt } from "./prompts.js";
import { materializeReport, reportSchema } from "./report.js";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export interface AgentConfig {
  model: string;
  effort: Effort;
  toolset: Toolset;
}

export const defaultConfig = (): AgentConfig => ({
  model: env.AGENT_MODEL,
  effort: env.AGENT_EFFORT,
  toolset: env.AGENT_TOOLSET,
});

interface AgentState {
  messages: MessageParam[];
  usage: UsageTotals;
  agentToolCalls: number;
  qloo: QlooContext["stats"];
  startedAt: number;
  firstToolMs?: number;
  /** ask_user waiting for the seller, plus results of sibling tool calls from the same turn. */
  pendingAsk?: { toolUseId: string; siblingResults: ToolResult[] };
  nudged?: boolean;
  jsonRetries?: number;
  toolStatusCounts: Record<string, number>;
  validationErrors: number;
}

const askUserSchema = z.object({
  question: z.string(),
  candidates: z
    .array(z.object({ entity_id: z.string(), name: z.string(), description: z.string().optional() }))
    .min(1)
    .max(6),
});

const ASK_USER: Anthropic.Beta.BetaTool = {
  name: "ask_user",
  description:
    "Ask the seller to choose between candidate entities (e.g. an ambiguous artist name). The run pauses until they answer; " +
    "the answer comes back as this tool's result.",
  input_schema: toAnthropicTool({ name: "", description: "", input: askUserSchema, run: async () => ({ status: "ok", data: null, callIds: [] }) })
    .input_schema,
};

const SUBMIT_REPORT: Anthropic.Beta.BetaTool = {
  name: "submit_report",
  description:
    "Submit the final sponsorship analysis. Cite call IDs from tool results for every brand, city ranking, heatmap, crowd evidence and partner. " +
    "Numbers are looked up server-side from those calls, so do not restate them.",
  input_schema: toAnthropicTool({ name: "", description: "", input: reportSchema, run: async () => ({ status: "ok", data: null, callIds: [] }) })
    .input_schema,
};

function toolDefs(toolset: Toolset): Anthropic.Beta.BetaTool[] {
  return [...toolsets[toolset].map(toAnthropicTool), ASK_USER, SUBMIT_REPORT].map((t) => ({
    ...t,
    eager_input_streaming: true,
  }));
}

const toolLimit = (toolset: Toolset) => env.RUN_TOOL_CALL_LIMIT * (toolset === "raw" ? 2 : 1);

/* ---------- public API ---------- */

export async function startRun(input: CreateRunInput & { presetId?: string }, config = defaultConfig()): Promise<string> {
  const [run] = await db
    .insert(runs)
    .values({
      propertyType: input.propertyType,
      propertyName: input.propertyName,
      artists: input.artists,
      cities: input.cities,
      categories: input.categories,
      presetId: input.presetId,
      model: config.model,
      effort: config.effort,
      toolset: config.toolset,
      status: "running",
    })
    .returning({ id: runs.id });
  const runId = run!.id;

  const state: AgentState = {
    messages: [{ role: "user", content: kickoffMessage(input) }],
    usage: emptyUsage(),
    agentToolCalls: 0,
    qloo: { calls: 0, cached: 0, errors: 0 },
    startedAt: Date.now(),
    toolStatusCounts: {},
    validationErrors: 0,
  };
  await saveState(runId, state);
  await emit(runId, "status", { status: "running", config });
  void runLoop(runId).catch((e) => failRun(runId, e));
  return runId;
}

export async function resolveInput(runId: string, choice: { entityId: string; name?: string }): Promise<void> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run || run.status !== "needs_input") throw new Error("Run is not waiting for input");
  const state = run.agentState as AgentState;
  if (!state.pendingAsk) throw new Error("No pending question");
  state.messages.push({
    role: "user",
    content: [
      ...state.pendingAsk.siblingResults,
      {
        type: "tool_result",
        tool_use_id: state.pendingAsk.toolUseId,
        content: `The seller selected: ${choice.name ?? "entity"} (entity_id ${choice.entityId}).`,
      },
    ],
  });
  state.pendingAsk = undefined;
  // Record the seller's pick on the artist it resolves, so the UI shows the confirmed name.
  const artists = run.artists.map((a) => ({ ...a }));
  const open = artists.filter((a) => !a.entityId);
  const target =
    open.find((a) => choice.name?.toLowerCase().includes(a.query.toLowerCase())) ?? (open.length === 1 ? open[0] : undefined);
  if (target) Object.assign(target, { entityId: choice.entityId, name: choice.name ?? target.query });
  await db.update(runs).set({ status: "running", pendingInput: null, artists, updatedAt: new Date() }).where(eq(runs.id, runId));
  await saveState(runId, state);
  await emit(runId, "status", { status: "running", resolved: choice });
  void runLoop(runId).catch((e) => failRun(runId, e));
}

/** Runs left in 'running' by a previous server process can never finish; mark them. Bake-off runs live in their own process. */
export async function markInterruptedRuns(): Promise<void> {
  await db
    .update(runs)
    .set({ status: "error", error: "Interrupted by a server restart" })
    .where(and(eq(runs.status, "running"), or(isNull(runs.presetId), notLike(runs.presetId, "bakeoff:%"))));
}

/* ---------- loop ---------- */

async function runLoop(runId: string): Promise<void> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return;
  const config: AgentConfig = {
    model: run.model ?? env.AGENT_MODEL,
    effort: (run.effort as Effort) ?? env.AGENT_EFFORT,
    toolset: (run.toolset as Toolset) ?? env.AGENT_TOOLSET,
  };
  const state = run.agentState as AgentState;
  const ctx = newContext(runId);
  ctx.stats = state.qloo;
  const tools = toolDefs(config.toolset);
  const system = systemPrompt(config.toolset);
  const limit = toolLimit(config.toolset);
  const extras = fallbackParams(config.model);

  for (let turn = 0; turn < 60; turn++) {
    if (budgetTokens(state.usage) > env.RUN_TOKEN_BUDGET * 1.25) throw new Error("Token budget exceeded");

    const stream = anthropic.beta.messages.stream({
      model: config.model,
      max_tokens: 32000,
      system: [{ type: "text", text: system }],
      tools,
      messages: state.messages,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: config.effort },
      cache_control: { type: "ephemeral" },
      ...extras,
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      state.jsonRetries = 0;
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors propagate.
      if (err instanceof Anthropic.APIError || (state.jsonRetries ?? 0) >= 2) throw err;
      state.jsonRetries = (state.jsonRetries ?? 0) + 1;
      continue;
    }
    addUsage(state.usage, config.model, message.usage);
    state.messages.push({ role: "assistant", content: message.content });

    for (const block of message.content) {
      if (block.type === "thinking" && block.thinking.trim()) await emit(runId, "agent_text", { kind: "thinking", text: block.thinking });
      if (block.type === "text" && block.text.trim()) await emit(runId, "agent_text", { kind: "text", text: block.text });
    }

    if (message.stop_reason === "refusal") throw new Error(`Model declined the request (${message.stop_details?.category ?? "unknown"})`);
    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      if (state.nudged) throw new Error("Agent stopped without submitting a report");
      state.nudged = true;
      state.messages.push({ role: "user", content: "Please call submit_report now with the evidence you have." });
      await saveState(runId, state);
      continue;
    }
    if (message.stop_reason === "max_tokens") throw new Error("Tool input truncated (max_tokens)");

    const ask = toolUses.find((t) => t.name === "ask_user");
    const submit = toolUses.find((t) => t.name === "submit_report");
    const others = toolUses.filter((t) => t !== ask && t !== submit);
    state.firstToolMs ??= Date.now() - state.startedAt;

    const wrapUp = state.agentToolCalls + others.length > limit || budgetTokens(state.usage) > env.RUN_TOKEN_BUDGET;
    const results: ToolResult[] = await Promise.all(
      others.map(async (t): Promise<ToolResult> => {
        state.agentToolCalls++;
        await emit(runId, "tool_start", { id: t.id, name: t.name, input: t.input });
        if (wrapUp) {
          await emit(runId, "tool_end", { id: t.id, name: t.name, status: "error", note: "budget" });
          return { type: "tool_result", tool_use_id: t.id, is_error: true, content: "Tool budget reached. Call submit_report now with the evidence you already have." };
        }
        const out = await runTool(t.name, t.input, ctx);
        state.toolStatusCounts[out.status] = (state.toolStatusCounts[out.status] ?? 0) + 1;
        if (out.status === "error" && out.note?.startsWith("Invalid input")) state.validationErrors++;
        await emit(runId, "tool_end", { id: t.id, name: t.name, status: out.status, callIds: out.callIds, note: out.note, data: out.data });
        return {
          type: "tool_result",
          tool_use_id: t.id,
          is_error: out.status === "error",
          content: JSON.stringify({ status: out.status, call_ids: out.callIds, note: out.note, data: out.data }),
        };
      }),
    );
    state.qloo = ctx.stats;

    if (submit) {
      const parsed = reportSchema.safeParse(submit.input);
      if (!parsed.success) {
        state.validationErrors++;
        // Show rejections in the trace; the agent gets the issues back and resubmits.
        await emit(runId, "tool_start", { id: submit.id, name: "submit_report", input: {} });
        await emit(runId, "tool_end", { id: submit.id, name: "submit_report", status: "error", note: `Report rejected: ${z.prettifyError(parsed.error)}` });
        results.push({ type: "tool_result", tool_use_id: submit.id, is_error: true, content: `Invalid report: ${parsed.error.message}` });
      } else {
        await emit(runId, "tool_start", { id: submit.id, name: "submit_report", input: { brands: parsed.data.brands.length, cities: parsed.data.cities.length } });
        const grounding = await materializeReport(runId, parsed.data);
        results.push({ type: "tool_result", tool_use_id: submit.id, content: "Report accepted." });
        state.messages.push({ role: "user", content: results });
        await finishRun(runId, state, parsed.data.summary, grounding);
        await emit(runId, "tool_end", { id: submit.id, name: "submit_report", status: "ok", grounding });
        return;
      }
    }

    if (ask) {
      const parsed = askUserSchema.safeParse(ask.input);
      if (parsed.success) {
        state.pendingAsk = { toolUseId: ask.id, siblingResults: results };
        await saveState(runId, state);
        await db.update(runs).set({ status: "needs_input", pendingInput: parsed.data, updatedAt: new Date() }).where(eq(runs.id, runId));
        await emit(runId, "needs_input", parsed.data);
        return;
      }
      results.push({ type: "tool_result", tool_use_id: ask.id, is_error: true, content: `Invalid ask_user input: ${parsed.error.message}` });
    }

    state.messages.push({ role: "user", content: results });
    await saveState(runId, state);
  }
  throw new Error("Agent exceeded the maximum number of turns");
}

/* ---------- persistence ---------- */

function usageSummary(state: AgentState) {
  return {
    ...state.usage,
    costUsd: Math.round(state.usage.costUsd * 10000) / 10000,
    agentToolCalls: state.agentToolCalls,
    qloo: state.qloo,
    toolStatusCounts: state.toolStatusCounts,
    validationErrors: state.validationErrors,
    firstToolMs: state.firstToolMs ?? null,
    elapsedMs: Date.now() - state.startedAt,
  };
}

async function saveState(runId: string, state: AgentState): Promise<void> {
  await db.update(runs).set({ agentState: state, usage: usageSummary(state), updatedAt: new Date() }).where(eq(runs.id, runId));
}

async function finishRun(runId: string, state: AgentState, summary: string, grounding: unknown): Promise<void> {
  await db
    .update(runs)
    .set({ status: "done", summary, grounding, agentState: state, usage: usageSummary(state), updatedAt: new Date() })
    .where(eq(runs.id, runId));
  await emit(runId, "result", { summary, grounding, usage: usageSummary(state) });
  await emit(runId, "status", { status: "done" });
}

async function failRun(runId: string, e: unknown): Promise<void> {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`run ${runId} failed:`, message);
  await db.update(runs).set({ status: "error", error: message, updatedAt: new Date() }).where(eq(runs.id, runId));
  await emit(runId, "error", { message });
  await emit(runId, "status", { status: "error" });
}
