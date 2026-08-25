import type { Metadata } from "next";
import { GateScreen } from "@/components/gate/GateScreen";

export const metadata: Metadata = {
  title: "כניסה · סרדיניה 2026",
};

export default function SardiniaGatePage() {
  return <GateScreen tripKey="sardinia" />;
}
