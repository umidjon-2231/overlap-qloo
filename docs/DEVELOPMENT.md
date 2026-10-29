# Development and operations

## Local setup

Requirements: Node 22+, pnpm 10, Postgres 16+.

```bash
pnpm install
cp .env.example .env     # QLOO_API_KEY, QLOO_API_URL, CLAUDE_API_KEY, DATABASE_URL
pnpm db:migrate
pnpm dev                 # web http://localhost:3000, api http://localhost:8787
```

Any Postgres 16+ works: a local install, a container, or a remote database through an SSH tunnel. Point `DATABASE_URL` at it.

Work is committed locally and verified on localhost; pushing to `main` deploys (see Production).

### 3D and motion assets

| Asset | Source | Rebuild |
|---|---|---|
| `apps/web/public/models/tour-bus.glb` | `brand/blender/tour_bus.py` | `blender -b -P brand/blender/tour_bus.py` |
| `apps/web/public/motion/screenprint-loop.{webm,mp4}`, poster | `brand/blender/screenprint_loop.py` | `blender -b -P brand/blender/screenprint_loop.py -- <dir> --render --transparent`, then encode (see the script header) |

Blender 5.2. The `.blend` files are not committed.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `QLOO_API_KEY`, `QLOO_API_URL` | – / hackathon URL | API only |
| `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) | – | API only |
| `DATABASE_URL` | – | set by compose in production |
| `AGENT_MODEL`, `AGENT_EFFORT`, `AGENT_TOOLSET` | `claude-haiku-5-5`, `high`, `business` | chosen by the bake-off (`pnpm bakeoff`) |
| `PITCH_MODEL` | `claude-sonnet-5-5` | |
| `RUN_TOOL_CALL_LIMIT` | 30 | raw toolset gets 2× |
| `RUN_QLOO_CALL_LIMIT` | 120 | network calls per run |
| `RUN_TOKEN_BUDGET` | 600000 | cached reads count at 10% |
| `CACHE_TTL_HOURS` | 24 | Qloo response cache |
| `PRESET_CACHE_HOURS` | 24 | how long "Open example" serves a preset's last run (720, i.e. 30 days, in production) |
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

https://overlap.u.co.uz: a single VPS running docker compose; GitHub Actions deploys on push to main.

- **Proxy:** Apache on the host terminates HTTPS (Let's Encrypt) and proxies `/api/*` to the API and everything else to the web app.
- **Stack:** `docker compose up -d --build` with the server's `.env` (`DOMAIN`, `POSTGRES_PASSWORD`, keys, `PRESET_CACHE_HOURS=720`). The API container applies migrations on start. Postgres has no host port.
- **Auto deploy:** every push to `main` (except docs/Markdown/brand) runs a GitHub Actions workflow: typecheck, then a deploy script on the server that fast-forwards to `main`, rebuilds and waits for health. (The workflow and server scripts are kept in the private deployment repository.)
- The demo must stay up through judging (Nov 2–16, 2026). Example runs stay cached for 30 days on the server; re-warm with `docker compose exec api pnpm exec tsx src/scripts/run-agent.ts <presetId>`.

## Public-demo protection

The Anthropic key lives in its own workspace with a console spend limit; that is the hard stop. Inside the app (`apps/api/src/demo/guard.ts`):

| Layer | Default | Over the limit |
|---|---|---|
| Model spend per rolling hour / UTC day / UTC month (estimated from token usage) | $3 / $10 / $30 | Live runs, new pitches and new comparisons pause (503, friendly message, home page notice); examples and finished results keep working |
| Uncached Qloo calls per UTC day | 1500 | Same pause (protects the monthly Qloo quota) |
| Per IP: runs / pitches per hour, guarded requests per day | 8 / 10, 30 | 429 |
| At once: runs / pitch drafts | 3 / 2 | 429 |
| Origin | the demo's own site | 403 |
| Pitches | a saved draft is reused unless "Write it again"; example pitches are read-only | 403 on rewrite/edit |
| Agent model | always the server default (`ALLOW_RUN_CONFIG=true` only for local experiments) | client choice ignored |

Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) gets one alert per period at 80% and 100% of each budget, and when the hourly cap trips. Per-IP counts and alerts are rows in `demo_events`, so they survive restarts. `GET /demo-status` tells the web app whether live runs are open (no amounts).

On the server, the fail2ban jail `overlap-abuse` (its config is kept with the private deployment files) bans an IP from ports 80/443 for a day after 10 refused (403/429) calls to `/api/runs…` within 10 minutes. 503s (the global pause) are not counted. `fail2ban-client status overlap-abuse` shows bans; `fail2ban-client set overlap-abuse unbanip <ip>` lifts one.

## Cost reference

- Agent run (Haiku 5.5 high): about $0.007–0.014 in Claude usage and 18–51 Qloo lookups per run (the production example runs' recorded `usage`, cost estimated from token counts; the bake-off measured $0.007–0.012). Qloo lookups served from the cache cost no quota.
- Pitch (Sonnet 5.5 high): about $0.03.
