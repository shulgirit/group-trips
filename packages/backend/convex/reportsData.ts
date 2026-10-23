import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/** Everything the report email needs, in one read. */
export const get = internalQuery({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const row = await ctx.db.get(reportId);
    if (!row) return null;
    const [trip, reporter] = await Promise.all([ctx.db.get(row.tripId), ctx.db.get(row.reporterId)]);
    return {
      id: row._id,
      kind: row.kind,
      targetId: row.targetId,
      excerpt: row.excerpt,
      reason: row.reason,
      tripName: trip?.name ?? "?",
      reporterName: reporter?.name || reporter?.email || "?",
    };
  },
});
