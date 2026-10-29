import { z } from "zod";

const schema = z.object({
  QLOO_API_KEY: z.string().min(1),
  QLOO_API_URL: z.string().url().default("https://hackathon.api.qloo.com"),
  // Accept either name; the Anthropic SDK default is ANTHROPIC_API_KEY.
  CLAUDE_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().default(8787),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  // Defaults chosen by the bake-off (`pnpm bakeoff`): Haiku 5.5 at high effort with business tools
  // matched Sonnet's groundedness and completeness at ~1/15 of the cost.
  AGENT_MODEL: z.string().default("claude-haiku-5-5"),
  AGENT_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("high"),
  AGENT_TOOLSET: z.enum(["business", "raw"]).default("business"),
  /** The pitch pack is the deliverable sellers read; drafted on demand. */
  PITCH_MODEL: z.string().default("claude-sonnet-5-5"),
  /** Agent tool calls per run with the business toolset (raw toolset gets twice this). */
  RUN_TOOL_CALL_LIMIT: z.coerce.number().int().default(30),
  RUN_QLOO_CALL_LIMIT: z.coerce.number().int().default(120),
  /** Input + output tokens per run (cached reads count at 10%). */
  RUN_TOKEN_BUDGET: z.coerce.number().int().default(600_000),
  CACHE_TTL_HOURS: z.coerce.number().default(24),
  /** How long a preset's last successful run is served by "Open" before a new live run is needed. */
  PRESET_CACHE_HOURS: z.coerce.number().default(24),
  /** Public-demo guard: model spend per UTC day / month; past either, live runs and new pitches pause (examples still work). */
  DEMO_DAILY_BUDGET_USD: z.coerce.number().default(10),
  DEMO_MONTHLY_BUDGET_USD: z.coerce.number().default(30),
  /** Spend in any rolling hour, so a burst (e.g. bots on many IPs) cannot drain the whole day at once. */
  DEMO_HOURLY_BUDGET_USD: z.coerce.number().default(3),
  /** Guarded requests (runs + pitches + comparisons) per IP per UTC day. */
  DEMO_REQUESTS_PER_IP_DAY: z.coerce.number().int().default(30),
  /** Network (uncached) Qloo calls per UTC day, to protect the monthly quota. */
  DEMO_DAILY_QLOO_CALLS: z.coerce.number().int().default(1500),
  DEMO_RUNS_PER_IP_HOUR: z.coerce.number().int().default(8),
  DEMO_PITCHES_PER_IP_HOUR: z.coerce.number().int().default(10),
  /** Let API clients pick the agent model/effort/toolset (local experiments only; off for the public demo). */
  ALLOW_RUN_CONFIG: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Budget alerts; both optional. */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Print only the names of missing/invalid vars, never values.
  const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Invalid environment: ${names}`);
}

export const env = {
  ...parsed.data,
  anthropicApiKey: parsed.data.CLAUDE_API_KEY ?? parsed.data.ANTHROPIC_API_KEY,
};
