import { customCtxAndArgs, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { requireAccount, requireMember, requirePlatformAdmin, requireUser } from "./authz";

/**
 * Function builders that resolve identity once:
 * - userQuery / userMutation → ctx.user (signed in)
 * - accountMutation → ctx.user, a real account (not a guest device)
 * - tripQuery / tripMutation → ctx.user, ctx.member, ctx.trip for args.tripId
 *   (any member; check roles inside with isAdmin / isAdult).
 */

export const userQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx: { user: await requireUser(ctx) }, args: {} }),
});

export const userMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx: { user: await requireUser(ctx) }, args: {} }),
});

export const accountMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx: { user: await requireAccount(ctx) }, args: {} }),
});

const tripArgs = customCtxAndArgs({
  args: { tripId: v.id("trips") },
  input: async (ctx: QueryCtx, { tripId }) => {
    const access = await requireMember(ctx, tripId);
    return { ctx: { ...access, tripId }, args: {} };
  },
});

export const tripQuery = customQuery(query, tripArgs);
export const tripMutation = customMutation(mutation, tripArgs);

/** Admin-panel functions: ctx.admin is the signed-in platform owner. */
export const adminQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx: { admin: await requirePlatformAdmin(ctx) }, args: {} }),
});

export const adminMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx: { admin: await requirePlatformAdmin(ctx) }, args: {} }),
});
