# Development and operations

## Local setup

Requirements: Node 22+, pnpm 10, Postgres 16+.

```bash
pnpm install
cp .env.example .env     # QLOO_API_KEY, QLOO_API_URL, CLAUDE_API_KEY, DATABASE_URL
pnpm db:migrate
pnpm dev                 # web http://localhost:3000, api http://localhost:8787
```

On the current dev machine the database is the `dev-postgres` container, which runs **on the server** under the rootless Docker daemon (Docker context `dev-host`, which is this machine's active context). It publishes `127.0.0.1:15432` on the server; reach it locally through an SSH tunnel:

```bash
ssh -N -L 15432:127.0.0.1:15432 dev-host      # keep running while you develop
```

If the server rebooted, start the container first: `docker --context dev-host start dev-postgres`. Local Docker Desktop is not used. Port 5433 is a different tunnel, not Postgres.

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
| `AGENT_MODEL`, `AGENT_EFFORT`, `AGENT_TOOLSET` | `claude-haiku-5-5`, `high`, `business` | see `docs/BAKEOFF.md` |
| `PITCH_MODEL` | `claude-sonnet-5-5` | |
| `RUN_TOOL_CALL_LIMIT` | 30 | raw toolset gets 2× |
| `RUN_QLOO_CALL_LIMIT` | 120 | network calls per run |
| `RUN_TOKEN_BUDGET` | 600000 | cached reads count at 10% |
| `CACHE_TTL_HOURS` | 24 | Qloo response cache |
| `PRESET_CACHE_HOURS` | 24 | how long "Open" serves a preset's last run (720 in production) |
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

https://overlap.u.co.uz, on `prod-host` (SERVER_IP) in `/srv/overlap`.

- **DNS:** A record `overlap` → SERVER_IP in the u.co.uz zone (the DNS provider DNS manager).
- **Proxy:** host Apache, vhost from `deploy/apache/overlap.u.co.uz.conf`; certbot `--apache` added the :443 vhost and the redirect (auto-renewed by the certbot timer). `/api/*` → `127.0.0.1:3071`, everything else → `127.0.0.1:3070`.
- **Stack:** `docker compose up -d --build` with the server's `.env` (`DOMAIN=overlap.u.co.uz`, `PRESET_CACHE_HOURS=720`). The API container applies migrations on start. Postgres has no host port.
- **Auto deploy:** every push to `main` (except docs/Markdown/brand) runs `.github/workflows/deploy.yml`: typecheck, then SSH with a deploy key whose `authorized_keys` entry is `restrict,command="/srv/overlap/scripts/deploy.sh"`. The script fast-forwards to `origin/main`, rebuilds and waits for health. Secrets: `PROD_SSH_KEY`, `PROD_KNOWN_HOSTS` (environment `production`). Run by hand: Actions tab → Deploy to prod → Run workflow, or `ssh prod-host /srv/overlap/scripts/deploy.sh`.
- The demo must stay up through judging (Nov 2–16, 2026). Presets stay cached for 30 days on the server; re-warm with `docker compose exec api pnpm exec tsx src/scripts/run-agent.ts <presetId>`.

## Cost reference

- Agent run (Haiku 5.5 high): about $0.007–0.017 and 20–50 Qloo calls cold, near 0 cached.
- Pitch pack (Sonnet 5.5 high): about $0.03.
