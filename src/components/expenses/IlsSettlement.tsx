"use client";

import { useEffect, useMemo, useState } from "react";
import { calcCombinedBalances, calcSettlement } from "@/lib/settlement";
import type { Expense, Family } from "@/types";
import { apiFetch } from "@/lib/firebase/client";
import { currencyName, currencySymbol } from "@/lib/currency";

function familyName(families: Family[], id: string): string {
  return families.find((f) => f.id === id)?.name.replace("משפחת ", "") ?? id;
}

function formatIls(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

/** Sensible precision for "1 X = ? ₪" (₪0.0011 per VND, ₪4.02 per €). */
function formatRate(rate: number): string {
  if (rate >= 1) return rate.toFixed(2);
  return rate.toPrecision(3);
}

/**
 * "Close the account in shekels" — converts every currency's balances to
 * ILS with live market rates (editable per device) and shows one final
 * transfer list. Pure display math; writes nothing.
 */
export function IlsSettlement({
  expenses,
  families,
}: {
  expenses: Expense[];
  families: Family[];
}) {
  const [fetchedRates, setFetchedRates] = useState<
    { ilsPer: Record<string, number>; updatedAt: number } | "error" | null
  >(null);
  /** Per-currency rate text the user may override */
  const [rateText, setRateText] = useState<Record<string, string>>({});

  const foreign = useMemo(
    () => [...new Set(expenses.map((e) => e.currency))].filter((c) => c !== "ILS"),
    [expenses]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch("/api/rates");
        // A stale session redirects to /gate with an HTML 200 — treat as failure
        const isJson = response.headers
          .get("content-type")
          ?.includes("application/json");
        if (!response.ok || !isJson) throw new Error("rates_unavailable");
        const data = (await response.json()) as {
          ilsPerEur: number;
          ilsPerUsd: number;
          ilsPer?: Record<string, number>;
          updatedAt: number;
        };
        if (cancelled) return;
        setFetchedRates({
          ilsPer: data.ilsPer ?? { ILS: 1, EUR: data.ilsPerEur, USD: data.ilsPerUsd },
          updatedAt: data.updatedAt,
        });
      } catch {
        if (!cancelled) setFetchedRates("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function rateFor(code: string): number {
    const typed = rateText[code];
    if (typed !== undefined) return Number(typed);
    return fetchedRates && fetchedRates !== "error" ? (fetchedRates.ilsPer[code] ?? 0) : 0;
  }

  const combined = useMemo(() => {
    // ILS-only account needs no conversion
    if (!foreign.length) return null;
    const rates: Record<string, number> = { ILS: 1 };
    for (const code of foreign) rates[code] = rateFor(code);
    const ready = foreign.every((code) => rates[code] > 0);
    if (!ready) return { ready: false as const, balances: [], transfers: [] };
    const balances = calcCombinedBalances(expenses, families, rates);
    return { ready: true as const, balances, transfers: calcSettlement(balances) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, families, foreign, rateText, fetchedRates]);

  if (!combined) return null;

  return (
    <div className="mt-4 rounded-2xl bg-sea-950/45 p-3.5 backdrop-blur">
      <p className="mb-2 text-sm font-semibold text-lemon-200">
        🇮🇱 סגירת חשבון בשקלים
      </p>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        {foreign.map((code) => {
          const current = rateFor(code);
          return (
            <label key={code} className="flex items-center gap-1.5">
              <span dir="ltr">{currencySymbol(code)}1 =</span>
              <input
                dir="ltr"
                inputMode="decimal"
                value={rateText[code] ?? (current > 0 ? formatRate(current) : "")}
                onChange={(e) =>
                  setRateText((all) => ({ ...all, [code]: e.target.value }))
                }
                aria-label={`שער ${currencyName(code)} לשקל`}
                className="w-20 rounded-lg bg-white/15 px-2 py-1 text-center tabular-nums text-white outline-none focus:bg-white/25"
              />
              <span>₪</span>
            </label>
          );
        })}
      </div>
      <p className="mb-2 text-xs text-sea-100">
        {fetchedRates === "error"
          ? "שער השוק לא זמין כרגע — הזינו שער ידנית"
          : fetchedRates
            ? `שער שוק · עדכון ${new Date(
                fetchedRates.updatedAt
              ).toLocaleDateString("he-IL", {
                day: "numeric",
                month: "numeric",
              })} · אפשר לערוך`
            : "טוען שער עדכני…"}
      </p>
      {combined.ready ? (
        <>
          <div className="space-y-1">
            {combined.balances
              .filter((balance) => Math.abs(balance.balance) >= 1)
              .map((balance) => (
                <p
                  key={balance.familyId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">
                    {familyName(families, balance.familyId)}
                  </span>
                  {balance.balance >= 0 ? (
                    <span className="font-semibold text-lemon-200">
                      מגיע {formatIls(balance.balance)}
                    </span>
                  ) : (
                    <span className="font-semibold text-terra-100">
                      חייבים {formatIls(-balance.balance)}
                    </span>
                  )}
                </p>
              ))}
          </div>
          {combined.transfers.length > 0 && (
            <div className="mt-2 border-t border-white/15 pt-2">
              <p className="mb-1 text-sm font-semibold text-lemon-200">
                ✓ העברות סופיות
              </p>
              {combined.transfers.map((transfer, i) => (
                <p
                  key={i}
                  className="flex items-center justify-between py-0.5 text-sm"
                >
                  <span>
                    {familyName(families, transfer.fromFamilyId)} ←{" "}
                    {familyName(families, transfer.toFamilyId)}
                  </span>
                  <b dir="ltr" className="tabular-nums">
                    {formatIls(transfer.amount)}
                  </b>
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-sea-100">הזינו שער כדי לחשב את הסיכום בשקלים</p>
      )}
    </div>
  );
}
