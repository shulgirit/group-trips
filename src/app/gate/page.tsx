import type { Metadata } from "next";
import { GateScreen } from "@/components/gate/GateScreen";

export const metadata: Metadata = {
  title: "כניסה",
};

export default function GatePage() {
  return <GateScreen tripKey="sicily" />;
}
