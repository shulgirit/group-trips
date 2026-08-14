import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "מפה" };

export default function MapPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">מפה</h1>
      <EmptyState
        emoji="🗺️"
        title="המפה תופיע כאן"
        description="נציג את הוילה, כל המקומות השמורים והלו״ז על מפה אינטראקטיבית — ברגע שנחבר מפתח Google Maps."
      />
    </div>
  );
}
