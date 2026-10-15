# Architecture

## System

```
Browser (Next.js 16, apps/web)
   │  HTTPS JSON + server-sent events (agent steps)
   ▼
API (Hono on Node 22, apps/api)
   ├── Agent orchestrator ── Anthropic SDK ──► Claude (agent: Haiku 5.5, pitch: Sonnet 5.5)
   ├── Tools (business / raw) ─► Qloo layer ─► hackathon.api.qloo.com
   ├── Pitch drafting + PDF rendering
   └── Postgres (Drizzle): runs, results, events, tool-call log, response cache
```

In production all of this runs on one server with `docker-compose.yml`: Caddy (HTTPS) routes `/api/*` to the API and everything else to the web app; Postgres runs in its own container. Keys live only in the API's environment.

## Run lifecycle

```
POST /runs ──► startRun: insert run, emit status, start loop (not awaited)
                 │
                 ▼
        runLoop (apps/api/src/agent/orchestrator.ts)
          ├─ Claude turn (streamed, adaptive thinking, prompt caching)
          ├─ tool calls run in parallel → Qloo layer → tool_calls log
          ├─ ask_user ──► status needs_input, state saved ──► POST /runs/:id/resolve resumes
          └─ submit_report ──► materializeReport ──► result tables + grounding check ──► status done
        every step ──► run_events ──► SSE (GET /runs/:id/stream, replayable)

Pitch: POST /runs/:id/pitch/:brandId ──► evidence rebuilt from logged calls ──► Claude ──► pitch_packs
       PATCH (edit, withdraws approval) ──► POST …/approve ──► GET …/pdf (403 until approved)
```

The conversation state is append-only and saved after every turn, so a paused run resumes exactly where it stopped.

## Packages

| Path | Role |
|---|---|
| `packages/shared` | Types shared by api and web; verified Qloo tag IDs (`BRAND_CATEGORIES`, `PLACE_KINDS`); `isSensitiveTag` |
| `apps/api/src/qloo/client.ts` | `qlooGet`: cache lookup → throttle (≤5 req/s) → fetch with one bounded retry → normalise → log to `tool_calls` |
| `apps/api/src/qloo/api.ts` | Endpoint wrappers and compact normalisers: search, brand/place/entity insights, heatmap, tags, demographics, compare, tag lookup |
| `apps/api/src/tools/business.ts` | Agent tools that each do one business step (may run several Qloo calls) |
| `apps/api/src/tools/raw.ts` | Raw endpoint tools (bake-off comparison only) |
| `apps/api/src/agent/orchestrator.ts` | Tool loop, budgets, pause/resume, persistence |
| `apps/api/src/agent/report.ts` | `submit_report` schema; materialises results and runs the grounding check |
| `apps/api/src/agent/prompts.ts` | Agent system prompt, kickoff message, pitch prompt |
| `apps/api/src/agent/events.ts` | Ordered run events: persisted + pushed to SSE subscribers |
| `apps/api/src/pitch/` | `draft.ts` (evidence pack + Claude call), `pdf.ts` (Markdown → PDF) |
| `apps/api/src/routes.ts` | HTTP API, demo rate limits, preset caching |
| `apps/web/components/` | `Home`, `RunView`, `AgentTrace`, `Results` (shortlist, grid, activation), `PitchPackPanel`, `Provenance` |

## Agent tools (business toolset)

| Tool | Qloo request | Output |
|---|---|---|
| `resolve_artist` | `/search` types=artist | one artist, or `needs_input` with candidates |
| `find_brands` | `/v2/insights` brand + category tag | brands per category with affinity |
| `city_fit` | `/v2/insights` brand + category tag + `signal.location.query`, per city × category | local rank per shortlisted brand (`inLocalTop`), local standouts |
| `city_hotspot` | `/v2/insights` `urn:heatmap` + `filter.location.query` | cell count, hotspots, devoted pockets |
| `crowd_profile` | `/v2/insights` `urn:tag` localised + `urn:demographics` | taste tags (sensitive ones filtered), aggregate skew |
| `local_partners` | `/v2/insights` place + `POINT` + radius + place tags | nearby places with distance and description |
| `shared_themes` | `/v2/analysis/compare` | shared and distinct taste tags |

Plus two control tools defined in the orchestrator: `ask_user` (pause for the seller) and `submit_report` (final answer).

## Grounding

The agent's report contains IDs, call references and interpretation only. `materializeReport` looks every brand and place up in the result of the call it cites (which must belong to the same run). It takes all numbers from there and records any item it cannot find as a violation (shown on the run page, measured in the bake-off). The pitch writer gets an evidence pack rebuilt from logged calls, with one call ID per figure, never the agent's notes.

## Data model (Postgres)

| Table | Holds |
|---|---|
| `runs` | input, status, model/effort/toolset, `agent_state` (conversation), `pending_input`, summary, usage, grounding, preset id |
| `brand_matches` | shortlist: affinity, popularity, overlap score, evidence (call ID + Qloo data), agent note, source |
| `city_cells` | brand × city: local rank, local affinity, coverage, `call_id` of the ranking |
| `city_profiles` | per city: hotspot summary, cell count, coverage, crowd profile, evidence call IDs |
| `activations` | partner places per city with distance, idea and evidence |
| `pitch_packs` | Markdown body, approval flag/time |
| `run_events` | ordered trace events for SSE replay |
| `tool_calls` | every Qloo call: redacted request, status, normalised result, duration, cached flag |
| `qloo_cache` | normalised responses by request hash, 24 h expiry |
| `bakeoff_results` | bake-off metrics per run |

Migrations: `apps/api/drizzle/` (generated by `pnpm db:generate`, applied by `pnpm db:migrate` and on API container start).

## HTTP API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | DB and key check |
| GET | `/presets` | demo presets |
| GET | `/runs` | recent runs |
| POST | `/runs` | start a run (or return a cached preset result unless `fresh`) |
| GET | `/runs/:id` | full run state + local standouts |
| GET | `/runs/:id/stream?after=n` | SSE: replay then live events |
| POST | `/runs/:id/resolve` | answer `ask_user` (`{entityId, name}`) |
| POST | `/runs/:id/pitch/:brandId` | draft or redraft a pitch pack |
| PATCH | `/runs/:id/pitch/:brandId` | save edits (withdraws approval) |
| POST | `/runs/:id/pitch/:brandId/approve` | approve |
| GET | `/runs/:id/pitch/:brandId/pdf` | PDF, only when approved |
| GET | `/calls/:id`, `/calls?ids=` | provenance: logged Qloo calls |
