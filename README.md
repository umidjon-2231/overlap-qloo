# Overlap

> Tell us your tour. We tell you which brands to pitch, in which cities, and why.

Overlap is a sell-side sponsorship agent for artist tours and festivals. A sponsorship seller enters a property (artists + cities + brand categories). A Claude agent uses Qloo's taste graph to find brands the fans already love, checks how each city changes the picture, finds local activation partners near fan hotspots, and drafts a pitch pack that the seller edits and approves before anything leaves the app.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). Product spec: [`PRODUCT.md`](PRODUCT.md).

## How it works

```
Seller input ──► Claude agent (tool loop, server-side) ──► submit_report ──► stored evidence ──► UI
                  │  resolve_artist   → /search (asks the seller on ambiguous names)
                  │  find_brands      → /v2/insights brand + category tag filter
                  │  city_fit         → /v2/insights brand + signal.location per city & category
                  │  city_hotspot     → /v2/insights urn:heatmap + filter.location
                  │  crowd_profile    → /v2/insights urn:tag (localised) + urn:demographics
                  │  local_partners   → /v2/insights place + POINT/radius + place tags
                  │  shared_themes    → /v2/analysis/compare
                  ▼
           every Qloo call logged (tool_calls) ──► numbers in the UI are looked up from those logs
Pitch pack: Claude drafts from stored evidence → seller edits → approve → copy / PDF / email draft
```

- **Qloo is the evidence, the agent is the analyst.** The agent cites call IDs; the server fills every number from the logged Qloo result and counts any cited item it cannot find (grounding check, shown on each run).
- **Human approves.** Ambiguous artists pause the run for a "Did you mean…" choice. Export is locked until the seller approves the pitch pack. Nothing is sent automatically.
- **Honest coverage.** Empty or thin results show as badges ("no local signal", "thin data"), never filled by the model.
- **Aggregate taste only.** Inputs are entity IDs, tags and cities. Sensitive-trait tags are filtered out of crowd evidence.

## Layout

```
apps/api         Hono API: agent loop (Anthropic SDK), Qloo REST layer, Postgres (Drizzle), SSE
apps/web         Next.js 16 frontend
packages/shared  Types and verified Qloo tag IDs shared by api and web
```

## Local setup

Requires Node 22+, pnpm 10, Postgres 16+.

```bash
pnpm install
cp .env.example .env          # QLOO_API_KEY, CLAUDE_API_KEY, DATABASE_URL
pnpm db:migrate               # create tables
pnpm dev                      # api on :8787, web on :3000
```

Useful scripts:

| Command | What it does |
|---|---|
| `pnpm tool <name> '<json>'` | Run one agent tool against Qloo, e.g. `pnpm tool resolve_artist '{"name":"Khruangbin"}'` |
| `pnpm probe [presetId]` | Coverage check for the demo presets |
| `pnpm agent <presetId> [model] [effort] [toolset]` | Run the agent headless and print the trace |
| `pnpm bakeoff` | Compare models × effort × toolsets (groundedness, tool use, cost, latency) |

Keys live only in `.env` and are read by the API; the browser never sees them. Qloo responses are cached in Postgres at runtime and never committed.

## Production (single server, Docker)

```bash
cp .env.example .env    # set QLOO_API_KEY, CLAUDE_API_KEY, DOMAIN, POSTGRES_PASSWORD
docker compose up -d --build
```

Caddy serves `https://$DOMAIN` (automatic certificates), routes `/api/*` to the API and everything else to the web app. The API applies migrations on start.

## License

MIT
