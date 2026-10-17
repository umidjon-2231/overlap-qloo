# Development and operations

## Local setup

Requirements: Node 22+, pnpm 10, Postgres 16+.

```bash
pnpm install
cp .env.example .env     # QLOO_API_KEY, QLOO_API_URL, CLAUDE_API_KEY, DATABASE_URL
pnpm db:migrate
pnpm dev                 # web http://localhost:3000, api http://localhost:8787
```

On the current dev machine the database is the existing `dev-postgres` container (`localhost:15432`, database `overlap`). Port 5433 there is an SSH tunnel, not Postgres.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `QLOO_API_KEY`, `QLOO_API_URL` | – / hackathon URL | API only |
| `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) | – | API only |
| `DATABASE_URL` | – | set by compose in production |
| `AGENT_MODEL`, `AGENT_EFFORT`, `AGENT_TOOLSET` | `claude-haiku-5-5`, `high`, `business` | see `docs/BAKEOFF.md` |
| `PITCH_MODEL` | `claude-sonnet-5-5` | |
| `RUN_TOOL_CALL_LIMIT` | 30 | raw toolset gets 2× |
| `RUN_QLOO_CALL_LIMIT` | 120 | network calls per run |
| `RUN_TOKEN_BUDGET` | 600000 | cached reads count at 10% |
| `CACHE_TTL_HOURS` | 24 | Qloo response cache |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS; comma-separated |
| `DOMAIN`, `POSTGRES_PASSWORD` | – | production compose |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` | localhost | web build args (inlined at build) |

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `dev:api` / `dev:web` | run both apps or one |
| `pnpm typecheck` | all packages (web runs `next typegen` first) |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations |
| `pnpm tool <name> '<json>'` | run one agent tool against Qloo |
| `pnpm probe [presetId]` | coverage check for presets |
| `pnpm agent <presetId> [model] [effort] [toolset]` | headless agent run with trace; a successful run becomes the preset's cached result |
| `pnpm bakeoff [quick]` | model × effort × toolset comparison |
| `pnpm --filter @overlap/api pitch-evidence <runId> "<brand>"` | show the pitch writer's evidence pack |
| `pnpm --filter @overlap/api check-report <runId>` | re-validate a run's submitted reports against the current report schema |

## Production

```bash
cp .env.example .env     # QLOO_API_KEY, CLAUDE_API_KEY, DOMAIN, POSTGRES_PASSWORD
docker compose up -d --build
```

- Caddy gets certificates automatically for `DOMAIN` (ports 80/443 must be free and DNS pointed at the server).
- The API container applies migrations on start.
- The demo must stay up through judging (Nov 2–16, 2026). After deploy, open each preset once so cached results load instantly.

## Cost reference

- Agent run (Haiku 5.5 high): about $0.007–0.017 and 20–50 Qloo calls cold, near 0 cached.
- Pitch pack (Sonnet 5.5 high): about $0.03.
