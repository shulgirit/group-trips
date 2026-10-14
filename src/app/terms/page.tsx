import type { Metadata } from "next";
import { LegalPage } from "@/components/product/LegalPage";

export const metadata: Metadata = { title: "Terms of Use" };

// DRAFT — have this reviewed by a lawyer before store submission.
export default function TermsPage() {
  return (
    <LegalPage
      title="product.legal.terms.title"
      sections={[
        { heading: "product.legal.terms.service.heading", body: ["product.legal.terms.service.p1"] },
        { heading: "product.legal.terms.ai.heading", body: ["product.legal.terms.ai.p1"] },
        { heading: "product.legal.terms.content.heading", body: ["product.legal.terms.content.p1"] },
        { heading: "product.legal.terms.contact.heading", body: ["product.legal.terms.contact.p1"] },
      ]}
    />
  );
}
