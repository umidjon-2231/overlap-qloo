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
  RUN_TOOL_CALL_LIMIT: z.coerce.number().int().default(20),
  RUN_QLOO_CALL_LIMIT: z.coerce.number().int().default(120),
  RUN_TOKEN_BUDGET: z.coerce.number().int().default(200_000),
  CACHE_TTL_HOURS: z.coerce.number().default(24),
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
