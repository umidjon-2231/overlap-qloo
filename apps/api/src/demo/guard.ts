// Public-demo guard: per-IP limits, a daily and monthly model budget, a daily Qloo call cap, and
// Telegram alerts. Past a budget, live runs and new pitches pause with a friendly message; cached
// examples and finished results keep working, so a judge always has the full experience.
import type { Context } from "hono";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { demoEvents, runs, toolCalls } from "../db/schema.js";
import { env } from "../env.js";

type Kind = "run" | "pitch" | "llm_only";

/** The host proxy (Apache) appends the real client address last; earlier entries are client-supplied. */
export const clientIp = (c: Context) => c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";

const dayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/** Estimated model spend since a moment: agent runs (runs.usage) plus pitches and comparisons (demo_events). */
async function spendSince(since: Date): Promise<number> {
  const [r] = await db
    .select({ v: sql<number>`coalesce(sum((${runs.usage}->>'costUsd')::float8), 0)` })
    .from(runs)
    .where(gte(runs.createdAt, since));
  const [e] = await db
    .select({ v: sql<number>`coalesce(sum(${demoEvents.costUsd}), 0)` })
    .from(demoEvents)
    .where(gte(demoEvents.createdAt, since));
  return Number(r?.v ?? 0) + Number(e?.v ?? 0);
}

async function qlooCallsSince(since: Date): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(toolCalls)
    .where(and(gte(toolCalls.createdAt, since), eq(toolCalls.cached, false)));
  return Number(r?.n ?? 0);
}

export interface DemoStatus {
  live: boolean;
  /** Plain-language reason when live runs are paused. */
  reason?: string;
  hour: { spendUsd: number; budgetUsd: number };
  day: { spendUsd: number; budgetUsd: number; qlooCalls: number; qlooCap: number };
  month: { spendUsd: number; budgetUsd: number };
}

const paused = (when: string) =>
  `Live runs and new pitches are paused ${when}: the demo's budget is used up. The examples still work in full.`;

export async function demoStatus(): Promise<DemoStatus> {
  const [hourSpend, daySpend, monthSpend, qloo] = await Promise.all([
    spendSince(new Date(Date.now() - 3_600_000)),
    spendSince(dayStart()),
    spendSince(monthStart()),
    qlooCallsSince(dayStart()),
  ]);
  const hour = { spendUsd: hourSpend, budgetUsd: env.DEMO_HOURLY_BUDGET_USD };
  const day = { spendUsd: daySpend, budgetUsd: env.DEMO_DAILY_BUDGET_USD, qlooCalls: qloo, qlooCap: env.DEMO_DAILY_QLOO_CALLS };
  const month = { spendUsd: monthSpend, budgetUsd: env.DEMO_MONTHLY_BUDGET_USD };
  const reason =
    monthSpend >= month.budgetUsd
      ? paused("for the rest of the month")
      : daySpend >= day.budgetUsd || qloo >= day.qlooCap
        ? paused("until tomorrow (UTC)")
        : hourSpend >= hour.budgetUsd
          ? paused("for a little while (too many live runs this hour)")
          : undefined;
  return { live: !reason, reason, hour, day, month };
}

const PER_IP_HOUR: Record<Kind, () => number> = {
  run: () => env.DEMO_RUNS_PER_IP_HOUR,
  pitch: () => env.DEMO_PITCHES_PER_IP_HOUR,
  llm_only: () => env.DEMO_PITCHES_PER_IP_HOUR,
};

/**
 * Checks the budget and the caller's hourly limit for this kind of request.
 * Returns null when the request may go ahead, or the status and message to send back.
 */
export async function guard(kind: Kind, ip: string): Promise<{ status: 429 | 503; error: string } | null> {
  const status = await demoStatus();
  if (!status.live) {
    void checkAlerts(status);
    return { status: 503, error: status.reason ?? paused("for now") };
  }
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(demoEvents)
    .where(and(eq(demoEvents.kind, kind), eq(demoEvents.ip, ip), gte(demoEvents.createdAt, new Date(Date.now() - 3_600_000))));
  if (Number(r?.n ?? 0) >= PER_IP_HOUR[kind]())
    return { status: 429, error: "You've reached this demo's hourly limit. Try again in an hour; the examples still work." };
  const [d] = await db
    .select({ n: sql<number>`count(*)` })
    .from(demoEvents)
    .where(and(eq(demoEvents.ip, ip), sql`${demoEvents.kind} <> 'alert'`, gte(demoEvents.createdAt, dayStart())));
  if (Number(d?.n ?? 0) >= env.DEMO_REQUESTS_PER_IP_DAY)
    return { status: 429, error: "You've reached this demo's daily limit. The examples still work." };
  return null;
}

/**
 * Live runs and pitches must come from the demo's own pages. Not a security boundary (headers can be
 * forged), but it stops naive scripts and drive-by bots from reaching the model at all.
 */
export function fromOwnSite(c: Context): boolean {
  const origin = c.req.header("origin") ?? c.req.header("referer") ?? "";
  const allowed = env.WEB_ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, ""));
  return allowed.some((o) => origin === o || origin.startsWith(`${o}/`));
}

/** Records a guarded request (with its model cost once known) and re-checks the alert thresholds. */
export async function record(kind: Kind, ip: string, runId: string | null, costUsd = 0): Promise<void> {
  await db.insert(demoEvents).values({ kind, ip, runId, costUsd });
  if (costUsd > 0) void checkAlerts();
}

/* ---------- alerts ---------- */

export async function sendTelegram(text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    });
    // e.g. 400 "chat not found" until the owner presses Start in the bot's chat.
    if (!res.ok) console.error("telegram alert failed:", res.status, ((await res.json().catch(() => ({}))) as { description?: string }).description ?? "");
    return res.ok;
  } catch (e) {
    console.error("telegram alert failed:", (e as Error).message);
    return false;
  }
}

/** Sends each alert once per period; the key (e.g. "day-100:2026-10-29") is stored as an alert event. */
async function alertOnce(key: string, text: string): Promise<void> {
  const [seen] = await db
    .select({ id: demoEvents.id })
    .from(demoEvents)
    .where(and(eq(demoEvents.kind, "alert"), eq(demoEvents.note, key)))
    .limit(1);
  if (seen) return;
  await db.insert(demoEvents).values({ kind: "alert", note: key });
  await sendTelegram(text);
}

const usd = (n: number) => `$${n.toFixed(2)}`;
let checking = false;

/** Warns at 80% and stops at 100% of the daily and monthly budget and the daily Qloo cap. */
export async function checkAlerts(known?: DemoStatus): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const s = known ?? (await demoStatus());
    const today = dayStart().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const site = "https://overlap.u.co.uz";
    const checks: [string, number, number, string][] = [
      [`day:${today}`, s.day.spendUsd, s.day.budgetUsd, `today's model spend ${usd(s.day.spendUsd)} of ${usd(s.day.budgetUsd)}`],
      [`month:${month}`, s.month.spendUsd, s.month.budgetUsd, `this month's model spend ${usd(s.month.spendUsd)} of ${usd(s.month.budgetUsd)}`],
      [`qloo:${today}`, s.day.qlooCalls, s.day.qlooCap, `today's Qloo calls ${s.day.qlooCalls} of ${s.day.qlooCap}`],
    ];
    for (const [key, used, cap, what] of checks) {
      if (used >= cap) await alertOnce(`${key}:100`, `🛑 Overlap demo: ${what}. Live runs and new pitches are paused until the period resets; examples still work. ${site}`);
      else if (used >= cap * 0.8) await alertOnce(`${key}:80`, `⚠️ Overlap demo: ${what} (80%). ${site}`);
    }
    // A burst hitting the hourly cap is the usual sign of a bot; say so once per hour.
    if (s.hour.spendUsd >= s.hour.budgetUsd)
      await alertOnce(
        `hour:${new Date().toISOString().slice(0, 13)}`,
        `🚨 Overlap demo: ${usd(s.hour.spendUsd)} spent in the last hour (cap ${usd(s.hour.budgetUsd)}). Live runs paused for now; check for bots. ${site}`,
      );
  } catch (e) {
    console.error("budget alert check failed:", (e as Error).message);
  } finally {
    checking = false;
  }
}
