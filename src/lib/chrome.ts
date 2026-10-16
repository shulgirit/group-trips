/**
 * Screens that own the bottom edge (chat composer, forms with a sticky
 * save button) — the floating home / quick-add buttons stay out of the way.
 */
export function ownsBottomEdge(pathname: string, prefix: string): boolean {
  const path = pathname.slice(prefix.length) || "/";
  return (
    path.startsWith("/ai") ||
    path === "/calendar/new" ||
    /^\/calendar\/[^/]+$/.test(path) ||
    path === "/places/new" ||
    path === "/polls/new"
  );
}
