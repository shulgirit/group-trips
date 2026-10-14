/**
 * Who runs the service. Today: a private individual. When a company is
 * formed, switch `kind` to "company" and fill in its details — both
 * languages of the Privacy Policy and Terms update automatically.
 * Have both documents reviewed by a lawyer.
 */
export const OPERATOR: {
  kind: "individual" | "company";
  /** Full legal name — the person's name, or the registered company name */
  legalName: string;
  /** Company number (company only) */
  registrationNumber: string | null;
  /** Individual: city and country. Company: registered address. */
  location: { en: string; he: string };
  privacyEmail: string;
  supportEmail: string;
  effectiveDate: { en: string; he: string };
  minimumAge: number;
} = {
  kind: "individual",
  legalName: "[Your full name]",
  registrationNumber: null,
  location: { en: "[City], Israel", he: "[עיר], ישראל" },
  privacyEmail: "privacy@togethertrips.app",
  supportEmail: "support@togethertrips.app",
  effectiveDate: { en: "October 14, 2026", he: "14 באוקטובר 2026" },
  minimumAge: 16,
};

/** "Jane Doe, an individual based in Tel Aviv, Israel" / "Acme Ltd. (registration no. 5…), address" */
export function operatorIdentity(locale: "en" | "he"): string {
  const O = OPERATOR;
  if (O.kind === "company") {
    const reg = O.registrationNumber
      ? locale === "en"
        ? ` (registration no. ${O.registrationNumber})`
        : ` (מספר רישום ${O.registrationNumber})`
      : "";
    return `${O.legalName}${reg}, ${O.location[locale]}`;
  }
  return locale === "en"
    ? `${O.legalName}, an individual based in ${O.location.en}`
    : `${O.legalName}, אדם פרטי, ${O.location.he}`;
}
