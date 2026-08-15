/** Shared place-name matching (client + server) for duplicate detection. */

export function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[—–\-·.,'"׳״!?()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when two names refer to the same place ("Terme Segestane" vs
 *  "Terme Segestane — מעיינות חמים"). Single-word names never absorb
 *  longer ones — "Erice" (the town) is not "Erice Adventure Park". */
export function samePlaceName(a: string, b: string): boolean {
  const na = normalizePlaceName(a);
  const nb = normalizePlaceName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  const shorterWords = shorter.split(" ").length;
  return shorterWords >= 2 && shorter.length >= 8 && longer.includes(shorter);
}
