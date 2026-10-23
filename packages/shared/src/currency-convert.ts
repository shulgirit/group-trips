import { type Currency, tripCurrencies } from "./currency";

/** Cached market rates: ILS per 1 unit of each currency (ILS: 1), as `rates.latest` returns them. */
export type IlsPer = Record<string, number>;

/**
 * The currency the combined settle-up is shown in: the organizer's choice, else the shekel when
 * it is offered (the app's home market), else the first offered currency.
 */
export function mainCurrencyOf(trip: {
  legacy: boolean;
  stops: { currency: string }[];
  currencies?: string[];
  mainCurrency?: string;
}): Currency {
  if (trip.mainCurrency && /^[A-Z]{3}$/.test(trip.mainCurrency)) return trip.mainCurrency;
  const offered = tripCurrencies(trip);
  return offered.includes("ILS") ? "ILS" : (offered[0] ?? "ILS");
}

/** True when `rate` is something we can multiply amounts by. */
export const isUsableRate = (rate: unknown): rate is number => typeof rate === "number" && Number.isFinite(rate) && rate > 0;

/**
 * Value of 1 unit of `code` in the main currency: the organizer's override when there is one,
 * else the cross rate from the market table. 0 = unknown (the caller asks for a manual rate).
 */
export function rateToMain(code: Currency, main: Currency, ilsPer: IlsPer | null | undefined, overrides?: Record<string, number>): number {
  if (code === main) return 1;
  const override = overrides?.[code];
  if (isUsableRate(override)) return override;
  const from = ilsPer?.[code];
  const to = ilsPer?.[main];
  return isUsableRate(from) && isUsableRate(to) ? from / to : 0;
}

/** Where a rate came from, for the "market / edited" badge. */
export function rateSource(code: Currency, main: Currency, overrides?: Record<string, number>): "same" | "edited" | "market" {
  if (code === main) return "same";
  return isUsableRate(overrides?.[code]) ? "edited" : "market";
}

/** "1 X = ? ₪" precision: ₪0.0011 per VND, ₪4.02 per €. */
export function formatRate(rate: number): string {
  if (!isUsableRate(rate)) return "";
  return rate >= 1 ? rate.toFixed(2) : rate.toPrecision(3);
}
