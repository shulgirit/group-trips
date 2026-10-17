"use client";

import { Users } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { SURFACE } from "@/components/settings/SettingsGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale, useT } from "@/i18n";
import { useFamilies } from "@/lib/hooks";
import type { FamilyMember } from "@together/shared/types";

/** Family identity colors (data, not decoration): dot + avatar tint. */
const FAMILY_TONE: Record<string, { dot: string; avatar: string }> = {
  sea: { dot: "bg-sea-700", avatar: "bg-sea-100 text-sea-900" },
  terra: { dot: "bg-terra-500", avatar: "bg-terra-100 text-terra-600" },
  lemon: { dot: "bg-lemon-400", avatar: "bg-brass-100 text-brass-600" },
  olive: { dot: "bg-olive-500", avatar: "bg-route-100 text-route-700" },
};

/** Members written by the self-serve creator carry `kid: true`. */
type Member = FamilyMember & { kid?: boolean };

export default function FamiliesPage() {
  const { families, loading } = useFamilies();
  const { profile } = useSession();
  const trip = useTrip();
  const t = useT();
  const { locale } = useLocale();

  const all = (families ?? []).flatMap((f) =>
    (f.members as Member[]).map((m) => ({ ...m, tone: FAMILY_TONE[f.color] ?? FAMILY_TONE.sea })),
  );
  const travelers = all.length;
  const kids = all.filter((m) => m.kid).length;

  return (
    <div className="space-y-7">
      <div>
        <p className="kicker text-ink-500">
          <bdi>{trip.name}</bdi>
        </p>
        <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
          {trip.group.pageTitle}
        </h1>
      </div>

      {loading ? (
        <div aria-busy className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      ) : !families || families.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("settings.families.emptyTitle")}
          description={t("settings.families.emptyText")}
        />
      ) : (
        <>
          {/* The whole group at a glance */}
          <div className="flex items-center gap-4">
            <span className="flex shrink-0" aria-hidden>
              {all.slice(0, 6).map((m) => (
                <span
                  key={m.id}
                  className={`-ms-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-cream-50 text-sm font-medium first:ms-0 ${m.tone.avatar}`}
                >
                  {m.name.slice(0, 1)}
                </span>
              ))}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ink-900">
                {t("settings.families.travelers", { count: travelers })}
                {kids > 0 && (
                  <span className="font-normal text-ink-500">
                    {" · "}
                    {t("settings.families.kids", { count: kids })}
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-500">
                {families.length} {trip.group.unitLabel.toLocaleLowerCase(locale)}
                <bdi>{trip.group.summarySuffix}</bdi>
              </p>
            </div>
          </div>

          <ul className="grid gap-3 md:grid-cols-2">
            {families.map((family) => {
              const tone = FAMILY_TONE[family.color] ?? FAMILY_TONE.sea;
              const members = family.members as Member[];
              const familyKids = members.filter((m) => m.kid).length;
              const mine = profile?.familyId === family.id;
              return (
                <li key={family.id} className={`${SURFACE} p-4`}>
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                    <h2 className="min-w-0 flex-1 truncate font-display text-xl font-medium text-ink-900">
                      <bdi>{family.name}</bdi>
                    </h2>
                    {mine && (
                      <span className="shrink-0 rounded-full bg-route-100 px-2.5 py-0.5 text-xs font-medium text-route-700">
                        {t("settings.families.yours")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 ps-5 text-xs text-ink-500">
                    {t("settings.families.travelers", { count: members.length })}
                    {familyKids > 0 && ` · ${t("settings.families.kids", { count: familyKids })}`}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {members.map((member) => {
                      const me = profile?.memberId === member.id;
                      return (
                        <li
                          key={member.id}
                          className={`flex min-h-11 items-center gap-2 rounded-full py-1 pe-3.5 ps-1 ${
                            me ? "bg-white ring-1 ring-route-300" : "bg-cream-50"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${tone.avatar}`}
                          >
                            {member.name.slice(0, 1)}
                          </span>
                          <span className="text-sm text-ink-900">
                            <bdi>{member.name}</bdi>
                          </span>
                          {member.kid && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-ink-500 ring-1 ring-cream-200">
                              {t("settings.families.kid")}
                            </span>
                          )}
                          {me && (
                            <span className="text-xs font-medium text-route-700">
                              {t("settings.families.you")}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
