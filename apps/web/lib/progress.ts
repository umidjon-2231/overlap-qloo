import { BRAND_CATEGORIES, isSensitiveTag, type BrandCategory, type RunEvent } from "@overlap/shared";

/* The agent is shown as a black box: per-city print state and short plain lines of what it is doing,
   derived from the run's events. Tool names, reasoning text and raw inputs never reach the screen. */

export type CityState = "queued" | "working" | "printed";

export interface LogLine {
  key: string;
  text: string;
  done: boolean;
}

/** A brand as it surfaces mid-run, before the final shortlist is checked. */
export interface FoundBrand {
  id: string;
  name: string;
  category: string;
  affinity: number;
}

/** One early finding about a city, straight from a Qloo result. */
export interface CityNote {
  key: string;
  city: string;
  kind: "rank" | "crowd" | "partners";
  text: string;
}

export interface Progress {
  cities: Record<string, CityState>;
  lines: LogLine[];
  lookups: number;
  brands: FoundBrand[];
  brandsScanned: number;
  notes: CityNote[];
  /** Cities in the order the agent first worked on each one (city-specific steps only). */
  visitOrder: string[];
  /** Shortlisted brands that rank in each city's local top list, best first. */
  cityBrands: Record<string, { name: string; rank: number }[]>;
}

interface Point {
  lat: number;
  lon: number;
}

const label = (c: string) => (c in BRAND_CATEGORIES ? BRAND_CATEGORIES[c as BrandCategory].label.toLowerCase() : c);

function listText(items: string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// Place genres every city shares; they say nothing about this crowd.
const GENERIC_PLACES = new Set(["bar", "restaurant", "coffee shop", "cafe", "tourist attraction", "american"]);

/** A short crowd line from localised taste tags: music first, then reading, then food. */
function crowdText(tags: { name: string; subtype?: string }[]): string | null {
  const pick = (kind: string) =>
    tags
      .filter((t) => t.subtype?.includes(kind))
      .map((t) => t.name.toLowerCase().replace(/\s*-\s*/g, "-"))
      .filter((n) => !GENERIC_PLACES.has(n))
      .slice(0, 3);
  const clauses = [
    pick("genre:music").length ? `Into ${listText(pick("genre:music"))}` : null,
    pick("genre:media").length ? `reads ${listText(pick("genre:media"))}` : null,
    pick("specialty_dish").length ? `orders ${listText(pick("specialty_dish"))}` : null,
    pick("genre:place").length ? `eats ${listText(pick("genre:place"))}` : null,
  ].filter((c): c is string => !!c);
  if (!clauses.length) return null;
  const text = clauses.slice(0, 2).join("; ");
  return text[0]!.toUpperCase() + text.slice(1);
}

function nearestCity(p: Point, centres: Map<string, Point>): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const [city, c] of centres) {
    const d = (c.lat - p.lat) ** 2 + (c.lon - p.lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = city;
    }
  }
  // About 50 km; anything further is not that city.
  return bestD < 0.25 ? best : undefined;
}

export function deriveProgress(events: RunEvent[], runCities: string[], status: string): Progress {
  const finished = status === "done";
  const cities: Record<string, CityState> = Object.fromEntries(runCities.map((c) => [c, finished ? "printed" : "queued"]));
  const centres = new Map<string, Point>();
  const open = new Map<string, { cities: string[]; line: LogLine }>();
  const cityDone = new Map<string, Set<string>>();
  const lines: LogLine[] = [];
  let lookups = 0;
  const brands = new Map<string, FoundBrand>();
  let brandsScanned = 0;
  const notes: CityNote[] = [];
  const visitOrder: string[] = [];
  const cityBrands: Record<string, { name: string; rank: number }[]> = {};

  const matchCity = (name: unknown) => runCities.find((c) => c.toLowerCase() === String(name ?? "").toLowerCase());
  const push = (key: string, text: string): LogLine => {
    const last = lines.at(-1);
    if (last && last.text === text) {
      last.done = false;
      return last;
    }
    const line = { key, text, done: false };
    lines.push(line);
    return line;
  };

  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    if (e.type === "tool_start") {
      const name = String(p.name);
      const input = (p.input ?? {}) as Record<string, unknown>;
      let touched: string[] = [];
      let text = "Reading Qloo's taste data";
      if (name === "resolve_artist") text = `Finding ${String(input.name ?? "the artist")}`;
      else if (name === "find_brands") {
        const cats = ((input.categories as string[] | undefined) ?? []).map(label);
        text = cats.length ? `Finding ${listText(cats)} brands fans already love` : "Finding brands fans already love";
      } else if (name === "city_fit") {
        touched = ((input.cities as string[] | undefined) ?? []).map(matchCity).filter((c): c is string => !!c);
        text = touched.length === 1 ? `Ranking brands in ${touched[0]}` : "Ranking brands city by city";
      } else if (name === "city_hotspot") {
        touched = [matchCity(input.city)].filter((c): c is string => !!c);
        text = `Mapping where fans gather in ${touched[0] ?? input.city}`;
      } else if (name === "crowd_profile") {
        touched = [matchCity(input.city)].filter((c): c is string => !!c);
        text = `Reading the crowd in ${touched[0] ?? input.city}`;
      } else if (name === "local_partners") {
        const city = nearestCity({ lat: Number(input.lat), lon: Number(input.lon) }, centres);
        touched = city ? [city] : [];
        text = city ? `Scouting local partners in ${city}` : "Scouting local partners";
      } else if (name === "shared_themes") text = "Comparing shared tastes";
      else if (name === "submit_report") text = "Checking every number against Qloo";

      for (const c of touched) if (cities[c] !== "printed") cities[c] = "working";
      if (name !== "city_fit") for (const c of touched) if (!visitOrder.includes(c)) visitOrder.push(c);
      open.set(String(p.id), { cities: touched, line: push(String(p.id), text) });
    } else if (e.type === "tool_end") {
      const id = String(p.id);
      const step = open.get(id);
      lookups += (p.callIds as unknown[] | undefined)?.length ?? 0;
      if (p.name === "city_hotspot") {
        const d = (p.data ?? {}) as { city?: string; locality?: Partial<Point> | null; hotspots?: Point[] };
        const city = matchCity(d.city);
        const centre = d.hotspots?.[0] ?? (d.locality?.lat != null ? (d.locality as Point) : undefined);
        if (city && centre) centres.set(city, centre);
      } else if (p.name === "find_brands" && Array.isArray(p.data)) {
        for (const group of p.data as { category: string; brands?: { entityId: string; name: string; affinity: number | null }[] }[]) {
          for (const b of group.brands ?? []) {
            brandsScanned++;
            const prev = brands.get(b.entityId);
            if (b.affinity != null && (!prev || b.affinity > prev.affinity))
              brands.set(b.entityId, { id: b.entityId, name: b.name, category: label(group.category), affinity: b.affinity });
          }
        }
      } else if (p.name === "city_fit" && Array.isArray(p.data)) {
        for (const c of p.data as { city: string; cells?: { name?: string; inLocalTop: boolean; localRank?: number }[] }[]) {
          const city = matchCity(c.city);
          const top = (c.cells ?? []).filter((x) => x.inLocalTop && x.name).sort((a, b) => a.localRank! - b.localRank!);
          if (city) cityBrands[city] = top.map((x) => ({ name: x.name!, rank: x.localRank! }));
          if (city && top.length)
            notes.push({
              key: `rank-${id}-${city}`,
              city,
              kind: "rank",
              text: top.slice(0, 2).map((x) => `${x.name} ranks #${x.localRank} locally`).join(", "),
            });
        }
      } else if (p.name === "crowd_profile") {
        const d = (p.data ?? {}) as { city?: string; tasteTags?: { name: string; subtype?: string }[] };
        const city = matchCity(d.city);
        const text = crowdText((d.tasteTags ?? []).filter((t) => !isSensitiveTag(t)));
        if (city && text) notes.push({ key: `crowd-${id}`, city, kind: "crowd", text });
      } else if (p.name === "local_partners") {
        const d = (p.data ?? {}) as { items?: { name: string }[] };
        const city = step?.cities[0];
        const places = (d.items ?? []).slice(0, 3).map((x) => x.name);
        if (city && places.length) notes.push({ key: `partners-${id}`, city, kind: "partners", text: `Fans gather near ${listText(places)}` });
      }
      if (step) {
        step.line.done = true;
        open.delete(id);
        for (const c of step.cities) {
          const done = cityDone.get(c) ?? new Set<string>();
          done.add(String(p.name));
          cityDone.set(c, done);
          // A city is printed once its fans are mapped and its crowd read.
          if (done.has("city_hotspot") && done.has("crowd_profile")) cities[c] = "printed";
        }
      }
    } else if (e.type === "needs_input") {
      push(`ask${e.seq}`, "Waiting for you to pick the right artist");
    }
  }

  if (finished) for (const l of lines) l.done = true;
  // Between the last lookup and the report the agent is writing; say so rather than freeze on a finished step.
  else if (
    status === "running" &&
    open.size === 0 &&
    lines.every((l) => l.done) &&
    runCities.length > 0 &&
    runCities.every((c) => cities[c] === "printed")
  )
    lines.push({ key: "writing", text: "Writing up the shortlist", done: false });
  return {
    cities,
    lines,
    lookups,
    brands: [...brands.values()].sort((a, b) => b.affinity - a.affinity),
    brandsScanned,
    notes,
    visitOrder,
    cityBrands,
  };
}
