import { activeLocale } from "@/i18n/active";
import { formatDayLabel as formatDay } from "@/i18n/format";
/** All trip days as ISO date strings (YYYY-MM-DD), inclusive. */
export function tripDays(
  trip: { startDate: string; endDate: string }
): string[] {
  const days: string[] = [];
  const current = new Date(`${trip.startDate}T12:00:00`);
  const last = new Date(`${trip.endDate}T12:00:00`);
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
export function tripDayNumber(
  dateIso: string,
  trip: { startDate: string; endDate: string }
): number | null {
  const days = tripDays(trip);
  const index = days.indexOf(dateIso);
  return index === -1 ? null : index + 1;
}


/** "שבת · 15.8" / "Saturday · 15.8" in the active UI language. */
export function formatDayLabel(dateIso: string): string {
  return formatDay(dateIso, activeLocale());
}
