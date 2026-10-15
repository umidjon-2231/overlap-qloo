import {
  bigserial,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { ArtistRef, BrandCategory, PropertyType, RunStatus } from "@overlap/shared";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** One sponsorship analysis. agent_state holds the paused Claude loop so a needs_input run can resume. */
export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyType: text("property_type").$type<PropertyType>().notNull(),
  propertyName: text("property_name").notNull(),
  artists: jsonb("artists").$type<ArtistRef[]>().notNull(),
  cities: text("cities").array().notNull(),
  categories: text("categories").array().$type<BrandCategory[]>().notNull(),
  status: text("status").$type<RunStatus>().notNull().default("running"),
  presetId: text("preset_id"),
  model: text("model"),
  effort: text("effort"),
  toolset: text("toolset"),
  agentState: jsonb("agent_state"),
  /** Pending ask_user question while status = needs_input. */
  pendingInput: jsonb("pending_input"),
  summary: text("summary"),
  /** Token usage, cost estimate, timings, tool counts. */
  usage: jsonb("usage"),
  /** Report items checked against logged Qloo calls. */
  grounding: jsonb("grounding"),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ranked brands. affinity/popularity are raw Qloo values; overlap_score is affinity rescaled 0–100 within the run. */
export const brandMatches = pgTable(
  "brand_matches",
  {
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    brandEntityId: text("brand_entity_id").notNull(),
    brandName: text("brand_name").notNull(),
    category: text("category"),
    source: text("source").$type<"seller_category" | "agent_wildcard">().notNull(),
    affinity: doublePrecision("affinity"),
    popularity: doublePrecision("popularity"),
    overlapScore: doublePrecision("overlap_score"),
    evidence: jsonb("evidence").notNull(),
    agentNote: text("agent_note"),
  },
  (t) => [primaryKey({ columns: [t.runId, t.brandEntityId] })],
);

/** Brand × city: brand affinity re-queried with signal.location for that city. */
export const cityCells = pgTable(
  "city_cells",
  {
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    brandEntityId: text("brand_entity_id").notNull(),
    city: text("city").notNull(),
    affinity: doublePrecision("affinity"),
    rankInCity: integer("rank_in_city"),
    coverage: text("coverage").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.brandEntityId, t.city] })],
);

/** Per city: heatmap hotspot, coverage and crowd profile. */
export const cityProfiles = pgTable(
  "city_profiles",
  {
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    city: text("city").notNull(),
    hotspot: jsonb("hotspot"),
    cellCount: integer("cell_count"),
    coverage: text("coverage").notNull(),
    crowdProfile: text("crowd_profile"),
    evidence: jsonb("evidence").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.city] })],
);

/** Local partner places near a city's hotspot. */
export const activations = pgTable("activations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  city: text("city").notNull(),
  placeEntityId: text("place_entity_id").notNull(),
  placeName: text("place_name").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  distanceM: doublePrecision("distance_m"),
  idea: text("idea"),
  evidence: jsonb("evidence").notNull(),
});

/** Draft and approval. */
export const pitchPacks = pgTable(
  "pitch_packs",
  {
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    brandEntityId: text("brand_entity_id").notNull(),
    bodyMd: text("body_md").notNull(),
    approved: boolean("approved").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.brandEntityId] })],
);

/** Agent steps for the SSE trace; replayed when a client reconnects. */
export const runEvents = pgTable(
  "run_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.runId, t.seq)],
);

/** Every Qloo call, for provenance. Requests are stored without the API key. */
export const toolCalls = pgTable("tool_calls", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: uuid("run_id").references(() => runs.id, { onDelete: "cascade" }),
  tool: text("tool").notNull(),
  requestRedacted: jsonb("request_redacted").notNull(),
  status: text("status").notNull(),
  resultSummary: jsonb("result_summary"),
  durationMs: integer("duration_ms"),
  cached: boolean("cached").notNull().default(false),
  createdAt: createdAt(),
});

/** Private response cache keyed by normalised request hash. */
export const qlooCache = pgTable("qloo_cache", {
  requestHash: text("request_hash").primaryKey(),
  response: jsonb("response").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Model × effort × toolset comparison runs. */
export const bakeoffResults = pgTable("bakeoff_results", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  preset: text("preset").notNull(),
  model: text("model").notNull(),
  effort: text("effort"),
  toolset: text("toolset").notNull(),
  runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
  metrics: jsonb("metrics").notNull(),
  createdAt: createdAt(),
});
