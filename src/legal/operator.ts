/**
 * The legal entity behind the service. FILL THESE IN before store
 * submission — they appear in the Privacy Policy and Terms, in both
 * languages. Have both documents reviewed by a lawyer.
 */
export const OPERATOR = {
  /** Registered company or sole-proprietor name, e.g. "Example Ltd." */
  legalName: "[Operator legal name]",
  /** Company / ID number registered in Israel */
  registrationNumber: "[Company number]",
  /** Registered postal address */
  address: "[Registered address, Israel]",
  /** Privacy and data-protection contact */
  privacyEmail: "privacy@togethertrips.app",
  /** General support contact */
  supportEmail: "support@togethertrips.app",
  /** Date both documents take effect (shown on the pages) */
  effectiveDate: { en: "October 14, 2026", he: "14 באוקטובר 2026" },
  /** Minimum age to create an account */
  minimumAge: 16,
} as const;
