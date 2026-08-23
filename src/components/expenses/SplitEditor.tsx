"use client";

import type { Family } from "@/types";

const CURRENCY_SYMBOL = { EUR: "€", ILS: "₪" } as const;

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
    return "בחרו אילו משפחות השתתפו";
  if (split.byPeople && totalPeople(families, split) <= 0)
    return "בחרו לפחות אדם אחד בחלוקה לפי אנשים";
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
  currency: "EUR" | "ILS";
}) {
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
    <div className="space-y-3">
      <div>
        <button
          type="button"
          onClick={() => onChange({ ...split, everyone: !split.everyone })}
          className="flex items-center gap-2 text-sm font-medium text-ink-700"
        >
          <span
            aria-hidden
            className={`flex h-6 w-6 items-center justify-center rounded-lg border text-sm ${
              split.everyone
                ? "border-sea-600 bg-sea-600 text-cream-50"
                : "border-cream-300 bg-white"
            }`}
          >
            {split.everyone ? "✓" : ""}
          </span>
          כולם השתתפו (כל המשפחות)
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
                className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                  split.participantIds.includes(family.id)
                    ? "bg-terra-500 text-cream-50"
                    : "bg-cream-100 text-ink-700"
                }`}
              >
                {family.name.replace("משפחת ", "")}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => onChange({ ...split, byPeople: !split.byPeople })}
          className="flex items-center gap-2 text-sm font-medium text-ink-700"
        >
          <span
            aria-hidden
            className={`flex h-6 w-6 items-center justify-center rounded-lg border text-sm ${
              split.byPeople
                ? "border-sea-600 bg-sea-600 text-cream-50"
                : "border-cream-300 bg-white"
            }`}
          >
            {split.byPeople ? "✓" : ""}
          </span>
          חלוקה לפי מספר אנשים 👥
        </button>
        {split.byPeople && participating.length > 0 && (
          <div className="mt-3 space-y-2.5 rounded-2xl bg-cream-100 p-3">
            {participating.map((family) => (
              <div
                key={family.id}
                className="flex items-center justify-between"
              >
                <span className="text-sm font-medium text-ink-700">
                  {family.name.replace("משפחת ", "")}
                  <span className="text-ink-400">
                    {" "}
                    · מתוך {family.members.length}
                  </span>
                </span>
                <div
                  dir="ltr"
                  className="flex items-center gap-1 rounded-xl bg-white p-1"
                >
                  <button
                    type="button"
                    aria-label={`פחות אנשים ממשפחת ${family.name}`}
                    onClick={() =>
                      setCount(family, countFor(split, family) - 1)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-100 text-lg font-bold text-ink-700 active:scale-95"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-base font-semibold tabular-nums text-ink-900">
                    {countFor(split, family)}
                  </span>
                  <button
                    type="button"
                    aria-label={`יותר אנשים ממשפחת ${family.name}`}
                    onClick={() =>
                      setCount(family, countFor(split, family) + 1)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-100 text-lg font-bold text-ink-700 active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <p className="pt-1 text-sm font-medium text-ink-500">
              סה״כ {total} אנשים
              {amount && total > 0 ? (
                <>
                  {" "}
                  · ≈{" "}
                  <span dir="ltr" className="tabular-nums">
                    {CURRENCY_SYMBOL[currency]}
                    {(amount / total).toLocaleString("he-IL", {
                      maximumFractionDigits: 1,
                    })}
                  </span>{" "}
                  לאדם
                </>
              ) : null}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
