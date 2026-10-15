// Raw-endpoint tools: the agent chooses Qloo parameters itself. Outputs use the same normalisers
// as the business tools, so results stay compact and comparable in the bake-off.
import { z } from "zod";
import * as qloo from "../qloo/api.js";
import { defineTool, type ToolDef } from "./types.js";

const ids = z.array(z.string().min(1)).min(1).max(15);

export const rawSearch = defineTool({
  name: "qloo_search",
  description:
    "Qloo /search: find entities by name. Optionally restrict types, e.g. ['urn:entity:artist'], ['urn:entity:brand'], ['urn:entity:locality'].",
  input: z.object({
    query: z.string().min(1),
    types: z.array(z.string()).optional(),
    take: z.number().int().min(1).max(15).default(8),
  }),
  async run(input, ctx) {
    const r = await qloo.search(input, ctx);
    return { status: r.status, data: r.data, callIds: [r.callId] };
  },
});

export const rawInsights = defineTool({
  name: "qloo_insights",
  description:
    "Qloo /v2/insights. type: brand | place | artist | destination | heatmap | tag | demographics. " +
    "signal_entities = signal.interests.entities. filter_tags = filter.tags (e.g. 'urn:tag:genre:brand:food_and_beverage', " +
    "'urn:tag:genre:place:restaurant:bar'); several tags are OR-ed. result_entities = filter.results.entities (score only these IDs). " +
    "signal_location = signal.location.query (localises affinity; the way to localise brands). " +
    "filter_location = filter.location.query (places, destinations and heatmaps only; IGNORED for brands). " +
    "point + radius_m = filter.location POINT for places near a coordinate. tag_types = filter.tag.types for type 'tag'. " +
    "Invalid parameter combinations come back empty without an error.",
  input: z.object({
    type: z.enum(["brand", "place", "artist", "destination", "heatmap", "tag", "demographics"]),
    signal_entities: ids,
    filter_tags: z.array(z.string()).optional(),
    result_entities: z.array(z.string()).optional(),
    signal_location: z.string().optional(),
    filter_location: z.string().optional(),
    point: z.object({ lat: z.number(), lon: z.number() }).optional(),
    radius_m: z.number().int().min(100).max(10000).optional(),
    tag_types: z.array(z.string()).optional(),
    take: z.number().int().min(1).max(25).default(10),
  }),
  async run(i, ctx) {
    const q = {
      entities: i.signal_entities,
      tags: i.filter_tags,
      resultEntities: i.result_entities,
      signalLocation: i.signal_location,
      filterLocation: i.filter_location,
      point: i.point ? { ...i.point, radiusM: i.radius_m ?? 1500 } : undefined,
      tagTypes: i.tag_types,
      take: i.take,
    };
    const r =
      i.type === "brand"
        ? await qloo.brandInsights(q, ctx)
        : i.type === "place"
          ? await qloo.placeInsights(q, ctx)
          : i.type === "heatmap"
            ? await qloo.heatmap({ entities: q.entities, city: i.filter_location ?? "" }, ctx)
            : i.type === "tag"
              ? await qloo.tagInsights({ ...q, signalLocation: i.signal_location }, ctx)
              : i.type === "demographics"
                ? await qloo.demographics(q, ctx)
                : await qloo.entityInsights({ ...q, type: i.type }, ctx);
    return { status: r.status, data: r.data, callIds: [r.callId] };
  },
});

export const rawCompare = defineTool({
  name: "qloo_compare",
  description: "Qloo /v2/analysis/compare: shared and distinct taste tags between two entity groups.",
  input: z.object({ a_ids: ids, b_ids: ids }),
  async run({ a_ids, b_ids }, ctx) {
    const r = await qloo.compare({ a: a_ids, b: b_ids }, ctx);
    return { status: r.status, data: r.data, callIds: [r.callId] };
  },
});

export const rawFindTags = defineTool({
  name: "qloo_find_tags",
  description:
    "Qloo /v2/tags: look up tag IDs by keyword, e.g. query 'beverage' with tag_types ['urn:tag:genre:brand'], or 'bar' with ['urn:tag:genre:place'].",
  input: z.object({
    query: z.string().min(1),
    tag_types: z.array(z.string()).optional(),
    take: z.number().int().min(1).max(30).default(15),
  }),
  async run({ query, tag_types, take }, ctx) {
    const r = await qloo.findTags({ query, tagTypes: tag_types, take }, ctx);
    return { status: r.status, data: r.data, callIds: [r.callId] };
  },
});

export const rawTools: ToolDef[] = [rawSearch, rawInsights, rawCompare, rawFindTags] as ToolDef[];
