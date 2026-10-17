import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root: Turbopack resolves workspace packages and the pnpm store from here
const repoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  // Workspace packages ship TypeScript source
  transpilePackages: ["@together/i18n", "@together/integrations", "@together/shared"],
  outputFileTracingRoot: repoRoot,
  // The original Sicily/Sardinia URLs now live under their migrated trips
  async redirects() {
    const sicily = ["ai", "calendar", "map", "places", "polls", "expenses", "documents", "families", "more", "settings"];
    return [
      { source: "/sardinia", destination: "/t/sardinia-2026", permanent: false },
      { source: "/sardinia/:path*", destination: "/t/sardinia-2026/:path*", permanent: false },
      ...sicily.flatMap((section) => [
        { source: `/${section}`, destination: `/t/sicily-2026/${section}`, permanent: false },
        { source: `/${section}/:path*`, destination: `/t/sicily-2026/${section}/:path*`, permanent: false },
      ]),
      { source: "/gate", destination: "/welcome", permanent: false },
    ];
  },
  // iOS fetches the universal-links file without an extension — it must be JSON
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
  images: {
    // Place images come from arbitrary sites (official sites, Google, AI
    // imports) — this is a private 15-person app, so allow any https host.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
