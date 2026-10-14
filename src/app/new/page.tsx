import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatorWizard } from "@/components/creator/CreatorWizard";

export const metadata: Metadata = { title: "New trip" };

export default function NewTripPage() {
  return (
    <Suspense>
      <CreatorWizard />
    </Suspense>
  );
}
