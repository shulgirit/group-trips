import type { Metadata } from "next";
import { LegalPage } from "@/components/product/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

// Content lives in src/legal — fill in src/legal/operator.ts and have a lawyer review.
export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
