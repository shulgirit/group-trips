import { tripQuery } from "./lib/functions";

/** The group's families with their roster (edited through trips.update). */
export const list = tripQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("families")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
      .collect(),
});
