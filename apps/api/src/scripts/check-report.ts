// Re-validate the reports a run submitted against the current report schema: pnpm check-report <runId>
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, sql } from "../db/client.js";
import { runs } from "../db/schema.js";
import { reportSchema } from "../agent/report.js";

const [runId] = process.argv.slice(2);
if (!runId) {
  console.log("usage: pnpm check-report <runId>");
  process.exit(1);
}
const [run] = await db.select({ agentState: runs.agentState }).from(runs).where(eq(runs.id, runId));
const messages = (run?.agentState as { messages?: { role: string; content: unknown }[] } | null)?.messages ?? [];
const submits = messages
  .filter((m) => m.role === "assistant" && Array.isArray(m.content))
  .flatMap((m) => m.content as { type: string; name?: string; input?: unknown }[])
  .filter((b) => b.type === "tool_use" && b.name === "submit_report");

if (submits.length === 0) console.log("no submit_report calls in this run");
submits.forEach((s, i) => {
  const parsed = reportSchema.safeParse(s.input);
  console.log(`submit #${i + 1}: ${parsed.success ? "valid" : `rejected\n${z.prettifyError(parsed.error)}`}`);
});
await sql.end();
