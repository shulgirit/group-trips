"use client";

import { Check, Minus, Plus } from "lucide-react";
import type { Family } from "@/types";
import { currencySymbol, type Currency } from "@/lib/currency";
import { activeTrip } from "@/lib/active-trip";
import { useTrip } from "@/components/providers/TripProvider";
import { STROKE } from "@/components/ui/Icon";
import { useLocale, useT } from "@/i18n";
import { tActive } from "@/i18n/active";
import { formatNumber } from "@/i18n/format";

/** Stored Hebrew family names start with "Family" (mishpachat) — drop it in tight UI. */
const FAMILY_PREFIX = "\u05DE\u05E9\u05E4\u05D7\u05EA ";

/** "The Tal family" → "Tal" for compact lists (data stays as stored). */
export function shortFamilyName(name: string): string {
  return name.replace(FAMILY_PREFIX, "");
}

/** Shared shape for the add/edit expense split UI. counts is sparse — a
 *  family without an entry defaults to its full size. */
export interface SplitState {
  everyone: boolean;
  participantIds: string[];
  byPeople: boolean;
  counts: Record<string, number>;
}

export const DEFAULT_SPLIT: SplitState = {
  everyone: true,
  participantIds: [],
  // Fair by default — one family has fewer people than the others
  byPeople: true,
  counts: {},
};

function participatingFamilies(
  families: Family[],
  split: SplitState
): Family[] {
  return split.everyone
    ? families
    : families.filter((f) => split.participantIds.includes(f.id));
}

function countFor(split: SplitState, family: Family): number {
  return split.counts[family.id] ?? family.members.length;
}

function totalPeople(families: Family[], split: SplitState): number {
  return participatingFamilies(families, split).reduce(
    (sum, family) => sum + countFor(split, family),
    0
  );
}

export function splitError(
  families: Family[],
  split: SplitState
): string | null {
  if (!split.everyone && split.participantIds.length === 0)
    return activeTrip().group.splitPickLabel;
  if (split.byPeople && totalPeople(families, split) <= 0)
    return tActive("money.split.needPerson");
  return null;
}

export function splitPayload(
  families: Family[],
  split: SplitState
): {
  participantFamilyIds: string[] | null;
  participantCounts?: Record<string, number>;
} {
  if (!split.byPeople) {
    return {
      participantFamilyIds: split.everyone ? null : split.participantIds,
      participantCounts: undefined,
    };
  }
  // Counts mode always writes explicit family ids matching the counts
  const counted = participatingFamilies(families, split).filter(
    (family) => countFor(split, family) > 0
  );
  return {
    participantFamilyIds: counted.map((family) => family.id),
    participantCounts: Object.fromEntries(
      counted.map((family) => [family.id, countFor(split, family)])
    ),
  };
}

export function SplitEditor({
  families,
  split,
  onChange,
  amount,
  currency,
}: {
  families: Family[];
  split: SplitState;
  onChange: (next: SplitState) => void;
  amount?: number;
  currency: Currency;
}) {
  const { group } = useTrip();
  const t = useT();
  const { locale } = useLocale();
  const participating = participatingFamilies(families, split);
  const total = totalPeople(families, split);

  function setCount(family: Family, next: number) {
    onChange({
      ...split,
      counts: {
        ...split.counts,
        [family.id]: Math.min(family.members.length, Math.max(0, next)),
      },
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => onChange({ ...split, everyone: !split.everyone })}
          className="flex items-center gap-2.5 text-sm text-ink-700"
        >
          <span
            aria-hidden
            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
              split.everyone
                ? "border-sea-700 bg-sea-700 text-cream-50"
                : "border-cream-300 bg-white"
            }`}
          >
            {split.everyone && <Check size={13} strokeWidth={2} aria-hidden />}
          </span>
          {group.splitEveryoneLabel}
        </button>
        {!split.everyone && (
          <div className="mt-3 flex flex-wrap gap-2">
            {families.map((family) => (
              <button
                key={family.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...split,
                    participantIds: split.participantIds.includes(family.id)
                      ? split.participantIds.filter((id) => id !== family.id)
                      : [...split.participantIds, family.id],
                  })
                }
                className={`rounded-2xl border px-4 py-2.5 text-sm transition ${
                  split.participantIds.includes(family.id)
                    ? "border-sea-700 bg-sea-700 text-cream-50"
                    : "border-cream-200 bg-white text-ink-700"
                }`}
              >
                {shortFamilyName(family.name)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => onChange({ ...split, byPeople: !split.byPeople })}
          className="flex items-center gap-2.5 text-sm text-ink-700"
        >
          <span
            aria-hidden
            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
              split.byPeople
                ? "border-sea-700 bg-sea-700 text-cream-50"
                : "border-cream-300 bg-white"
            }`}
          >
            {split.byPeople && <Check size={13} strokeWidth={2} aria-hidden />}
          </span>
          {t("money.split.byPeople")}
        </button>
        {split.byPeople && participating.length > 0 && (
          <div className="mt-3 divide-y divide-cream-200 rounded-2xl border border-cream-200 bg-cream-50 px-3">
            {participating.map((family) => (
              <div
                key={family.id}
                className="flex items-center justify-between py-2.5"
              >
                <span className="text-sm text-ink-700">
                  {shortFamilyName(family.name)}
                  <span className="text-ink-400">
                    {" · "}
                    {t("money.split.outOf", { count: family.members.length })}
                  </span>
                </span>
                <div
                  dir="ltr"
                  className="flex items-center gap-1 rounded-xl border border-cream-200 bg-white p-1"
                >
                  <button
                    type="button"
                    aria-label={t("money.split.fewer", { family: family.name })}
                    onClick={() =>
                      setCount(family, countFor(split, family) - 1)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-700 active:scale-95"
                  >
                    <Minus size={16} strokeWidth={STROKE} aria-hidden />
                  </button>
                  <span className="numerals w-8 text-center text-base tabular-nums text-ink-900">
                    {countFor(split, family)}
                  </span>
                  <button
                    type="button"
                    aria-label={t("money.split.more", { family: family.name })}
                    onClick={() =>
                      setCount(family, countFor(split, family) + 1)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-700 active:scale-95"
                  >
                    <Plus size={16} strokeWidth={STROKE} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
            <p className="py-2.5 text-sm text-ink-500">
              {t("money.split.totalPeople", { count: total })}
              {amount && total > 0 ? (
                <>
                  {" · ≈ "}
                  <span dir="ltr" className="numerals tabular-nums">
                    {currencySymbol(currency)}
                    {formatNumber(amount / total, locale, 1)}
                  </span>{" "}
                  {t("money.split.perPerson")}
                </>
              ) : null}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
