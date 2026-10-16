import type { Metadata } from "next";
import { LegalPage } from "@/components/product/LegalPage";

export const metadata: Metadata = { title: "Terms of Use" };

// Content lives in src/legal — fill in src/legal/operator.ts and have a lawyer review.
export default function TermsPage() {
  return <LegalPage doc="terms" />;
}
