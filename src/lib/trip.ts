/**
 * Static trip configuration used before Firestore is connected.
 * Once the trip document exists in Firestore, these values become the
 * fallback/seed values only. Dates are placeholders until Omer confirms them.
 */
export const TRIP = {
  id: "sicily-2026",
  name: "סיציליה 2026",
  heroTitle: "סיציליה מחכה לנו 🇮🇹",
  /** ISO date strings, local time in Sicily */
  startDate: "2026-10-11T00:00:00+02:00",
  endDate: "2026-10-18T23:59:59+02:00",
  currency: "EUR",
  villa: {
    name: "הוילה שלנו",
    address: "",
    lat: null as number | null,
    lng: null as number | null,
  },
} as const;

export const FAMILY_NAMES = [
  "משפחת טל",
  "משפחת בן חמו",
  "משפחת בן ארי",
  "משפחת גדות",
] as const;
