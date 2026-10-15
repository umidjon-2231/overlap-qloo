# Build context: repository root (see docker-compose.yml)
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@overlap/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 8787
# Apply migrations, then serve. tsx runs the TypeScript sources directly (incl. the shared workspace package).
CMD ["sh", "-c", "pnpm exec tsx src/db/migrate.ts && exec pnpm exec tsx src/server.ts"]
