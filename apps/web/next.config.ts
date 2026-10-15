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
