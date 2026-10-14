/**
 * Who runs the service. Today: a sole proprietor (עוסק פטור) trading as
 * "טל פיתוח". An עוסק is not a separate legal entity — the owner is the
 * operator. When a company (בע״מ) is formed, switch `kind` to "company"
 * and fill in its details — both languages of the Privacy Policy and
 * Terms update automatically. Have both documents reviewed by a lawyer.
 */
export const OPERATOR: {
  kind: "individual" | "sole-proprietor" | "company";
  /** Full legal name — the owner's name, or the registered company name */
  legalName: { en: string; he: string };
  /** Trading name of a sole proprietor */
  businessName: { en: string; he: string } | null;
  /** Company number, or the עוסק number for a sole proprietor */
  registrationNumber: string | null;
  /** Individual: city and country. Company: registered address. */
  location: { en: string; he: string };
  privacyEmail: string;
  supportEmail: string;
  effectiveDate: { en: string; he: string };
  minimumAge: number;
} = {
  kind: "sole-proprietor",
  legalName: { en: "Omer Tal", he: "עומר טל" },
  businessName: { en: "Tal Development", he: "טל פיתוח" },
  registrationNumber: null,
  location: { en: "Tel Aviv, Israel", he: "תל אביב, ישראל" },
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
    return `${O.legalName[locale]}${reg}, ${O.location[locale]}`;
  }
  if (O.kind === "sole-proprietor" && O.businessName) {
    const no = O.registrationNumber;
    return locale === "en"
      ? `${O.legalName.en}, doing business as ${O.businessName.en} (${O.businessName.he}), an Israeli exempt dealer${no ? ` (no. ${no})` : ""}, ${O.location.en}`
      : `${O.legalName.he}, בשם העסקי ״${O.businessName.he}״ (עוסק פטור${no ? ` מס׳ ${no}` : ""}), ${O.location.he}`;
  }
  return locale === "en"
    ? `${O.legalName.en}, an individual based in ${O.location.en}`
    : `${O.legalName.he}, אדם פרטי, ${O.location.he}`;
}
