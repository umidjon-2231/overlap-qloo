// Types shared by apps/api and apps/web.

export type PropertyType = "artist_tour" | "festival";

export type RunStatus = "running" | "needs_input" | "done" | "error";

/** Normalised result status for every Qloo call (silent empty 200s count as "empty"). */
export type QlooStatus = "ok" | "empty" | "thin" | "error";

/** Coverage badge shown on every city and brand. */
export type Coverage = "strong" | "thin" | "none";

/** Brand categories a seller can pick; tag IDs verified against /v2/tags. */
export const BRAND_CATEGORIES = {
  food_and_beverage: { label: "Food & beverage", tag: "urn:tag:genre:brand:food_and_beverage" },
  drinks: { label: "Drinks", tag: "urn:tag:genre:brand:food_and_beverage:drinks" },
  fashion: { label: "Fashion", tag: "urn:tag:genre:brand:fashion" },
  electronics: { label: "Tech & electronics", tag: "urn:tag:genre:brand:electronics" },
  gaming: { label: "Gaming", tag: "urn:tag:genre:brand:electronics:gaming" },
  telecom: { label: "Telecom", tag: "urn:tag:genre:brand:telecom" },
  automotive: { label: "Automotive", tag: "urn:tag:genre:brand:automotive" },
  financial_services: { label: "Finance", tag: "urn:tag:genre:brand:financial_services" },
  travel: { label: "Travel", tag: "urn:tag:genre:brand:travel" },
  health_and_beauty: { label: "Health & beauty", tag: "urn:tag:genre:brand:health_and_beauty" },
  retail: { label: "Retail", tag: "urn:tag:genre:brand:retail" },
} as const;

export type BrandCategory = keyof typeof BRAND_CATEGORIES;

/** Local partner kinds for activations; tag IDs verified against /v2/tags. */
export const PLACE_KINDS = {
  bar: "urn:tag:genre:place:restaurant:bar",
  cocktail_bar: "urn:tag:genre:place:restaurant:cocktail_bar",
  wine_bar: "urn:tag:genre:place:restaurant:wine_bar",
  live_music_venue: "urn:tag:genre:place:live_music_venue",
  live_music_bar: "urn:tag:genre:place:restaurant:live_music_bar",
  coffee_shop: "urn:tag:genre:place:restaurant:coffee_shop",
  brewery: "urn:tag:genre:place:brewery",
  record_store: "urn:tag:genre:place:record_store",
  event_venue: "urn:tag:genre:place:event_venue",
} as const;

export type PlaceKind = keyof typeof PLACE_KINDS;

export interface ArtistRef {
  query: string;
  entityId?: string;
  name?: string;
}

export interface CreateRunInput {
  propertyType: PropertyType;
  propertyName: string;
  artists: ArtistRef[];
  cities: string[];
  categories: BrandCategory[];
}

/** One event on the run's SSE stream (also persisted in run_events). */
export interface RunEvent {
  seq: number;
  type:
    | "status"
    | "agent_text"
    | "tool_start"
    | "tool_end"
    | "needs_input"
    | "result"
    | "error";
  payload: unknown;
  at: string;
}
