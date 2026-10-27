import type { NextConfig } from "next";

// Desktop builds bundle a self-contained server (see scripts/build-desktop.mjs).
const desktop = process.env.KORASA_DESKTOP === "1";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The dev badge sits over the sidebar footer; build errors still surface as overlays.
  devIndicators: false,
  partialPrefetching: true,
  output: desktop ? "standalone" : undefined,
  // Never trace local user data or build artefacts into the server bundle.
  outputFileTracingExcludes: {
    "*": [
      ".git/**",
      "data/**",
      "dist-desktop/**",
      "desktop/**",
      "landing/**",
      "scripts/**",
      "*.{md,jpeg,png,yml,mjs,tsbuildinfo}",
      "{components,skills-lock,tsconfig}.json",
      "{next,prisma}.config.ts",
      "node_modules/{sharp,@img}/**",
    ],
  },
  // Prisma loads its SQLite query compiler dynamically, which tracing can't see.
  outputFileTracingIncludes: {
    "*": ["node_modules/@prisma/client/runtime/query_compiler_*_bg.sqlite*"],
  },
  // Everything is served locally; no image optimisation service (or sharp) needed.
  images: { unoptimized: true },
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
