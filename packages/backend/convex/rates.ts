import { fetchExchangeRates } from "@together/integrations/rates";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalAction, internalMutation, query } from "./_generated/server";

/** Latest cached market rates as "ILS per unit" (refreshed daily by a cron). */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("rates")
      .withIndex("by_base", (q) => q.eq("base", "ILS"))
      .unique();
    return row ? { ilsPer: row.rates, updatedAt: row.fetchedAt } : null;
  },
});

export const store = internalMutation({
  args: { rates: v.record(v.string(), v.number()), fetchedAt: v.number() },
  handler: async (ctx, { rates, fetchedAt }) => {
    const row = await ctx.db
      .query("rates")
      .withIndex("by_base", (q) => q.eq("base", "ILS"))
      .unique();
    if (row) await ctx.db.patch(row._id, { rates, fetchedAt });
    else await ctx.db.insert("rates", { base: "ILS", rates, fetchedAt });
  },
});

export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const data = await fetchExchangeRates();
    // Our fetch time (not upstream's) so staleness checks settle after one refresh
    if (data) await ctx.runMutation(internal.rates.store, { rates: data.ilsPer, fetchedAt: Date.now() });
  },
});

const STALE_MS = 12 * 60 * 60 * 1000;

/** Clients call this when the cache is empty or stale (e.g. a fresh deployment). */
export const ensureFresh = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    await ctx.runQuery(internal.access.signedIn, {});
    const current = await ctx.runQuery(api.rates.latest, {});
    if (current && Date.now() - current.updatedAt < STALE_MS) return;
    await ctx.runAction(internal.rates.refresh, {});
  },
});
