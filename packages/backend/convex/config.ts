import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * What the apps read at runtime (banners, feature flags, default copy). Public by design:
 * never store anything secret here. Edited from the admin panel (admin.setConfig).
 */
export const get = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const out: Record<string, unknown> = {};
    for (const key of keys.slice(0, 50)) {
      const row = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (row) out[key] = row.value;
    }
    return out;
  },
});
