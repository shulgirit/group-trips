import type { Metadata } from "next";
import { GateScreen } from "@/components/gate/GateScreen";
import { requestLocale } from "@/i18n/server";
import { translate } from "@together/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate(await requestLocale(), "settings.gate.title") };
}

export default function GatePage() {
  return <GateScreen tripKey="sicily" />;
}
