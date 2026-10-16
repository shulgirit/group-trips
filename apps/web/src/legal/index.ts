import type { CompleteLocale } from "@together/i18n/config";
import privacyEn from "./privacy.en";
import privacyHe from "./privacy.he";
import termsEn from "./terms.en";
import termsHe from "./terms.he";
import type { LegalDoc } from "./types";

export const LEGAL_DOCS = {
  privacy: { en: privacyEn, he: privacyHe },
  terms: { en: termsEn, he: termsHe },
} satisfies Record<string, Record<CompleteLocale, LegalDoc>>;

export type LegalDocKey = keyof typeof LEGAL_DOCS;
export { OPERATOR } from "./operator";
export type { LegalBlock, LegalDoc, LegalSection } from "./types";
