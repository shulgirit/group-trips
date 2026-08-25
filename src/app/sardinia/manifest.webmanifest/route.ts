import { NextResponse } from "next/server";

/** Installable PWA manifest for the Sardinia trip (its own start_url). */
export function GET() {
  return NextResponse.json(
    {
      name: "סרדיניה 2026",
      short_name: "סרדיניה",
      description: "אפליקציית הטיול הפרטית שלנו בסרדיניה — חוגגים 60",
      lang: "he",
      dir: "rtl",
      start_url: "/sardinia",
      display: "standalone",
      background_color: "#fbf8f1",
      theme_color: "#fbf8f1",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
