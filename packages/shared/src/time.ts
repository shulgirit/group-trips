/**
 * Trip-local wall time → UTC epoch ms, without a date library. Used to
 * schedule event reminders (Convex scheduler takes absolute times) and by
 * the apps for "starts in N minutes".
 */

function offsetMs(epoch: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(epoch))
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

/** "2026-08-16" + "18:30" in "Europe/Rome" → epoch ms (null if malformed). */
export function zonedTimeToUtc(day: string, time: string, timeZone: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [, y, mo, d] = dateMatch.map(Number);
  const [, h, mi] = timeMatch.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  try {
    // Two passes settle the offset across DST transitions
    const first = wall - offsetMs(wall, timeZone);
    return wall - offsetMs(first, timeZone);
  } catch {
    return null;
  }
}
