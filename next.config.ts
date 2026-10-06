import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every ops screen reads the session cookie and the database per request.
  // Cached components would force Suspense boundaries around all of it for no gain.
  cacheComponents: false,
  serverExternalPackages: ["sharp"],
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
