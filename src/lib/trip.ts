/**
 * Static trip configuration (fallback/seed values).
 * The canonical copy lives in Firestore at trips/sicily-2026.
 */
export const TRIP = {
  id: "sicily-2026",
  name: "סיציליה 2026",
  heroTitle: "סיציליה מחכה לנו 🇮🇹",
  /** Departure flight from TLV, Israel time */
  countdownTarget: "2026-08-15T21:35:00+03:00",
  /** Trip calendar days (local dates) */
  startDate: "2026-08-15",
  endDate: "2026-08-24",
  currency: "EUR",
  villa: {
    name: "הוילה — קסטלמארה דל גולפו",
    address:
      "Contrada Bocca della Carrubba, 1, 91014 Castellammare del Golfo TP, Italy",
    lat: 38.0140133 as number | null,
    lng: 12.8876269 as number | null,
  },
} as const;

/** All trip days as ISO date strings (YYYY-MM-DD), inclusive. */
export function tripDays(): string[] {
  const days: string[] = [];
  const current = new Date(`${TRIP.startDate}T12:00:00`);
  const last = new Date(`${TRIP.endDate}T12:00:00`);
  while (current <= last) {
    days.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/** Today's ISO date (device local time). */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** 1-based trip day number for a date, or null outside the trip. */
export function tripDayNumber(dateIso: string): number | null {
  const days = tripDays();
  const index = days.indexOf(dateIso);
  return index === -1 ? null : index + 1;
}

export function isDuringTrip(): boolean {
  const today = todayIso();
  return today >= TRIP.startDate && today <= TRIP.endDate;
}

const DAY_NAMES = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
] as const;

export function formatDayLabel(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00`);
  return `${DAY_NAMES[date.getDay()]} · ${date.getDate()}.${date.getMonth() + 1}`;
}
