import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://togethergroup.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/welcome", "/support", "/privacy", "/terms"].map((path) => ({ url: `${siteUrl}${path}`, changeFrequency: "monthly" as const }));
}
