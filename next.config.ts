import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The desktop app (desktop/) runs this server itself, so it needs the self-contained build.
  output: process.env.DESKTOP_BUILD ? "standalone" : undefined,
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  partialPrefetching: true,
  experimental: {
    // Studio pages render only after browser storage loads, so validate instant navigation only where opted in.
    instantInsights: { validationLevel: "manual-warning" },
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
