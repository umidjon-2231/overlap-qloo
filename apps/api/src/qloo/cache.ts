import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { qlooCache } from "../db/schema.js";
import { env } from "../env.js";

export function requestHash(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function cacheGet(hash: string): Promise<unknown | undefined> {
  const rows = await db
    .select({ response: qlooCache.response })
    .from(qlooCache)
    .where(and(eq(qlooCache.requestHash, hash), gt(qlooCache.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.response;
}

export async function cacheSet(hash: string, response: unknown): Promise<void> {
  const expiresAt = new Date(Date.now() + env.CACHE_TTL_HOURS * 3_600_000);
  await db
    .insert(qlooCache)
    .values({ requestHash: hash, response, expiresAt })
    .onConflictDoUpdate({ target: qlooCache.requestHash, set: { response, expiresAt } });
}
