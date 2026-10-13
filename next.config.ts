import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
