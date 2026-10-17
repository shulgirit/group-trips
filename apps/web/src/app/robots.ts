import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://togethergroup.app";
// Only the production domain is crawlable (dev/preview domains are not togethergroup.app)
const isProduction = new URL(siteUrl).hostname === "togethergroup.app";

export default function robots(): MetadataRoute.Robots {
  return isProduction
    ? { rules: { userAgent: "*", allow: ["/welcome", "/privacy", "/terms"], disallow: ["/api/", "/t/", "/trips", "/new", "/account", "/j/"] }, sitemap: `${siteUrl}/sitemap.xml` }
    : { rules: { userAgent: "*", disallow: "/" } };
}
