import type { Metadata } from "next";
import { LegalPage } from "@/components/product/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

// DRAFT — have this reviewed by a lawyer before store submission.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="product.legal.privacy.title"
      sections={[
        {
          heading: "product.legal.privacy.collect.heading",
          body: [
            "product.legal.privacy.collect.p1",
            "product.legal.privacy.collect.p2",
            "product.legal.privacy.collect.p3",
            "product.legal.privacy.collect.p4",
          ],
        },
        {
          heading: "product.legal.privacy.use.heading",
          body: [
            "product.legal.privacy.use.p1",
            "product.legal.privacy.use.p2",
            "product.legal.privacy.use.p3",
          ],
        },
        {
          heading: "product.legal.privacy.visibility.heading",
          body: ["product.legal.privacy.visibility.p1"],
        },
        {
          heading: "product.legal.privacy.deletion.heading",
          body: ["product.legal.privacy.deletion.p1"],
        },
      ]}
    />
  );
}
