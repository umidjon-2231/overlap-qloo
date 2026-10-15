// Coverage check for the demo presets: artist resolution, heatmap cells per city,
// brands per category and how many top brands keep a local signal in each city.
// Usage: pnpm probe [presetId]
import { sql } from "../db/client.js";
import { presets } from "../presets.js";
import { newContext } from "../qloo/client.js";
import { cityFit, cityHotspot, findBrands, resolveArtist } from "../tools/business.js";

const only = process.argv[2];
const ctx = newContext(undefined, 200);

for (const p of presets.filter((p) => !only || p.id === only)) {
  console.log(`\n=== ${p.id}: ${p.propertyName}`);

  const artistIds: string[] = [];
  for (const a of p.artists) {
    const r = await resolveArtist.run({ name: a.query }, ctx);
    const d = r.data as { artist?: { entityId: string; name: string }; candidates?: { name: string }[] };
    console.log(`  artist "${a.query}": ${r.status}${d.artist ? ` → ${d.artist.name} ${d.artist.entityId}` : ""}`);
    if (d.artist) artistIds.push(d.artist.entityId);
  }
  if (artistIds.length === 0) continue;

  const brands = await findBrands.run({ artist_ids: artistIds, categories: p.categories, take_per_category: 5 }, ctx);
  const byCat = brands.data as { category: string; status: string; brands: { entityId: string; name: string; affinity: number }[] }[];
  for (const c of byCat) {
    console.log(`  brands/${c.category}: ${c.status} ${c.brands.map((b) => `${b.name} ${b.affinity}`).join(", ")}`);
  }
  const top = byCat.flatMap((c) => c.brands.slice(0, 2)).map((b) => b.entityId);

  const fit = await cityFit.run(
    { artist_ids: artistIds, brand_ids: top, categories: p.categories, cities: p.cities },
    ctx,
  );
  const fitData = fit.data as {
    city: string;
    status: string;
    locality: { disambiguation?: string } | null;
    cells: { coverage: string; name: string | null; localRank: number | null }[];
    localStandouts: { category: string; brands: { name: string }[] }[];
  }[];

  for (const city of p.cities) {
    const hs = await cityHotspot.run({ artist_ids: artistIds, city }, ctx);
    const h = hs.data as { cellCount?: number; coverage: string; devotedPockets?: unknown[] };
    const f = fitData.find((x) => x.city === city)!;
    const local = f.cells.filter((c) => c.coverage !== "none").length;
    console.log(
      `  ${city.padEnd(12)} heatmap ${String(h.cellCount ?? 0).padStart(5)} cells (${h.coverage}), ` +
        `${h.devotedPockets?.length ?? 0} devoted pockets | city_fit ${local}/${top.length} brands local | ` +
        `resolved: ${f.locality?.disambiguation?.slice(0, 40) ?? "?"}`,
    );
    const ranks = f.cells.filter((c) => c.name).map((c) => `${c.name}#${c.localRank}`);
    const standouts = f.localStandouts.map((s) => `${s.category}: ${s.brands.map((b) => b.name).join("/")}`);
    console.log(`      local: ${ranks.join(", ") || "—"}\n      standouts: ${standouts.join(" | ")}`);
  }
}

console.log("\nQloo stats:", ctx.stats);
await sql.end();
