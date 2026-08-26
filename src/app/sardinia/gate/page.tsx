import type { Metadata } from "next";
import { GateScreen } from "@/components/gate/GateScreen";

// Full PWA metadata here too — users often "add to home screen" straight
// from the gate, and without this iOS would take the Sicily name/manifest
// inherited from the root layout.
export const metadata: Metadata = {
  title: "כניסה · סרדיניה 2026",
  applicationName: "סרדיניה 2026",
  manifest: "/sardinia/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "סרדיניה 2026",
  },
};

export default function SardiniaGatePage() {
  return <GateScreen tripKey="sardinia" />;
}
