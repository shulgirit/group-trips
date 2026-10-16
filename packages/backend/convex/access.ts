import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { fail, isAdmin, requireAccount, requireMember, requireUser } from "./lib/authz";

/**
 * Authorization for actions (actions have no db). The caller's identity is
 * forwarded by ctx.runQuery, so these apply the same rules as queries and
 * mutations.
 */

export const member = internalQuery({
  args: { tripId: v.id("trips"), admin: v.optional(v.boolean()) },
  handler: async (ctx, { tripId, admin }) => {
    const access = await requireMember(ctx, tripId);
    if (admin && !isAdmin(access.member)) fail("forbidden");
    return { trip: access.trip, member: access.member, user: access.user };
  },
});

export const signedIn = internalQuery({
  args: {},
  handler: async (ctx) => requireUser(ctx),
});

export const account = internalQuery({
  args: {},
  handler: async (ctx) => requireAccount(ctx),
});
