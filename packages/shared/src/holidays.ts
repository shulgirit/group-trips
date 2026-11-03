/**
 * Turns phrases like "Pesach", "Easter", "Eid", "Chinese New Year" or "April" into an approximate date window, so the
 * planner never has to guess dates that follow an exact calendar (Hebrew, Western/Orthodox Easter, Chinese, Islamic).
 * Anything not covered here (Diwali, Carnival, São João, Thanksgiving, seasons: they depend on the destination's
 * hemisphere) is resolved by the model, which is told to find the next occurrence worldwide. Windows are approximate by
 * design: the person confirms real dates later.
 */

export interface DateWindow {
  /** ISO dates, inclusive */
  start: string;
  end: string;
  /** Short English name of what matched (shown to the model and in the UI) */
  label: string;
}

const DAY = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

const HEBREW = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Hebrew month name (English, ICU spelling) and day for a UTC calendar date. */
function hebrew(date: Date): { month: string; day: number } {
  const parts = HEBREW.formatToParts(date);
  return {
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
  };
}

/** Gregorian date of Western Easter Sunday (anonymous Gregorian computus). */
function westernEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month - 1, day);
}

/** Orthodox Easter Sunday (Julian computus, +13 days to the Gregorian calendar for 1900–2099). */
function orthodoxEaster(year: number): Date {
  const a = year % 4, b = year % 7, c = year % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return addDays(utc(year, month - 1, day), 13);
}

const numericParts = (calendar: string) => new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, { month: "numeric", day: "numeric", timeZone: "UTC" });
const CHINESE = numericParts("chinese");
const ISLAMIC = numericParts("islamic-umalqura");

/** First date on or after `from` that is `day` of numeric `month` in the given calendar formatter (Chinese months can carry a leap marker; those never equal 1). */
function nextNumeric(fmt: Intl.DateTimeFormat, from: Date, month: number, day: number): Date | null {
  for (let i = 0; i < 400; i++) {
    const date = addDays(from, i);
    const parts = fmt.formatToParts(date);
    if (Number(parts.find((p) => p.type === "month")?.value) === month && Number(parts.find((p) => p.type === "day")?.value) === day) return date;
  }
  return null;
}

/** First Gregorian date on or after `from` that falls on `day` of Hebrew `month` (ICU names: "Nisan", "Tishri", "Kislev", "Sivan"). */
function nextHebrewDate(from: Date, month: string, day: number): Date | null {
  for (let i = 0; i < 400; i++) {
    const date = addDays(from, i);
    const h = hebrew(date);
    if (h.month === month && h.day === day) return date;
  }
  return null;
}

type Build = (first: Date) => { start: Date; end: Date };

// The window people actually travel in: school break around the holiday, not the strict holiday days
const HOLIDAYS: { keys: RegExp; month: string; day: number; label: string; build: Build }[] = [
  { keys: /פסח|pesach|passover|pesah/i, month: "Nisan", day: 15, label: "Passover", build: (d) => ({ start: addDays(d, -1), end: addDays(d, 7) }) },
  { keys: /סוכות|sukkot|succot/i, month: "Tishri", day: 15, label: "Sukkot", build: (d) => ({ start: addDays(d, -1), end: addDays(d, 7) }) },
  { keys: /ראש השנה|rosh hashan[ah]|rosh hashanah/i, month: "Tishri", day: 1, label: "Rosh Hashanah", build: (d) => ({ start: addDays(d, -1), end: addDays(d, 2) }) },
  { keys: /חנוכה|hanukk?ah|chanukah/i, month: "Kislev", day: 25, label: "Hanukkah", build: (d) => ({ start: d, end: addDays(d, 7) }) },
  { keys: /שבועות|shavuot/i, month: "Sivan", day: 6, label: "Shavuot", build: (d) => ({ start: addDays(d, -1), end: addDays(d, 1) }) },
];

const MONTHS: { keys: RegExp; month: number; label: string }[] = [
  { keys: /ינואר|january|\bjan\b/i, month: 0, label: "January" },
  { keys: /פברואר|february|\bfeb\b/i, month: 1, label: "February" },
  { keys: /מרץ|march|\bmar\b/i, month: 2, label: "March" },
  { keys: /אפריל|april|\bapr\b/i, month: 3, label: "April" },
  { keys: /מאי|\bmay\b/i, month: 4, label: "May" },
  { keys: /יוני|june|\bjun\b/i, month: 5, label: "June" },
  { keys: /יולי|july|\bjul\b/i, month: 6, label: "July" },
  { keys: /אוגוסט|august|\baug\b/i, month: 7, label: "August" },
  { keys: /ספטמבר|september|\bsep\b|\bsept\b/i, month: 8, label: "September" },
  { keys: /אוקטובר|october|\boct\b/i, month: 9, label: "October" },
  { keys: /נובמבר|november|\bnov\b/i, month: 10, label: "November" },
  { keys: /דצמבר|december|\bdec\b/i, month: 11, label: "December" },
];

/** The next occurrence of a month-day range strictly after `today` (rolls to next year when already past). */
function nextRange(today: Date, startMonth: number, startDay: number, endMonth: number, endDay: number, label: string): DateWindow {
  for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    const start = utc(year, startMonth, startDay);
    const end = endMonth < startMonth ? utc(year + 1, endMonth, endDay) : utc(year, endMonth, endDay);
    if (end.getTime() > today.getTime() + DAY) return { start: iso(start), end: iso(end), label };
  }
  const year = today.getUTCFullYear() + 1;
  return { start: iso(utc(year, startMonth, startDay)), end: iso(utc(year, endMonth, endDay)), label };
}

/**
 * Best-effort window for a date phrase inside free text, or null when there is none.
 * `today` is "now" in ISO (injected for tests).
 */
export function resolveDatePhrase(text: string, today: string): DateWindow | null {
  const now = new Date(`${today}T00:00:00Z`);

  for (const holiday of HOLIDAYS) {
    if (!holiday.keys.test(text)) continue;
    const first = nextHebrewDate(addDays(now, 1), holiday.month, holiday.day);
    if (!first) continue;
    const { start, end } = holiday.build(first);
    return { start: iso(start), end: iso(end), label: holiday.label };
  }

  const calendars: { keys: RegExp; label: string; first: (from: Date) => Date | null; before: number; after: number }[] = [
    { keys: /orthodox easter|פסחא אורתודוקס|πάσχα/i, label: "Orthodox Easter", first: (from) => [orthodoxEaster(from.getUTCFullYear()), orthodoxEaster(from.getUTCFullYear() + 1)].find((d) => d >= from) ?? null, before: 7, after: 1 },
    { keys: /\beaster\b|semana santa|holy week|pâques|pascua|páscoa|ostern|פסחא/i, label: "Easter", first: (from) => [westernEaster(from.getUTCFullYear()), westernEaster(from.getUTCFullYear() + 1)].find((d) => d >= from) ?? null, before: 7, after: 1 },
    { keys: /chinese new year|lunar new year|spring festival|tet\b|seollal|春节|新年快乐/i, label: "Lunar New Year", first: (from) => nextNumeric(CHINESE, from, 1, 1), before: 2, after: 6 },
    { keys: /ramadan|רמדאן/i, label: "Ramadan", first: (from) => nextNumeric(ISLAMIC, from, 9, 1), before: 0, after: 29 },
    { keys: /eid al.?fitr|eid ul.?fitr|\beid\b|עיד אל פיטר/i, label: "Eid al-Fitr", first: (from) => nextNumeric(ISLAMIC, from, 10, 1), before: 1, after: 3 },
    { keys: /eid al.?adha|עיד אל אדחא/i, label: "Eid al-Adha", first: (from) => nextNumeric(ISLAMIC, from, 12, 10), before: 1, after: 3 },
  ];
  for (const entry of calendars) {
    if (!entry.keys.test(text)) continue;
    const first = entry.first(addDays(now, 1));
    if (first) return { start: iso(addDays(first, -entry.before)), end: iso(addDays(first, entry.after)), label: entry.label };
  }

  if (/חופש הגדול|summer vacation|school summer/i.test(text)) return nextRange(now, 6, 5, 7, 25, "Summer school vacation");
  if (/כריסמס|christmas|new year|ראש השנה האזרחית/i.test(text)) return nextRange(now, 11, 20, 0, 2, "Christmas and New Year");

  for (const month of MONTHS) {
    if (!month.keys.test(text)) continue;
    const last = utc(2001, month.month + 1, 0).getUTCDate();
    return nextRange(now, month.month, 1, month.month, last, month.label);
  }
  return null;
}

/** Inclusive number of days between two ISO dates. */
export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1;
}

export function shiftIso(date: string, days: number): string {
  return iso(addDays(new Date(`${date}T00:00:00Z`), days));
}
