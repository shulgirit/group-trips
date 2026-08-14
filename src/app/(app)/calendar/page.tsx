import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "לוח" };

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">לוח הטיול</h1>
      <EmptyState
        emoji="📅"
        title="הלו״ז עוד ריק"
        description="כאן ייבנה לוח הטיול: ימים, פעילויות, משתתפים — כולל פיצולים כשחלק הולכים לכדורגל וחלק למסעדה."
      />
    </div>
  );
}
