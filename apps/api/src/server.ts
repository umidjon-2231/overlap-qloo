import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { markInterruptedRuns } from "./agent/orchestrator.js";
import { sql } from "./db/client.js";
import { env } from "./env.js";
import { api } from "./routes.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: env.WEB_ORIGIN.split(",").map((o) => o.trim()) }));

app.get("/health", async (c) => {
  try {
    await sql`select 1`;
    return c.json({ ok: true, db: "up", anthropicKey: Boolean(env.anthropicApiKey) });
  } catch {
    return c.json({ ok: false, db: "down" }, 503);
  }
});

app.route("/", api);

await markInterruptedRuns();

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
