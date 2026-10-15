// Types shared by apps/api and apps/web.

export type PropertyType = "artist_tour" | "festival";

export type RunStatus = "running" | "needs_input" | "done" | "error";

/** Normalised result status for every Qloo call (silent empty 200s count as "empty"). */
export type QlooStatus = "ok" | "empty" | "thin" | "error";

/** Coverage badge shown on every city and brand. */
export type Coverage = "strong" | "thin" | "none";

/** Brand categories a seller can pick; values are Qloo brand genre tag IDs. */
export const BRAND_CATEGORIES = {
  food_and_beverage: { label: "Food & beverage", tag: "urn:tag:genre:brand:food_and_beverage" },
  fashion: { label: "Fashion", tag: "urn:tag:genre:brand:fashion" },
  electronics: { label: "Tech & electronics", tag: "urn:tag:genre:brand:electronics" },
  automotive: { label: "Automotive", tag: "urn:tag:genre:brand:automotive" },
  financial: { label: "Finance", tag: "urn:tag:genre:brand:financial_services" },
  travel: { label: "Travel", tag: "urn:tag:genre:brand:travel" },
} as const;

export type BrandCategory = keyof typeof BRAND_CATEGORIES;

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
