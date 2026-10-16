import { NextResponse } from "next/server";
import { TRIPS } from "@together/shared/trips";

const SARDINIA = TRIPS.sardinia;

/** Installable PWA manifest for the Sardinia trip (its own start_url).
 *  A legacy Hebrew-speaking group, so the manifest stays he/rtl. */
export function GET() {
  return NextResponse.json(
    {
      name: SARDINIA.name,
      short_name: SARDINIA.shortName,
      description: SARDINIA.tagline,
      lang: "he",
      dir: "rtl",
      id: "/sardinia",
      start_url: "/sardinia",
      scope: "/sardinia",
      display: "standalone",
      background_color: "#f7f5f0",
      theme_color: "#f7f5f0",
      icons: [
        {
          src: "/icons/sardinia-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/sardinia-icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/icons/sardinia-icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
