import type { Metadata, Viewport } from "next";
import { TripAppShell } from "@/components/layout/TripAppShell";
import { TRIPS } from "@together/shared/trips";

const SARDINIA = TRIPS.sardinia;

export const metadata: Metadata = {
  title: {
    default: SARDINIA.name,
    template: `%s · ${SARDINIA.name}`,
  },
  description: SARDINIA.tagline,
  applicationName: SARDINIA.name,
  manifest: "/sardinia/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SARDINIA.name,
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
};

export default function SardiniaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <TripAppShell tripKey="sardinia">{children}</TripAppShell>;
}
