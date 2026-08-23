"use client";

import { useEffect, useMemo, useState } from "react";
import { calcCombinedBalances, calcSettlement } from "@/lib/settlement";
import type { Expense, Family } from "@/types";

function familyName(families: Family[], id: string): string {
  return families.find((f) => f.id === id)?.name.replace("משפחת ", "") ?? id;
}

function formatIls(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
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
    { ilsPerEur: number; ilsPerUsd: number; updatedAt: number } | "error" | null
  >(null);
  const [rateEurText, setRateEurText] = useState("");
  const [rateUsdText, setRateUsdText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/rates");
        // A stale session redirects to /gate with an HTML 200 — treat as failure
        const isJson = response.headers
          .get("content-type")
          ?.includes("application/json");
        if (!response.ok || !isJson) throw new Error("rates_unavailable");
        const data = (await response.json()) as {
          ilsPerEur: number;
          ilsPerUsd: number;
          updatedAt: number;
        };
        if (cancelled) return;
        setFetchedRates(data);
        setRateEurText((current) => current || data.ilsPerEur.toFixed(2));
        setRateUsdText((current) => current || data.ilsPerUsd.toFixed(2));
      } catch {
        if (!cancelled) setFetchedRates("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const combined = useMemo(() => {
    const hasEur = expenses.some((e) => e.currency === "EUR");
    const hasUsd = expenses.some((e) => e.currency === "USD");
    // ILS-only account needs no conversion
    if (!hasEur && !hasUsd) return null;
    const eur = Number(rateEurText);
    const usd = Number(rateUsdText);
    const ready = (!hasEur || eur > 0) && (!hasUsd || usd > 0);
    if (!ready) {
      return {
        hasEur,
        hasUsd,
        ready: false as const,
        balances: [],
        transfers: [],
      };
    }
    const balances = calcCombinedBalances(expenses, families, {
      ILS: 1,
      ...(hasEur ? { EUR: eur } : {}),
      ...(hasUsd ? { USD: usd } : {}),
    });
    return {
      hasEur,
      hasUsd,
      ready: true as const,
      balances,
      transfers: calcSettlement(balances),
    };
  }, [expenses, families, rateEurText, rateUsdText]);

  if (!combined) return null;

  return (
    <div className="mt-4 rounded-2xl bg-sea-950/45 p-3.5 backdrop-blur">
      <p className="mb-2 text-sm font-semibold text-lemon-200">
        🇮🇱 סגירת חשבון בשקלים
      </p>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        {combined.hasEur && (
          <label className="flex items-center gap-1.5">
            <span>€1 =</span>
            <input
              dir="ltr"
              inputMode="decimal"
              value={rateEurText}
              onChange={(e) => setRateEurText(e.target.value)}
              aria-label="שער אירו לשקל"
              className="w-16 rounded-lg bg-white/15 px-2 py-1 text-center tabular-nums text-white outline-none focus:bg-white/25"
            />
            <span>₪</span>
          </label>
        )}
        {combined.hasUsd && (
          <label className="flex items-center gap-1.5">
            <span>$1 =</span>
            <input
              dir="ltr"
              inputMode="decimal"
              value={rateUsdText}
              onChange={(e) => setRateUsdText(e.target.value)}
              aria-label="שער דולר לשקל"
              className="w-16 rounded-lg bg-white/15 px-2 py-1 text-center tabular-nums text-white outline-none focus:bg-white/25"
            />
            <span>₪</span>
          </label>
        )}
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
