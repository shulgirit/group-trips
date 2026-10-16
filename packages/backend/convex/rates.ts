import { fetchExchangeRates } from "@together/integrations/rates";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";

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
    if (data) await ctx.runMutation(internal.rates.store, { rates: data.ilsPer, fetchedAt: data.updatedAt });
  },
});
