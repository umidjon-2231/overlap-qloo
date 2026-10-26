import type { BrandCategory, Coverage, CreateRunInput, RunStatus } from "@overlap/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export interface Preset extends CreateRunInput {
  id: string;
  blurb: string;
}

export interface RunSummary {
  id: string;
  propertyName: string;
  status: RunStatus;
  presetId: string | null;
  model: string | null;
  createdAt: string;
}

export interface Usage {
  costUsd: number;
  elapsedMs: number;
  firstToolMs: number | null;
  agentToolCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  qloo: { calls: number; cached: number; errors: number };
}

export interface Run {
  id: string;
  propertyType: "artist_tour" | "festival";
  propertyName: string;
  artists: { query: string; entityId?: string; name?: string }[];
  cities: string[];
  categories: BrandCategory[];
  status: RunStatus;
  presetId: string | null;
  model: string | null;
  effort: string | null;
  toolset: string | null;
  pendingInput: { question: string; candidates: { entity_id: string; name: string; description?: string }[] } | null;
  summary: string | null;
  usage: Usage | null;
  grounding: { checked: number; violations: { kind: string; id: string; callId: number }[] } | null;
  llmOnly: LlmOnly | null;
  error: string | null;
  createdAt: string;
}

/** The same model's picks with no Qloo data, matched against the Qloo shortlist. */
export interface LlmOnly {
  model: string;
  createdAt: string;
  picks: { name: string; category: string; why: string; onShortlist: number | null }[];
  missed: { rank: number; name: string; affinity: number | null }[];
}

export interface BrandQloo {
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

export interface BrandMatch {
  brandEntityId: string;
  brandName: string;
  category: string | null;
  source: "seller_category" | "agent_wildcard";
  affinity: number | null;
  popularity: number | null;
  overlapScore: number | null;
  evidence: { callId: number; qloo: BrandQloo };
  agentNote: string | null;
}

export interface CityCell {
  brandEntityId: string;
  city: string;
  affinity: number | null;
  rankInCity: number | null;
  coverage: Coverage;
}

export interface HeatCell {
  lat: number;
  lon: number;
  geohash: string;
  affinity: number | null;
  affinityRank: number | null;
  popularity: number | null;
}

export interface TagInsight {
  tagId: string;
  name: string;
  subtype?: string;
  affinity: number | null;
}

export interface CityProfile {
  city: string;
  hotspot: {
    locality: { name: string; disambiguation?: string; lat?: number; lon?: number } | null;
    hotspots: HeatCell[];
    devotedPockets: HeatCell[];
  } | null;
  cellCount: number | null;
  coverage: Coverage;
  crowdProfile: string | null;
  evidence: {
    heatmapCallId: number | null;
    crowdCallIds: number[];
    localFitCallIds: number[];
    /** Logged results of crowdCallIds, in order: taste tags or demographics. */
    crowd: ({ items: TagInsight[] } | { age: Record<string, number>; gender: Record<string, number> } | null)[];
  };
}

export interface Partner {
  id: number;
  city: string;
  placeEntityId: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  idea: string | null;
  evidence: { callId: number; qloo: { genre?: string; neighborhood?: string; address?: string; affinity: number | null; businessRating: number | null } };
}

export interface PitchPack {
  brandEntityId: string;
  bodyMd: string;
  approved: boolean;
  approvedAt: string | null;
  updatedAt: string;
}

export interface Standout {
  brandId: string;
  name: string;
  localAffinity: number | null;
  callId: number;
}

export interface RunPayload {
  run: Run;
  brands: BrandMatch[];
  cells: CityCell[];
  profiles: CityProfile[];
  partners: Partner[];
  pitches: PitchPack[];
  standouts: Record<string, Standout[]>;
}

export interface ToolCallRecord {
  id: number;
  tool: string;
  status: string;
  cached: boolean;
  durationMs: number | null;
  requestRedacted: { path: string; params: Record<string, string> };
  resultSummary: unknown;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  presets: () => request<Preset[]>("/presets"),
  runs: () => request<RunSummary[]>("/runs"),
  run: (id: string) => request<RunPayload>(`/runs/${id}`),
  createRun: (input: CreateRunInput & { presetId?: string; fresh?: boolean }) =>
    request<{ runId: string; cached: boolean }>("/runs", { method: "POST", body: JSON.stringify(input) }),
  resolve: (id: string, entityId: string, name: string) =>
    request<{ ok: true }>(`/runs/${id}/resolve`, { method: "POST", body: JSON.stringify({ entityId, name }) }),
  llmOnly: (id: string) => request<LlmOnly>(`/runs/${id}/llm-only`, { method: "POST" }),
  draftPitch: (id: string, brandId: string) =>
    request<{ bodyMd: string }>(`/runs/${id}/pitch/${brandId}`, { method: "POST" }),
  savePitch: (id: string, brandId: string, bodyMd: string) =>
    request<PitchPack>(`/runs/${id}/pitch/${brandId}`, { method: "PATCH", body: JSON.stringify({ bodyMd }) }),
  approvePitch: (id: string, brandId: string) =>
    request<PitchPack>(`/runs/${id}/pitch/${brandId}/approve`, { method: "POST" }),
  pdfUrl: (id: string, brandId: string) => `${API_URL}/runs/${id}/pitch/${brandId}/pdf`,
  call: (callId: number) => request<ToolCallRecord>(`/calls/${callId}`),
  streamUrl: (id: string, after = 0) => `${API_URL}/runs/${id}/stream?after=${after}`,
};
