import type { Metadata } from "next";
import { GateScreen } from "@/components/gate/GateScreen";
import { requestLocale } from "@/i18n/server";
import { translate } from "@/i18n/translate";
import { TRIPS } from "@/lib/trips";

const SARDINIA = TRIPS.sardinia;

// Full PWA metadata here too — users often "add to home screen" straight
// from the gate, and without this iOS would take the Sicily name/manifest
// inherited from the root layout.
export async function generateMetadata(): Promise<Metadata> {
  const signIn = translate(await requestLocale(), "settings.gate.title");
  return {
    title: `${signIn} · ${SARDINIA.name}`,
    applicationName: SARDINIA.name,
    manifest: "/sardinia/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: SARDINIA.name,
    },
  };
}

export default function SardiniaGatePage() {
  return <GateScreen tripKey="sardinia" />;
}
