import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Place images come from arbitrary sites (official sites, Google, AI
    // imports) — this is a private 15-person app, so allow any https host.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
