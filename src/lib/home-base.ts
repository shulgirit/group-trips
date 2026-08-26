import type { Place } from "@/types";

/**
 * Resolves the trip's current "home base":
 * 1. the fixed-id "villa" place (sicily's original convention),
 * 2. else the accommodation whose stay window covers today — trips with
 *    more than one hotel switch home base automatically on the move day,
 * 3. else the earliest accommodation added.
 */
export function resolveHomeBase(
  places: Place[],
  todayIso: string
): Place | null {
  const villa = places.find((p) => p.id === "villa");
  if (villa) return villa;

  const stays = places
    .filter((p) => p.category === "accommodation")
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const current = stays.find(
    (p) => p.stayFrom && p.stayTo && p.stayFrom <= todayIso && todayIso < p.stayTo
  );
  return current ?? stays[0] ?? null;
}
