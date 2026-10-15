// Print the evidence a pitch pack is drafted from: pnpm pitch-evidence <runId> <brand name>
import { and, eq } from "drizzle-orm";
import { db, sql } from "../db/client.js";
import { brandMatches } from "../db/schema.js";
import { pitchEvidence } from "../pitch/draft.js";

const [runId, brandName] = process.argv.slice(2);
if (!runId || !brandName) {
  console.log("usage: pnpm pitch-evidence <runId> <brand name>");
  process.exit(1);
}
const [brand] = await db
  .select()
  .from(brandMatches)
  .where(and(eq(brandMatches.runId, runId), eq(brandMatches.brandName, brandName)));
if (!brand) {
  console.log("brand not found in run");
} else {
  console.log(JSON.stringify(await pitchEvidence(runId, brand.brandEntityId), null, 1));
}
await sql.end();
