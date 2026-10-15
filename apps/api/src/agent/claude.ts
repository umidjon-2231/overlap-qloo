import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";

export const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** $ per million tokens (first-party API). Haiku cache rates assumed at the usual 0.1× / 1.25× of input. */
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  requests: number;
  costUsd: number;
}

export const emptyUsage = (): UsageTotals => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  requests: 0,
  costUsd: 0,
});

export function addUsage(total: UsageTotals, model: string, u: Anthropic.Beta.BetaUsage | Anthropic.Usage): void {
  const p = PRICING[model] ?? PRICING["claude-sonnet-5-5"]!;
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  total.inputTokens += input;
  total.outputTokens += output;
  total.cacheReadTokens += read;
  total.cacheWriteTokens += write;
  total.requests += 1;
  total.costUsd += (input * p.input + output * p.output + read * p.cacheRead + write * p.cacheWrite) / 1_000_000;
}

/** Budget accounting: cached reads are cheap, so count them at 10%. */
export const budgetTokens = (u: UsageTotals) =>
  u.inputTokens + u.outputTokens + u.cacheWriteTokens + Math.round(u.cacheReadTokens * 0.1);

/** Server-side refusal fallback ("default" chain) where the model supports it. */
export function fallbackParams(model: string): { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks?: "default" } {
  return model.startsWith("claude-sonnet-5-5") || model.startsWith("claude-opus-5-5")
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }
    : { betas: [] };
}
