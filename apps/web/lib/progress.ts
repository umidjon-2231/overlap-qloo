import { BRAND_CATEGORIES, type BrandCategory, type RunEvent } from "@overlap/shared";

/* The agent is shown as a black box: per-city print state and short plain lines of what it is doing,
   derived from the run's events. Tool names, reasoning text and raw inputs never reach the screen. */

export type CityState = "queued" | "working" | "printed";

export interface LogLine {
  key: string;
  text: string;
  done: boolean;
}

export interface Progress {
  cities: Record<string, CityState>;
  lines: LogLine[];
  lookups: number;
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
  return { cities, lines, lookups };
}
