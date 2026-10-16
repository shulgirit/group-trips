import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Authorization helpers — the server-side replacement for firestore.rules,
 * storage.rules and authorizeTrip(). Identity always comes from the auth
 * token (ctx.auth), never from arguments.
 */

export type TripRole = Doc<"memberships">["role"];

export type AppErrorCode =
  | "unauthenticated"
  | "not_member"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "limit"
  | "sign_in_required";

export function fail(code: AppErrorCode, detail?: string): never {
  throw new ConvexError({ code, ...(detail ? { detail } : {}) });
}

/** The signed-in user's app profile, or null when signed out. */
export async function getUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getUser(ctx);
  if (!user) fail("unauthenticated");
  return user;
}

/** A signed-in account (Google / Apple / email) — not a guest device. */
export async function requireAccount(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.guest) fail("sign_in_required");
  return user;
}

export async function getMembership(ctx: QueryCtx, tripId: Id<"trips">, userId: Id<"users">) {
  return ctx.db
    .query("memberships")
    .withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", userId))
    .unique();
}

export interface TripAccess {
  user: Doc<"users">;
  member: Doc<"memberships">;
  trip: Doc<"trips">;
}

/** Caller must be a member of the trip (optionally with one of `roles`). */
export async function requireMember(
  ctx: QueryCtx,
  tripId: Id<"trips">,
  options: { roles?: readonly TripRole[] } = {}
): Promise<TripAccess> {
  const user = await requireUser(ctx);
  const [trip, member] = await Promise.all([ctx.db.get(tripId), getMembership(ctx, tripId, user._id)]);
  if (!trip) fail("not_found");
  if (!member) fail("not_member");
  if (options.roles && !options.roles.includes(member.role)) fail("forbidden");
  return { user, member, trip };
}

export const ADMIN_ROLES = ["owner", "admin"] as const;
export const ADULT_ROLES = ["owner", "admin", "member"] as const;

export const isAdmin = (member: Doc<"memberships">) => member.role === "owner" || member.role === "admin";
export const isAdult = (member: Doc<"memberships">) => member.role !== "kid";

/** Places: admins always; other adults when the organizer allows it. */
export function canDeletePlace(access: TripAccess): boolean {
  return isAdmin(access.member) || (isAdult(access.member) && access.trip.membersCanDeletePlaces);
}

/** Rows a member created can be edited by them; admins can edit anything. */
export function canEditOwned(access: TripAccess, createdBy: Id<"users"> | undefined): boolean {
  return isAdmin(access.member) || (createdBy !== undefined && createdBy === access.user._id);
}
