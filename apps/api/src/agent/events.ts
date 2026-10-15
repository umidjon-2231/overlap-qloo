// Run events: persisted to run_events (replayable) and pushed to live SSE subscribers.
import { EventEmitter } from "node:events";
import { and, asc, eq, gt, max } from "drizzle-orm";
import type { RunEvent } from "@overlap/shared";
import { db } from "../db/client.js";
import { runEvents } from "../db/schema.js";

const bus = new EventEmitter();
bus.setMaxListeners(0);

const lastSeq = new Map<string, number>();
const queues = new Map<string, Promise<unknown>>();

/** Append an event; serialised per run so seq numbers stay ordered under parallel tool calls. */
export function emit(runId: string, type: RunEvent["type"], payload: unknown): Promise<RunEvent> {
  const prev = queues.get(runId) ?? Promise.resolve();
  const next = prev.then(async () => {
    let seq = lastSeq.get(runId);
    if (seq === undefined) {
      const [row] = await db.select({ m: max(runEvents.seq) }).from(runEvents).where(eq(runEvents.runId, runId));
      seq = row?.m ?? 0;
    }
    seq++;
    lastSeq.set(runId, seq);
    const [row] = await db
      .insert(runEvents)
      .values({ runId, seq, type, payload: payload ?? null })
      .returning({ createdAt: runEvents.createdAt });
    const event: RunEvent = { seq, type, payload, at: row!.createdAt.toISOString() };
    bus.emit(runId, event);
    return event;
  });
  queues.set(runId, next.catch(() => undefined));
  return next;
}

export function subscribe(runId: string, fn: (e: RunEvent) => void): () => void {
  bus.on(runId, fn);
  return () => bus.off(runId, fn);
}

export async function eventsAfter(runId: string, after: number): Promise<RunEvent[]> {
  const rows = await db
    .select()
    .from(runEvents)
    .where(and(eq(runEvents.runId, runId), gt(runEvents.seq, after)))
    .orderBy(asc(runEvents.seq));
  return rows.map((r) => ({
    seq: r.seq,
    type: r.type as RunEvent["type"],
    payload: r.payload,
    at: r.createdAt.toISOString(),
  }));
}
