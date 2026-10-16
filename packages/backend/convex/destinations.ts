import {
  autocompleteDestination,
  type DestinationSuggestion,
  type ResolvedDestination,
  resolveDestination,
} from "@together/integrations/destination";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

/** Trip creator destination search (Google Places autocomplete + details with time zone). */

export const autocomplete = action({
  args: { q: v.string() },
  handler: async (ctx, { q }): Promise<DestinationSuggestion[]> => {
    await ctx.runQuery(internal.access.signedIn, {});
    const query = q.trim();
    if (query.length < 2) return [];
    return autocompleteDestination(query.slice(0, 80));
  },
});

export const resolve = action({
  args: { placeId: v.string() },
  handler: async (ctx, { placeId }): Promise<ResolvedDestination | null> => {
    await ctx.runQuery(internal.access.signedIn, {});
    return resolveDestination(placeId.slice(0, 300));
  },
});
