// Run an agent to completion without a browser (CLI and bake-off).
import { eq } from "drizzle-orm";
import type { CreateRunInput, RunEvent } from "@overlap/shared";
import { db } from "../db/client.js";
import { runs } from "../db/schema.js";
import { subscribe } from "./events.js";
import { resolveInput, startRun, type AgentConfig } from "./orchestrator.js";

interface Options {
  /** Answer ask_user automatically: exact name match with an input artist, else the first candidate. */
  autoResolve?: boolean;
  onEvent?: (e: RunEvent) => void;
}

export async function runHeadless(
  input: CreateRunInput & { presetId?: string },
  config: AgentConfig,
  opts: Options = {},
): Promise<typeof runs.$inferSelect> {
  // startRun kicks off the loop without awaiting it; its first step is a DB read,
  // so subscribing right after startRun resolves does not miss tool events.
  const runId = await startRun(input, config);
  await new Promise<void>((resolve) => {
    const stop = subscribe(runId, (e) => {
      opts.onEvent?.(e);
      const p = e.payload as { status?: string; candidates?: { entity_id: string; name: string }[] };
      if (e.type === "status" && (p.status === "done" || p.status === "error")) {
        stop();
        resolve();
      }
      if (e.type === "needs_input") {
        if (!opts.autoResolve) {
          stop();
          return resolve();
        }
        const queries = input.artists.map((a) => a.query.toLowerCase());
        const pick = p.candidates!.find((c) => queries.includes(c.name.toLowerCase())) ?? p.candidates![0]!;
        void resolveInput(runId, { entityId: pick.entity_id, name: pick.name });
      }
    });
  });
  const [row] = await db.select().from(runs).where(eq(runs.id, runId));
  return row!;
}
