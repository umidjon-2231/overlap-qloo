import { db } from "../db/client.js";
import { toolCalls } from "../db/schema.js";
import { env } from "../env.js";
import { cacheGet, cacheSet, requestHash } from "./cache.js";
import { sleep, throttle } from "./rate-limit.js";

export type ParamValue = string | number | boolean | string[] | undefined;
export type Params = Record<string, ParamValue>;

/** Per-run accounting shared by every Qloo call the agent triggers. */
export interface QlooContext {
  runId?: string;
  /** Max network (non-cached) Qloo calls for this run. */
  callLimit: number;
  stats: { calls: number; cached: number; errors: number };
  /** Skip the cache read (results are still written). */
  noCache?: boolean;
}

export function newContext(runId?: string, callLimit = env.RUN_QLOO_CALL_LIMIT): QlooContext {
  return { runId, callLimit, stats: { calls: 0, cached: 0, errors: 0 } };
}

export interface QlooRequest<T> {
  /** Logical name for provenance, e.g. "insights.brand". */
  kind: string;
  path: string;
  params: Params;
  /** Turns the raw body into the compact shape we cache, log and hand to the agent. */
  normalize: (raw: unknown) => T;
  /** Number of results in the normalised data; 0 means "empty". */
  count: (data: T) => number;
}

export interface QlooResult<T> {
  status: "ok" | "empty" | "error";
  data: T | null;
  /** tool_calls.id, the provenance handle for every number we show. */
  callId: number;
  cached: boolean;
  error?: string;
}

// Bump when a normaliser changes so cached shapes are not reused.
const NORMALIZE_VERSION = 2;
const TIMEOUT_MS = 20_000;

function cleanParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(params).sort()) {
    const v = params[key];
    if (v === undefined || (Array.isArray(v) && v.length === 0)) continue;
    out[key] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return out;
}

async function fetchOnce(url: string): Promise<{ status: number; body: unknown; retryAfterMs?: number }> {
  await throttle();
  const res = await fetch(url, {
    headers: { "X-Api-Key": env.QLOO_API_KEY, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const retryAfter = Number(res.headers.get("retry-after"));
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { nonJson: text.slice(0, 200) };
  }
  return { status: res.status, body, retryAfterMs: retryAfter > 0 ? retryAfter * 1000 : undefined };
}

/** GET a Qloo endpoint: cache → rate limit → one bounded retry → normalise → log provenance. */
export async function qlooGet<T>(req: QlooRequest<T>, ctx: QlooContext): Promise<QlooResult<T>> {
  const params = cleanParams(req.params);
  const hash = requestHash({ v: NORMALIZE_VERSION, kind: req.kind, path: req.path, params });
  const started = Date.now();

  let data: T | null = null;
  let cached = false;
  let error: string | undefined;

  const hit = ctx.noCache ? undefined : await cacheGet(hash);
  if (hit !== undefined) {
    data = hit as T;
    cached = true;
    ctx.stats.cached++;
  } else if (ctx.stats.calls >= ctx.callLimit) {
    error = `Qloo call budget exhausted (${ctx.callLimit} calls)`;
  } else {
    ctx.stats.calls++;
    const url = `${env.QLOO_API_URL.replace(/\/$/, "")}${req.path}?${new URLSearchParams(params)}`;
    try {
      let res = await fetchOnce(url);
      if (res.status === 429 || res.status >= 500) {
        await sleep(res.retryAfterMs ?? 1000);
        res = await fetchOnce(url);
      }
      if (res.status >= 200 && res.status < 300) {
        data = req.normalize(res.body);
        await cacheSet(hash, data);
      } else {
        error = `HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const status: QlooResult<T>["status"] =
    error !== undefined ? "error" : data !== null && req.count(data) > 0 ? "ok" : "empty";
  if (status === "error") ctx.stats.errors++;

  // Requests carry only entity IDs, tags and city names; the key is a header and never stored.
  const [row] = await db
    .insert(toolCalls)
    .values({
      runId: ctx.runId,
      tool: req.kind,
      requestRedacted: { path: req.path, params },
      status,
      resultSummary: error !== undefined ? { error } : data,
      durationMs: Date.now() - started,
      cached,
    })
    .returning({ id: toolCalls.id });

  return { status, data, callId: row!.id, cached, error };
}
