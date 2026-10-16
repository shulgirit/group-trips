import ar from "./ar";
import en from "./en";
import es from "./es";
import he from "./he";

export type Messages = typeof he;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };
export type PartialMessages = DeepPartial<Messages>;

/** he = source of truth; en complete; ar/es translate what they cover and fall back to en. */
export const messages: { he: Messages; en: Messages; ar: PartialMessages; es: PartialMessages } = {
  he,
  en,
  ar,
  es,
};
