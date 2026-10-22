import { activeLocale } from "@together/i18n/active";

/** ISO 4217 code ("EUR", "THB", …). Legacy trips only ever use EUR/ILS/USD. */
export type Currency = string;

/** The legacy trio — still the full list for Sicily/Sardinia. */
export const CURRENCIES: readonly Currency[] = ["EUR", "ILS", "USD"];

// Hermes has no currency data in Intl, so the common ones are spelled out
const KNOWN_SYMBOL: Record<string, string> = {
  EUR: "€", ILS: "₪", USD: "$", GBP: "£", JPY: "¥", CNY: "¥", KRW: "₩", INR: "₹", TRY: "₺", THB: "฿", VND: "₫",
  PLN: "zł", CZK: "Kč", HUF: "Ft", AED: "DH", EGP: "E£", JOD: "JD", MXN: "$", CAD: "C$", AUD: "A$", SGD: "S$",
  HKD: "HK$", BRL: "R$", ZAR: "R", SEK: "kr", NOK: "kr", DKK: "kr", RON: "lei", GEL: "₾", MAD: "MAD", IDR: "Rp",
  ARS: "$", COP: "$", PEN: "S/",
};

const symbolCache = new Map<string, string>();

/** "€", "₪", "฿", "CHF" … */
export function currencySymbol(code: Currency): string {
  if (KNOWN_SYMBOL[code]) return KNOWN_SYMBOL[code];
  const cached = symbolCache.get(code);
  if (cached) return cached;
  let symbol = code;
  try {
    symbol =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? code;
  } catch {
    // unknown code — show it as is
  }
  symbolCache.set(code, symbol);
  return symbol;
}

/** Hebrew currency name ("פרנק שווייצרי"). */
export function currencyName(code: Currency): string {
  try {
    return new Intl.DisplayNames([activeLocale()], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "€ Euro" / "€ אירו" */
export function currencyLabel(code: Currency): string {
  return `${currencySymbol(code)} ${currencyName(code)}`;
}

export function currencyParen(code: Currency): string {
  return `(${currencyName(code)})`;
}

/**
 * Currencies offered when adding an expense: the stops' local currencies
 * first, then ₪/€/$. Legacy trips keep exactly €/₪/$.
 */
export function tripCurrencies(trip: {
  legacy: boolean;
  stops: { currency: string }[];
  /** The organizer's chosen currencies; when set, these are the only ones offered */
  currencies?: string[];
}): Currency[] {
  if (trip.legacy) return [...CURRENCIES];
  const ordered = trip.currencies?.length ? trip.currencies : [...trip.stops.map((s) => s.currency), "ILS"];
  return ordered.filter((code, i) => /^[A-Z]{3}$/.test(code) && ordered.indexOf(code) === i);
}

/** What the picker offers: the shekel, the dollar and euro, the pound, the Gulf and the usual travel destinations. */
export const POPULAR_CURRENCIES: readonly Currency[] = [
  "ILS", "USD", "EUR", "GBP", "AED", "JPY", "MXN", "THB", "CHF", "TRY",
  "CAD", "AUD", "CZK", "PLN", "HUF", "EGP", "JOD", "INR", "CNY", "KRW",
  "BRL", "ZAR", "SEK", "NOK", "DKK", "RON", "GEL", "MAD", "SGD", "HKD",
  "VND", "IDR", "ARS", "COP", "PEN",
];
