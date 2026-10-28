// Business-level tools: each runs one or more Qloo calls and returns a compact, evidence-carrying result.
import { z } from "zod";
import {
  BRAND_CATEGORIES,
  isSensitiveTag,
  PLACE_KINDS,
  type BrandCategory,
  type Coverage,
  type PlaceKind,
  type QlooStatus,
} from "@overlap/shared";
import * as qloo from "../qloo/api.js";
import { combineStatus, defineTool, type ToolDef } from "./types.js";

const entityIds = z.array(z.string().min(1)).min(1).max(5);
const categoryKeys = Object.keys(BRAND_CATEGORIES) as [BrandCategory, ...BrandCategory[]];
const placeKinds = Object.keys(PLACE_KINDS) as [PlaceKind, ...PlaceKind[]];

/** Heuristic coverage from heatmap cell count (labelled as such in the UI). */
const STRONG_CELL_COUNT = 500;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const resolveArtist = defineTool({
  name: "resolve_artist",
  description:
    "Resolve an artist name to a Qloo artist entity. Returns status 'ok' with one artist when there is a single exact match, " +
    "or 'needs_input' with candidates when the name is ambiguous or inexact. Never pick a candidate yourself on 'needs_input'.",
  input: z.object({ name: z.string().min(1).describe("Artist name as the seller typed it") }),
  async run({ name }, ctx) {
    const r = await qloo.search({ query: name, types: ["urn:entity:artist"], take: 8 }, ctx);
    if (r.status !== "ok") return { status: r.status, data: { candidates: [] }, callIds: [r.callId] };
    const results = r.data!;
    const exact = results.filter((e) => sameName(e.name, name));
    if (exact.length === 1) return { status: "ok", data: { artist: exact[0] }, callIds: [r.callId] };
    return {
      status: "needs_input",
      data: { candidates: (exact.length > 1 ? exact : results).slice(0, 5) },
      callIds: [r.callId],
      note: exact.length > 1 ? "Several artists share this exact name." : "No exact name match.",
    };
  },
});

export const findBrands = defineTool({
  name: "find_brands",
  description:
    "Find brands whose audience has the highest affinity with the artist(s)' fans, one query per brand category. " +
    "affinity (0–1) is Qloo's audience affinity and is the basis of the overlap score. Use category 'any' for an unfiltered list.",
  input: z.object({
    artist_ids: entityIds.describe("Qloo artist entity IDs (several for a festival)"),
    categories: z.array(z.enum([...categoryKeys, "any"])).min(1).max(6),
    take_per_category: z.number().int().min(3).max(15).default(8),
  }),
  async run({ artist_ids, categories, take_per_category }, ctx) {
    const results = await Promise.all(
      categories.map((c) =>
        qloo.brandInsights(
          {
            entities: artist_ids,
            tags: c === "any" ? undefined : [BRAND_CATEGORIES[c].tag],
            take: take_per_category,
          },
          ctx,
        ),
      ),
    );
    return {
      status: combineStatus(results.map((r) => r.status)),
      data: categories.map((c, i) => ({
        category: c,
        status: results[i]!.status,
        callId: results[i]!.callId,
        brands: results[i]!.data?.items ?? [],
      })),
      callIds: results.map((r) => r.callId),
    };
  },
});

/** How deep we look in each city's localised category ranking. */
const LOCAL_DEPTH = 30;

export const cityFit = defineTool({
  name: "city_fit",
  description:
    `For each city and brand category, fetch Qloo's localised brand ranking (artist signal + signal.location, top ${LOCAL_DEPTH}). ` +
    "For each shortlisted brand returns its local rank and affinity when it is in that city's local top list (extra local proof). " +
    "inLocalTop: false is NOT evidence of weak fit: localised rankings favour brands with local signal and often omit national leaders, so national affinity still applies. " +
    "Also returns 'localStandouts': brands that rank high locally but are not on the shortlist. " +
    "Check locality.disambiguation: it shows which place Qloo resolved the city name to.",
  input: z.object({
    artist_ids: entityIds,
    brand_ids: z.array(z.string()).min(1).max(20).describe("The shortlist to look up in each city"),
    categories: z.array(z.enum([...categoryKeys, "any"])).min(1).max(6),
    cities: z.array(z.string().min(1)).min(1).max(8),
  }),
  async run({ artist_ids, brand_ids, categories, cities }, ctx) {
    const jobs = cities.flatMap((city) => categories.map((category) => ({ city, category })));
    const results = await Promise.all(
      jobs.map(({ city, category }) =>
        qloo.brandInsights(
          {
            entities: artist_ids,
            tags: category === "any" ? undefined : [BRAND_CATEGORIES[category].tag],
            signalLocation: city,
            take: LOCAL_DEPTH,
          },
          ctx,
        ),
      ),
    );
    const shortlist = new Set(brand_ids);

    const data = cities.map((city) => {
      const mine = jobs.map((j, i) => ({ ...j, r: results[i]! })).filter((j) => j.city === city);
      // Best local rank per brand across this city's category lists.
      const best = new Map<string, { name: string; affinity: number | null; rank: number; category: string }>();
      for (const { category, r } of mine) {
        (r.data?.items ?? []).forEach((b, i) => {
          const prev = best.get(b.entityId);
          if (!prev || i + 1 < prev.rank) best.set(b.entityId, { name: b.name, affinity: b.affinity, rank: i + 1, category });
        });
      }
      const cells = brand_ids.map((id) => {
        const b = best.get(id);
        return b
          ? { brandId: id, name: b.name, inLocalTop: true, localRank: b.rank, localAffinity: b.affinity, category: b.category }
          : { brandId: id, inLocalTop: false, fit: "national fit applies" };
      });
      const localStandouts = mine.map(({ category, r }) => ({
        category,
        brands: (r.data?.items ?? [])
          .filter((b) => !shortlist.has(b.entityId))
          .slice(0, 3)
          .map((b) => ({ brandId: b.entityId, name: b.name, localAffinity: b.affinity })),
      }));
      const callStatus = combineStatus(mine.map((j) => j.r.status));
      const found = cells.filter((c) => c.inLocalTop).length;
      const status: QlooStatus = callStatus !== "ok" ? callStatus : found === 0 ? "empty" : found < brand_ids.length ? "thin" : "ok";
      return {
        city,
        locality: mine[0]?.r.data?.locality ?? null,
        status,
        callIds: mine.map((j) => j.r.callId),
        cells,
        localStandouts,
      };
    });
    return {
      status: combineStatus(data.map((d) => d.status)),
      data,
      callIds: results.map((r) => r.callId),
    };
  },
});

export const cityHotspot = defineTool({
  name: "city_hotspot",
  description:
    "Heatmap of where the artist(s)' fans concentrate in a city. Returns cell count (coverage proxy), top hotspots and " +
    "'devoted pockets' (high affinity, low general popularity). Affinity is rescaled within each city, so never compare it across cities.",
  input: z.object({ artist_ids: entityIds, city: z.string().min(1) }),
  async run({ artist_ids, city }, ctx) {
    const r = await qloo.heatmap({ entities: artist_ids, city }, ctx);
    const cellCount = r.data?.cellCount ?? 0;
    const coverage: Coverage = cellCount >= STRONG_CELL_COUNT ? "strong" : cellCount > 0 ? "thin" : "none";
    return {
      status: r.status === "ok" && coverage === "thin" ? "thin" : r.status,
      data: { city, coverage, coverageRule: `strong if ≥${STRONG_CELL_COUNT} heatmap cells`, ...r.data },
      callIds: [r.callId],
    };
  },
});

export const localPartners = defineTool({
  name: "local_partners",
  description:
    "Places near a point (usually a city hotspot) that the artist(s)' fans have affinity for, filtered to partner kinds " +
    "(bars, live music venues, coffee shops, ...). Returns name, distance in metres, affinity and a short description.",
  input: z.object({
    artist_ids: entityIds,
    lat: z.number(),
    lon: z.number(),
    radius_m: z.number().int().min(200).max(5000).default(1500),
    kinds: z.array(z.enum(placeKinds)).min(1).default(["bar", "cocktail_bar", "live_music_venue", "coffee_shop"]),
    take: z.number().int().min(3).max(15).default(8),
  }),
  async run({ artist_ids, lat, lon, radius_m, kinds, take }, ctx) {
    const r = await qloo.placeInsights(
      {
        entities: artist_ids,
        point: { lat, lon, radiusM: radius_m },
        tags: kinds.map((k) => PLACE_KINDS[k]),
        tagsOperator: "union",
        take,
      },
      ctx,
    );
    return { status: r.status, data: r.data, callIds: [r.callId] };
  },
});

const CROWD_TAG_TYPES = ["urn:tag:genre:music", "urn:tag:genre:media", "urn:tag:genre:place"] as const;

export const crowdProfile = defineTool({
  name: "crowd_profile",
  description:
    "Evidence for a plain-English crowd profile in one city: taste tags with affinity localised to the city, plus aggregate " +
    "age/gender skew of the artist(s)' audience (global, relative to average; never describe individuals).",
  input: z.object({ artist_ids: entityIds, city: z.string().min(1) }),
  async run({ artist_ids, city }, ctx) {
    // One query per tag family: unfiltered, place and dish tags (Bar, Hamburger) crowd out music and reading taste.
    const tagFor = (t: string) => qloo.tagInsights({ entities: artist_ids, signalLocation: city, tagTypes: [t], take: 10 }, ctx);
    const [music, media, places, demo] = await Promise.all([
      tagFor(CROWD_TAG_TYPES[0]),
      tagFor(CROWD_TAG_TYPES[1]),
      tagFor(CROWD_TAG_TYPES[2]),
      qloo.demographics({ entities: artist_ids }, ctx),
    ]);
    const tagResults = [music, media, places];
    const notCity = (t: { name: string }) => t.name.trim().toLowerCase() !== city.trim().toLowerCase();
    const clean = (r: typeof music) => (r.data?.items ?? []).filter((t) => !isSensitiveTag(t) && notCity(t));
    return {
      status: combineStatus([...tagResults.map((r) => r.status), demo.status]),
      data: {
        city,
        locality: tagResults.find((r) => r.data?.locality)?.data?.locality ?? null,
        musicTags: clean(music),
        mediaTags: clean(media),
        placeTags: clean(places),
        demographics: demo.data ?? null,
        demographicsScope: "global audience, relative to average",
      },
      callIds: [...tagResults.map((r) => r.callId), demo.callId],
    };
  },
});

export const sharedThemes = defineTool({
  name: "shared_themes",
  description:
    "Compare the taste themes of two entity groups (e.g. two festival headliners). Returns shared tags with a score and tags unique to each side. " +
    "Artist and brand tags use different vocabularies, so artist-vs-brand comparisons usually return no shared tags.",
  input: z.object({ a_ids: entityIds, b_ids: entityIds }),
  async run({ a_ids, b_ids }, ctx) {
    const r = await qloo.compare({ a: a_ids, b: b_ids }, ctx);
    return { status: r.status, data: r.data, callIds: [r.callId] };
  },
});

export const businessTools: ToolDef[] = [
  resolveArtist,
  findBrands,
  cityFit,
  cityHotspot,
  localPartners,
  crowdProfile,
  sharedThemes,
] as ToolDef[];
