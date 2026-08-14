"use client";

import { ListSkeleton } from "@/components/ui/Skeleton";
import { useFamilies } from "@/lib/hooks";

const FAMILY_COLORS: Record<string, string> = {
  sea: "from-sea-500 to-sea-700",
  terra: "from-terra-400 to-terra-600",
  lemon: "from-lemon-400 to-lemon-500",
  olive: "from-olive-500 to-sea-700",
};

export default function FamiliesPage() {
  const { families, loading } = useFamilies();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">
        👨‍👩‍👧‍👦 המשפחות
      </h1>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-3">
          {families?.map((family) => (
            <div
              key={family.id}
              className="overflow-hidden rounded-3xl border border-cream-200 bg-white"
            >
              <div
                className={`bg-gradient-to-l px-4 py-3 ${
                  FAMILY_COLORS[family.color] ?? FAMILY_COLORS.sea
                }`}
              >
                <h2 className="text-lg font-bold text-cream-50">
                  {family.name}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-3">
                {family.members.map((member) => (
                  <span
                    key={member.id}
                    className="rounded-full bg-cream-100 px-3.5 py-1.5 text-sm font-medium text-ink-700"
                  >
                    {member.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-sm text-ink-500">
        {families
          ? `${families.reduce((sum, f) => sum + f.members.length, 0)} מטיילים · ${families.length} משפחות · וילה אחת 🏡`
          : ""}
      </p>
    </div>
  );
}
