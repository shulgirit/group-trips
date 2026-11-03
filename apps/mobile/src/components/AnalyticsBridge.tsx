import { api } from "@together/backend/api";
import { useQuery } from "convex/react";
import { usePathname } from "expo-router";
import { useEffect } from "react";
import { identify, screen } from "@/lib/analytics";

/** Tells PostHog who is signed in (by id only) and which screen is showing (ids in the path are removed). */
export function AnalyticsBridge() {
  const me = useQuery(api.account.me, {});
  const pathname = usePathname();
  const userId = me?.id ?? null;
  useEffect(() => {
    if (me !== undefined) identify(userId);
  }, [me, userId]);
  useEffect(() => {
    screen(pathname.replace(/\/t\/[^/]+/, "/t/:trip").replace(/\/(event|place|poll|expense)\/[^/]+/, "/$1/:id").replace(/\/j\/[^/]+/, "/j/:code") || "/");
  }, [pathname]);
  return null;
}
