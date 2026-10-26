# Overlap

> Tell us your tour. We tell you which brands to pitch, in which cities, and why.

**Live demo: https://overlap.u.co.uz** (no login; open a demo tour to watch Overlap work, then explore the results).

Overlap is a sell-side sponsorship agent for artist tours and festivals. A sponsorship seller enters a property (artists, cities, brand categories). A Claude agent works through Qloo's taste graph: it finds brands the fans already love, checks how each city changes the picture, maps where fans gather, finds local activation partners near them, and drafts a pitch pack the seller edits and approves before anything leaves the app.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). Product spec: [`PRODUCT.md`](PRODUCT.md) · Known limits: [`LIMITATIONS.md`](LIMITATIONS.md)

Docs: [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md) · [Rules](docs/RULES.md) · [Qloo API notes](docs/QLOO_API.md) · [Development](docs/DEVELOPMENT.md) · [Bake-off](docs/BAKEOFF.md) · [Design system](apps/web/DESIGN.md) · [Submission kit](docs/SUBMISSION.md)

## The problem

Sponsorship is a large, high-margin revenue line for promoters, festivals and artist teams, but finding the right brand is mostly gut feel: sellers pitch the same obvious categories for every tour, audience tools describe age and gender rather than taste, and brand fit is judged once nationally although a tour plays many cities. A pitch takes days per brand. A language model alone makes it worse: confident, generic picks with no evidence.

## Who it is for

The **sponsorship seller** at a promoter, festival, venue group or artist management company: someone who owns a revenue target and pitches brands every week. They trust evidence and things they can edit, and distrust black-box scores and invented numbers.

## What the seller gets

1. **A ranked shortlist** of brands whose audience overlaps with the artist's fans (Qloo affinity), each with its Qloo evidence one click away and a labelled "Overlap suggests" note.
2. **Brand × city**: each brand's position in each city's own Qloo ranking, with "national fit" where a city's local list omits it (never presented as weak fit).
3. **City view**: where fans gather (heatmap hotspot and a "devoted pocket"), a plain-English crowd read, and local partner venues near the fans with an activation idea for each.
4. **A pitch pack**: the pitch, why this brand, city by city, activations, measurement plan, a sendable outreach email and internal seller notes. The seller edits and approves; only then can it be exported as a branded PDF, Markdown or an email draft.
5. **Qloo vs LLM-only**: a switch on the shortlist asks the same model the same question with no Qloo data, and shows which of its picks the taste graph backs up and which strong Qloo picks it missed.

While the agent works, the seller watches one thing: their own tour as a route, with the Overlap tour bus driving to each city as the agent reaches it, each city printing in as its evidence is read, and the brands that rank there popping up. The agent is shown as a black box: one plain line of what it is doing, never its internal reasoning.

## Qloo workflows used, and why

| Agent tool | Qloo request | Why |
|---|---|---|
| `resolve_artist` | `/search` (artist) | Turn a name into an entity; when it is ambiguous the run pauses and the seller picks ("Did you mean…") |
| `find_brands` | `/v2/insights` brand + category tag, artist signal | Brands with the highest audience affinity per category the seller sells |
| `city_fit` | `/v2/insights` brand + category tag + `signal.location.query`, per city | How each city's own ranking changes the picture (local proof) |
| `city_hotspot` | `/v2/insights` `urn:heatmap` + `filter.location.query` | Where fans concentrate in each city; a coverage signal |
| `crowd_profile` | `/v2/insights` `urn:tag` localised + `urn:demographics` | Plain-English crowd read (sensitive-trait tags filtered out) |
| `local_partners` | `/v2/insights` place + `POINT` + radius + place tags | Venues near the fan hotspot for activations |
| `shared_themes` | `/v2/analysis/compare` | Shared taste between festival headliners |

Every Qloo call is logged with its redacted request and normalised result. The agent's report cites call IDs; the server looks up every number from those logs and counts anything it cannot find (the grounding line on each run, e.g. "24 of 24 figures traced to Qloo lookups").

### Request → result example (redacted)

`city_fit` asks for the fashion brands that rank highest with the artist's fans, localised to one city:

```http
GET /v2/insights
  ?filter.type=urn:entity:brand
  &filter.tags=urn:tag:genre:brand:fashion
  &signal.interests.entities=<artist entity id>
  &signal.location.query=Mexico City
  &take=30
```

Normalised result as logged (values elided):

```json
{
  "locality": { "name": "Mexico City", "disambiguation": "…" },
  "items": [
    { "entityId": "…", "name": "Adidas", "affinity": "0.9…", "popularity": "…", "customerSegments": ["…"], "knownPartnerships": ["…"] },
    { "entityId": "…", "name": "…", "affinity": "0.9…" }
  ]
}
```

In the app this becomes "Adidas #1 in Mexico City's local fashion ranking", with a link to this exact call.

## How it works

```
Seller input ──► Claude agent (tool loop, server-side) ──► submit_report ──► stored evidence ──► UI
                  (Haiku 5.5: tools above, in parallel, within call and token budgets)
                         │ every Qloo call logged ──► numbers looked up from the logs (grounding check)
                         │ run events ──► SSE ──► live tour stage
Pitch pack: Claude (Sonnet 5.5) drafts from an evidence pack rebuilt from logged calls ──► seller edits ──► approve ──► PDF / Markdown / email draft
```

- **Qloo is the evidence, the agent is the analyst.** Interpretation is always labelled.
- **Human approves.** Ambiguous artists pause the run; export unlocks only after approval; nothing is sent automatically.
- **Honest coverage.** Thin or empty data shows as such, never filled by the model.
- **Aggregate taste only.** Inputs are entity IDs, tags and cities. No personal data is collected or sent to Qloo.

Model choice came from a measured bake-off (groundedness, tool use, cost, latency): [`docs/BAKEOFF.md`](docs/BAKEOFF.md). A typical run costs about $0.01–0.02 in Claude usage and 20–50 Qloo calls; a pitch pack about $0.03.

## Layout

```
apps/api         Hono API: agent loop (Anthropic SDK), Qloo REST layer, Postgres (Drizzle), SSE, PDF
apps/web         Next.js 16 frontend, Tailwind v4, React Three Fiber stage
packages/shared  Types and verified Qloo tag IDs shared by api and web
brand/           Logo kit; brand/blender/ builds the tour bus model and the screen-print loop
```

## Local setup

Requires Node 22+, pnpm 10, Postgres 16+, a Qloo hackathon key and a Claude API key.

```bash
pnpm install
cp .env.example .env          # QLOO_API_KEY, CLAUDE_API_KEY, DATABASE_URL
pnpm db:migrate               # create tables
pnpm dev                      # api on :8787, web on :3000
```

Useful scripts:

| Command | What it does |
|---|---|
| `pnpm agent <presetId>` | Run a demo preset headless, print the trace; the result becomes the preset's cached result |
| `pnpm tool <name> '<json>'` | Run one agent tool against Qloo, e.g. `pnpm tool resolve_artist '{"name":"Khruangbin"}'` |
| `pnpm probe [presetId]` | Coverage check for the demo presets |
| `pnpm bakeoff` | Compare models × effort × toolsets |
| `pnpm typecheck` | All packages |

Keys live only in `.env` and are read by the API; the browser never sees them. Qloo responses are cached in Postgres at runtime and never committed.

## Production

Live at **https://overlap.u.co.uz**, on one server with Docker Compose (Postgres, API, web) behind Apache with a Let's Encrypt certificate. Every push to `main` is typechecked and deployed by GitHub Actions (`.github/workflows/deploy.yml` → `scripts/deploy.sh`). See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## What was built during the submission period

Everything in this repository was built during the hackathon (October 2026): the Qloo layer, agent, grounding check, pitch packs, the web app and its design system, the 3D assets and the deployment.

## License

MIT
