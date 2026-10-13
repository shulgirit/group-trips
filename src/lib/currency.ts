/** ISO 4217 code ("EUR", "THB", …). Legacy trips only ever use EUR/ILS/USD. */
export type Currency = string;

/** The legacy trio — still the full list for Sicily/Sardinia. */
export const CURRENCIES: readonly Currency[] = ["EUR", "ILS", "USD"];

const KNOWN_SYMBOL: Record<string, string> = { EUR: "€", ILS: "₪", USD: "$" };
const KNOWN_LABEL: Record<string, string> = {
  EUR: "€ באירו",
  ILS: "₪ בשקלים",
  USD: "$ בדולרים",
};
const KNOWN_PAREN: Record<string, string> = {
  EUR: "(אירו)",
  ILS: "(שקלים)",
  USD: "(דולרים)",
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
    return new Intl.DisplayNames(["he"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencyLabel(code: Currency): string {
  return KNOWN_LABEL[code] ?? `${currencySymbol(code)} ${currencyName(code)}`;
}

export function currencyParen(code: Currency): string {
  return KNOWN_PAREN[code] ?? `(${currencyName(code)})`;
}

/**
 * Currencies offered when adding an expense: the stops' local currencies
 * first, then ₪/€/$. Legacy trips keep exactly €/₪/$.
 */
export function tripCurrencies(trip: {
  legacy: boolean;
  stops: { currency: string }[];
}): Currency[] {
  if (trip.legacy) return [...CURRENCIES];
  const ordered = [...trip.stops.map((s) => s.currency), "ILS", "EUR", "USD"];
  return ordered.filter((code, i) => /^[A-Z]{3}$/.test(code) && ordered.indexOf(code) === i);
}
