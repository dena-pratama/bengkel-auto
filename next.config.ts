import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mandiri untuk Docker di Coolify (lihat Dockerfile)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Jangan tulis argumen server action ke log dev (bisa berisi password)
  logging: { serverFunctions: false },
  turbopack: {
    // Ada package-lock.json lain di folder home; kunci root ke proyek ini
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
