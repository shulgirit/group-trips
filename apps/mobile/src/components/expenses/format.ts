import { activeLocale } from "@together/i18n/active";
import { formatNumber } from "@together/i18n/format";
import { currencySymbol, type Currency } from "@together/shared/currency";

/** "€1,250" in the UI language's digits (rendered LTR by the caller's text). */
export function formatAmount(amount: number, currency: Currency): string {
  return `⁦${currencySymbol(currency)}${formatNumber(amount, activeLocale())}⁩`;
}
