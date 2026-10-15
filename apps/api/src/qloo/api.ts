// Typed wrappers over the Qloo endpoints we use, each with a compact normaliser.
// Request shapes were verified against hackathon.api.qloo.com (see the probe notes in the plan):
// - localise brand results with signal.location.query (filter.location is silently ignored for brands)
// - heatmaps ignore `take`, so we trim them here before caching
import { qlooGet, type Params, type QlooContext, type QlooResult } from "./client.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

const r3 = (n: unknown) => (typeof n === "number" ? Math.round(n * 1000) / 1000 : null);
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const firstN = (v: unknown, n: number) => list<string>(v).slice(0, n);

export interface Locality {
  entityId: string;
  name: string;
  disambiguation?: string;
  lat?: number;
  lon?: number;
}

function locality(body: Raw): Locality | null {
  const loc = body?.query?.localities;
  const l = loc?.signal ?? (Array.isArray(loc?.filter) ? loc.filter[0] : loc?.filter);
  if (!l?.entity_id) return null;
  return {
    entityId: l.entity_id,
    name: l.name,
    disambiguation: l.disambiguation,
    lat: l.location?.lat,
    lon: l.location?.lon,
  };
}

/* ---------- search ---------- */

export interface EntityRef {
  entityId: string;
  name: string;
  types: string[];
  disambiguation?: string;
  popularity: number | null;
  shortDescription?: string;
}

export function search(
  q: { query: string; types?: string[]; take?: number },
  ctx: QlooContext,
): Promise<QlooResult<EntityRef[]>> {
  return qlooGet(
    {
      kind: "search",
      path: "/search",
      params: { query: q.query, types: q.types, take: q.take ?? 8 },
      normalize: (body: Raw) =>
        list<Raw>(body?.results).map((e) => ({
          entityId: e.entity_id,
          name: e.name,
          types: list<string>(e.types),
          disambiguation: e.disambiguation || undefined,
          popularity: r3(e.popularity),
          shortDescription: e.properties?.short_description || undefined,
        })),
      count: (d) => d.length,
    },
    ctx,
  );
}

/* ---------- insights ---------- */

export type InsightsType = "brand" | "place" | "artist" | "destination" | "heatmap" | "tag" | "demographics";

export interface InsightsQuery {
  type: InsightsType;
  /** signal.interests.entities */
  entities: string[];
  /** filter.tags */
  tags?: string[];
  tagsOperator?: "union" | "intersection";
  /** filter.results.entities: restrict output to these IDs */
  resultEntities?: string[];
  /** signal.location.query: localise affinity to a city (works for brands) */
  signalLocation?: string;
  /** filter.location.query: restrict results to a city (places, destinations, heatmaps) */
  filterLocation?: string;
  /** filter.location as POINT + radius in metres (places) */
  point?: { lat: number; lon: number; radiusM: number };
  /** filter.tag.types (tag insights) */
  tagTypes?: string[];
  take?: number;
}

function insightsParams(q: InsightsQuery): Params {
  const filterType =
    q.type === "heatmap" ? "urn:heatmap" : q.type === "tag" ? "urn:tag" : q.type === "demographics" ? "urn:demographics" : `urn:entity:${q.type}`;
  return {
    "filter.type": filterType,
    "signal.interests.entities": q.entities,
    "filter.tags": q.tags,
    "operator.filter.tags": q.tags && q.tags.length > 1 ? (q.tagsOperator ?? "union") : undefined,
    "filter.results.entities": q.resultEntities,
    "signal.location.query": q.signalLocation,
    "filter.location.query": q.point ? undefined : q.filterLocation,
    "filter.location": q.point ? `POINT(${q.point.lon} ${q.point.lat})` : undefined,
    "filter.location.radius": q.point?.radiusM,
    "filter.tag.types": q.tagTypes,
    take: q.type === "heatmap" ? undefined : q.take,
  };
}

/* brands */

export interface BrandResult {
  entityId: string;
  name: string;
  affinity: number | null;
  popularity: number | null;
  categories: string[];
  industries: string[];
  targetAgeGroup: string[];
  customerSegments: string[];
  knownPartnerships: string[];
  shortDescription?: string;
}

export interface Ranked<T> {
  locality: Locality | null;
  items: T[];
}

export function brandInsights(
  q: Omit<InsightsQuery, "type">,
  ctx: QlooContext,
): Promise<QlooResult<Ranked<BrandResult>>> {
  return qlooGet(
    {
      kind: "insights.brand",
      path: "/v2/insights",
      params: insightsParams({ ...q, type: "brand" }),
      normalize: (body: Raw) => ({
        locality: locality(body),
        items: list<Raw>(body?.results?.entities).map((e) => ({
          entityId: e.entity_id,
          name: e.name,
          affinity: r3(e.query?.affinity),
          popularity: r3(e.popularity),
          categories: list<Raw>(e.tags)
            .filter((t) => t.type === "urn:tag:genre:brand")
            .map((t) => t.id),
          industries: firstN(e.properties?.industries, 3),
          targetAgeGroup: firstN(e.properties?.target_age_group, 3),
          customerSegments: firstN(e.properties?.customer_segments, 3),
          knownPartnerships: firstN(e.properties?.known_partnerships, 3),
          shortDescription: e.properties?.short_description || undefined,
        })),
      }),
      count: (d) => d.items.length,
    },
    ctx,
  );
}

/* places */

export interface PlaceResult {
  entityId: string;
  name: string;
  affinity: number | null;
  popularity: number | null;
  distanceM: number | null;
  lat?: number;
  lon?: number;
  address?: string;
  neighborhood?: string;
  genre?: string;
  businessRating: number | null;
  liveMusic?: boolean;
  shortDescription?: string;
}

export function placeInsights(
  q: Omit<InsightsQuery, "type">,
  ctx: QlooContext,
): Promise<QlooResult<Ranked<PlaceResult>>> {
  return qlooGet(
    {
      kind: "insights.place",
      path: "/v2/insights",
      params: insightsParams({ ...q, type: "place" }),
      normalize: (body: Raw) => ({
        locality: locality(body),
        items: list<Raw>(body?.results?.entities).map((e) => ({
          entityId: e.entity_id,
          name: e.name,
          affinity: r3(e.query?.affinity),
          popularity: r3(e.popularity),
          distanceM: typeof e.query?.distance === "number" ? Math.round(e.query.distance) : null,
          lat: e.location?.lat,
          lon: e.location?.lon,
          address: e.properties?.address || undefined,
          neighborhood: e.properties?.neighborhood || undefined,
          genre: e.properties?.primary_genre?.name || undefined,
          businessRating: r3(e.properties?.business_rating),
          liveMusic: e.properties?.live_music ?? undefined,
          shortDescription: e.properties?.short_description || undefined,
        })),
      }),
      count: (d) => d.items.length,
    },
    ctx,
  );
}

/* generic entity insights (artists, destinations) for the raw toolset */

export interface EntityInsight {
  entityId: string;
  name: string;
  affinity: number | null;
  popularity: number | null;
}

export function entityInsights(
  q: InsightsQuery & { type: "artist" | "destination" },
  ctx: QlooContext,
): Promise<QlooResult<Ranked<EntityInsight>>> {
  return qlooGet(
    {
      kind: `insights.${q.type}`,
      path: "/v2/insights",
      params: insightsParams(q),
      normalize: (body: Raw) => ({
        locality: locality(body),
        items: list<Raw>(body?.results?.entities).map((e) => ({
          entityId: e.entity_id,
          name: e.name,
          affinity: r3(e.query?.affinity),
          popularity: r3(e.popularity),
        })),
      }),
      count: (d) => d.items.length,
    },
    ctx,
  );
}

/* heatmap */

export interface HeatCell {
  lat: number;
  lon: number;
  geohash: string;
  affinity: number | null;
  affinityRank: number | null;
  popularity: number | null;
}

export interface HeatmapSummary {
  locality: Locality | null;
  /** Number of geohash cells with signal: our proxy for local coverage. */
  cellCount: number;
  /** Highest-affinity cells (affinity is rescaled within the city, so not comparable across cities). */
  hotspots: HeatCell[];
  /** Top-decile affinity cells with the lowest general popularity: devoted pockets. */
  devotedPockets: HeatCell[];
}

const DEVOTED_MIN_AFFINITY_RANK = 0.9;

export function heatmap(
  q: { entities: string[]; city: string },
  ctx: QlooContext,
): Promise<QlooResult<HeatmapSummary>> {
  return qlooGet(
    {
      kind: "insights.heatmap",
      path: "/v2/insights",
      params: insightsParams({ type: "heatmap", entities: q.entities, filterLocation: q.city }),
      normalize: (body: Raw) => {
        const cells: HeatCell[] = list<Raw>(body?.results?.heatmap).map((c) => ({
          lat: c.location?.latitude,
          lon: c.location?.longitude,
          geohash: c.location?.geohash,
          affinity: r3(c.query?.affinity),
          affinityRank: r3(c.query?.affinity_rank),
          popularity: r3(c.query?.popularity),
        }));
        const byRank = [...cells].sort((a, b) => (b.affinityRank ?? 0) - (a.affinityRank ?? 0));
        return {
          locality: locality(body),
          cellCount: cells.length,
          hotspots: byRank.slice(0, 5),
          devotedPockets: byRank
            .filter((c) => (c.affinityRank ?? 0) >= DEVOTED_MIN_AFFINITY_RANK)
            .sort((a, b) => (a.popularity ?? 1) - (b.popularity ?? 1))
            .slice(0, 5),
        };
      },
      count: (d) => d.cellCount,
    },
    ctx,
  );
}

/* taste tags */

export interface TagInsight {
  tagId: string;
  name: string;
  subtype?: string;
  affinity: number | null;
  popularity: number | null;
}

export function tagInsights(
  q: { entities: string[]; signalLocation?: string; tagTypes?: string[]; take?: number },
  ctx: QlooContext,
): Promise<QlooResult<Ranked<TagInsight>>> {
  return qlooGet(
    {
      kind: "insights.tag",
      path: "/v2/insights",
      params: insightsParams({ type: "tag", ...q, take: q.take ?? 15 }),
      normalize: (body: Raw) => ({
        locality: locality(body),
        items: list<Raw>(body?.results?.tags).map((t) => ({
          tagId: t.tag_id ?? t.id,
          name: t.name,
          subtype: t.subtype,
          affinity: r3(t.query?.affinity),
          popularity: r3(t.popularity),
        })),
      }),
      count: (d) => d.items.length,
    },
    ctx,
  );
}

/* demographics */

export interface Demographics {
  /** Relative to the average audience: positive = over-indexed, negative = under-indexed. */
  age: Record<string, number>;
  gender: Record<string, number>;
}

export function demographics(q: { entities: string[] }, ctx: QlooContext): Promise<QlooResult<Demographics | null>> {
  return qlooGet(
    {
      kind: "insights.demographics",
      path: "/v2/insights",
      params: insightsParams({ type: "demographics", entities: q.entities }),
      normalize: (body: Raw) => {
        const d = list<Raw>(body?.results?.demographics)[0]?.query;
        if (!d) return null;
        const round = (o: Raw) =>
          Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, r3(v) ?? 0])) as Record<string, number>;
        return { age: round(d.age), gender: round(d.gender) };
      },
      count: (d) => (d ? 1 : 0),
    },
    ctx,
  );
}

/* compare */

export interface CompareResult {
  shared: { tagId: string; name: string; subtype?: string; score: number | null }[];
  aOnly: { tagId: string; name: string; subtype?: string }[];
  bOnly: { tagId: string; name: string; subtype?: string }[];
}

export function compare(q: { a: string[]; b: string[] }, ctx: QlooContext): Promise<QlooResult<CompareResult>> {
  const tag = (t: Raw) => ({ tagId: t.tag_id, name: t.name, subtype: t.subtype });
  return qlooGet(
    {
      kind: "compare",
      path: "/v2/analysis/compare",
      params: { "a.signal.interests.entities": q.a, "b.signal.interests.entities": q.b },
      normalize: (body: Raw) => ({
        shared: list<Raw>(body?.results?.tags).map((t) => ({ ...tag(t), score: r3(t.query?.score) })),
        aOnly: list<Raw>(body?.results?.a).slice(0, 15).map(tag),
        bOnly: list<Raw>(body?.results?.b).slice(0, 15).map(tag),
      }),
      count: (d) => d.shared.length + d.aOnly.length + d.bOnly.length,
    },
    ctx,
  );
}

/* tag lookup */

export interface TagRef {
  tagId: string;
  name: string;
  type: string;
}

export function findTags(
  q: { query: string; tagTypes?: string[]; take?: number },
  ctx: QlooContext,
): Promise<QlooResult<TagRef[]>> {
  return qlooGet(
    {
      kind: "tags",
      path: "/v2/tags",
      params: { "filter.query": q.query, "filter.tag.types": q.tagTypes, take: q.take ?? 15 },
      normalize: (body: Raw) =>
        list<Raw>(body?.results?.tags).map((t) => ({ tagId: t.id, name: t.name, type: t.type })),
      count: (d) => d.length,
    },
    ctx,
  );
}
