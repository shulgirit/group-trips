import type { Metadata, Viewport } from "next";
import { TripAppShell } from "@/components/layout/TripAppShell";

export const metadata: Metadata = {
  title: {
    default: "סרדיניה 2026",
    template: "%s · סרדיניה 2026",
  },
  description: "אפליקציית הטיול הפרטית שלנו בסרדיניה — חוגגים 60",
  applicationName: "סרדיניה 2026",
  manifest: "/sardinia/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "סרדיניה 2026",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf8f1",
};

export default function SardiniaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <TripAppShell tripKey="sardinia">{children}</TripAppShell>;
}
