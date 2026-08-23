export type Currency = "EUR" | "ILS" | "USD";

export const CURRENCIES: readonly Currency[] = ["EUR", "ILS", "USD"];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: "€",
  ILS: "₪",
  USD: "$",
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  EUR: "€ באירו",
  ILS: "₪ בשקלים",
  USD: "$ בדולרים",
};

export const CURRENCY_PAREN: Record<Currency, string> = {
  EUR: "(אירו)",
  ILS: "(שקלים)",
  USD: "(דולרים)",
};
