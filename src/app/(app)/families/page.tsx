"use client";

import { ListSkeleton } from "@/components/ui/Skeleton";
import { useFamilies } from "@/lib/hooks";
import { useTrip } from "@/components/providers/TripProvider";
import { useLocale, useT } from "@/i18n";

const FAMILY_DOT: Record<string, string> = {
  sea: "bg-sea-700",
  terra: "bg-terra-500",
  lemon: "bg-lemon-400",
  olive: "bg-olive-500",
};

export default function FamiliesPage() {
  const { families, loading } = useFamilies();
  const trip = useTrip();
  const t = useT();
  const { locale } = useLocale();

  const travelers = families?.reduce((sum, f) => sum + f.members.length, 0) ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-light text-ink-900">
        {trip.group.pageTitle}
      </h1>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-3">
          {families?.map((family) => (
            <div
              key={family.id}
              className="rounded-2xl border border-cream-200 bg-white"
            >
              <div className="flex items-center gap-2.5 border-b border-cream-200 px-4 py-3">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    FAMILY_DOT[family.color] ?? FAMILY_DOT.sea
                  }`}
                />
                <h2 className="font-display text-lg font-normal text-ink-900">
                  <bdi>{family.name}</bdi>
                </h2>
                <span className="ms-auto text-sm text-ink-500">
                  {family.members.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-3.5">
                {family.members.map((member) => (
                  <span key={member.id} className="chip text-ink-700">
                    <bdi>{member.name}</bdi>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-sm text-ink-500">
        {families
          ? `${t("settings.families.travelers", { count: travelers })} · ${
              families.length
            } ${trip.group.unitLabel.toLocaleLowerCase(locale)}${trip.group.summarySuffix}`
          : ""}
      </p>
    </div>
  );
}
