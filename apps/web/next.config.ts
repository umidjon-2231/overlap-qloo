import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo: trace from the repository root so the standalone build includes workspace packages.
  // Builds run from apps/web (pnpm --filter), so the root is two levels up.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace package shipped as TypeScript source.
  transpilePackages: ["@overlap/shared"],
  output: "standalone",
  // Dev only: API_PROXY_TARGET=https://overlap.u.co.uz/api serves /api/* from another API (same origin, no CORS),
  // for working on the UI without a local database. Pair with NEXT_PUBLIC_API_URL=http://localhost:3000/api.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/api/:path*", destination: `${target}/:path*` }] : [];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
