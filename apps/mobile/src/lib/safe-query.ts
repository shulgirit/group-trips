import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

/**
 * `useQuery` that never throws into the screen: a failed request reads as "still loading" and is retried by
 * Convex when its data changes. Used on the screens people land on right after signing in, where a failure
 * used to close the whole app.
 */
export function useSafeQuery<Query extends FunctionReference<"query">>(query: Query, args: FunctionArgs<Query> | "skip"): FunctionReturnType<Query> | undefined {
  try {
    return useQuery(query, args);
  } catch {
    return undefined;
  }
}
