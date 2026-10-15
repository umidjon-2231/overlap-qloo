# Overlap

> Tell us your tour. We tell you which brands to pitch, in which cities, and why.

Sell-side sponsorship agent for artist tours and festivals, grounded in Qloo's taste graph. Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). See `PRODUCT.md` for the spec.

## Layout

```
apps/api         Hono API: Claude agent loop, Qloo REST layer, Postgres (Drizzle)
apps/web         Next.js frontend
packages/shared  Types shared by api and web
```

## Setup

Requires Node 22+, pnpm 10, Postgres 16+.

```bash
pnpm install
cp .env.example .env          # fill in QLOO_API_KEY, CLAUDE_API_KEY, DATABASE_URL
pnpm db:migrate               # create tables
pnpm dev                      # api on :8787, web on :3000
```

Keys live only in the root `.env`, read by the API. The browser never sees them. Qloo responses are cached in Postgres at runtime and never committed.

## License

MIT
