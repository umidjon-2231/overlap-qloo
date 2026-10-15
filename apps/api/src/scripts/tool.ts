// Run one agent tool from the command line: pnpm tool <name> '<json input>'
import { sql } from "../db/client.js";
import { newContext } from "../qloo/client.js";
import { allTools, runTool } from "../tools/index.js";

const [name, json] = process.argv.slice(2);
if (!name) {
  console.log("usage: pnpm tool <name> '<json>'\ntools:", [...allTools.keys()].join(", "));
  process.exit(1);
}

const ctx = newContext();
const out = await runTool(name, JSON.parse(json ?? "{}"), ctx);
console.log(JSON.stringify(out, null, 2));
console.error("stats:", ctx.stats);
await sql.end();
