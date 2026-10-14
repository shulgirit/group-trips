"use client";

import { useEffect, useMemo, useState } from "react";
import { calcCombinedBalances, calcSettlement } from "@/lib/settlement";
import type { Expense, Family } from "@/types";
import { apiFetch } from "@/lib/firebase/client";
import { currencyName, currencySymbol } from "@/lib/currency";
import { ArrowRight } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { shortFamilyName } from "@/components/expenses/SplitEditor";
import { useLocale, useT } from "@/i18n";
import { activeLocale } from "@/i18n/active";
import { formatNumber, intlLocale } from "@/i18n/format";

function familyName(families: Family[], id: string): string {
  const name = families.find((f) => f.id === id)?.name;
  return name ? shortFamilyName(name) : id;
}

function formatIls(amount: number): string {
  return `₪${formatNumber(amount, activeLocale())}`;
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
  const t = useT();
  const { locale } = useLocale();

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
    <div className="mt-5 border-t border-white/15 pt-4">
      <p className="kicker mb-2 text-lemon-200">{t("money.ils.title")}</p>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        {foreign.map((code) => {
          const current = rateFor(code);
          return (
            <label key={code} dir="ltr" className="flex items-center gap-1.5">
              <span>{currencySymbol(code)}1 =</span>
              <input
                dir="ltr"
                inputMode="decimal"
                value={rateText[code] ?? (current > 0 ? formatRate(current) : "")}
                onChange={(e) =>
                  setRateText((all) => ({ ...all, [code]: e.target.value }))
                }
                aria-label={t("money.ils.rateLabel", { currency: currencyName(code) })}
                className="numerals w-20 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-center tabular-nums text-white outline-none focus:bg-white/20"
              />
              <span>₪</span>
            </label>
          );
        })}
      </div>
      <p className="mb-3 text-xs text-sea-100">
        {fetchedRates === "error"
          ? t("money.ils.rateUnavailable")
          : fetchedRates
            ? t("money.ils.marketRate", {
                date: new Date(fetchedRates.updatedAt).toLocaleDateString(
                  intlLocale(locale),
                  { day: "numeric", month: "numeric" }
                ),
              })
            : t("money.ils.loadingRate")}
      </p>
      {combined.ready ? (
        <>
          <div className="space-y-1.5">
            {combined.balances
              .filter((balance) => Math.abs(balance.balance) >= 1)
              .map((balance) => (
                <p
                  key={balance.familyId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{familyName(families, balance.familyId)}</span>
                  {balance.balance >= 0 ? (
                    <span className="text-lemon-200">
                      {t("money.owed")}{" "}
                      <bdi dir="ltr" className="numerals tabular-nums">
                        {formatIls(balance.balance)}
                      </bdi>
                    </span>
                  ) : (
                    <span className="text-terra-100">
                      {t("money.owes")}{" "}
                      <bdi dir="ltr" className="numerals tabular-nums">
                        {formatIls(-balance.balance)}
                      </bdi>
                    </span>
                  )}
                </p>
              ))}
          </div>
          {combined.transfers.length > 0 && (
            <div className="mt-3 border-t border-white/15 pt-3">
              <p className="kicker mb-1.5 text-lemon-200">
                {t("money.ils.finalTransfers")}
              </p>
              {combined.transfers.map((transfer, i) => (
                <p
                  key={i}
                  className="flex items-center justify-between py-0.5 text-sm"
                >
                  <span className="flex items-center gap-1.5">
                    {familyName(families, transfer.fromFamilyId)}
                    <ArrowRight
                      size={14}
                      strokeWidth={STROKE}
                      aria-label={t("money.pays")}
                      className="rtl:rotate-180"
                    />
                    {familyName(families, transfer.toFamilyId)}
                  </span>
                  <b dir="ltr" className="numerals font-medium tabular-nums">
                    {formatIls(transfer.amount)}
                  </b>
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-sea-100">{t("money.ils.enterRate")}</p>
      )}
    </div>
  );
}
