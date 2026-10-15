// Spaces request starts so we stay under Qloo's 5 req/s limit (per process).
const MIN_INTERVAL_MS = 220;

let nextSlot = 0;

export async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
