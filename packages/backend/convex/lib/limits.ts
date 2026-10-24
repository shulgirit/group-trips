import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Free-plan guardrails (same numbers as the Firebase version). Everything is
 * free today; these keep AI cost bounded and are where a paid plan plugs in.
 */
export const FREE_LIMITS = {
  aiCallsPerMonth: 400,
  activeTripsPerUser: 5,
  membersPerTrip: 40,
  bookingImportsPerMonth: 60,
} as const;

type UsageField = "aiCalls" | "bookingImports";

const monthKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);

async function usageRow(ctx: QueryCtx, tripId: Id<"trips">) {
  return ctx.db
    .query("usage")
    .withIndex("by_trip_month", (q) => q.eq("tripId", tripId).eq("month", monthKey()))
    .unique();
}

export async function quotaLeft(ctx: QueryCtx, tripId: Id<"trips">, field: UsageField): Promise<boolean> {
  const trip = await ctx.db.get(tripId);
  // Migrated Sicily/Sardinia trips predate limits
  if (trip?.legacyKey) return true;
  const limit = field === "aiCalls" ? FREE_LIMITS.aiCallsPerMonth : FREE_LIMITS.bookingImportsPerMonth;
  const row = await usageRow(ctx, tripId);
  return (row?.[field] ?? 0) < limit;
}

export async function recordUsage(ctx: MutationCtx, tripId: Id<"trips">, field: UsageField) {
  const row = await usageRow(ctx, tripId);
  if (row) await ctx.db.patch(row._id, { [field]: row[field] + 1 });
  else
    await ctx.db.insert("usage", {
      tripId,
      month: monthKey(),
      aiCalls: field === "aiCalls" ? 1 : 0,
      bookingImports: field === "bookingImports" ? 1 : 0,
    });
}

/** Trips a user organizes that haven't ended yet. */
export async function activeTripCount(ctx: QueryCtx, userId: Id<"users">): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const owned = await ctx.db
    .query("trips")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  // Drafts are unfinished and invisible to others: they never use up the limit
  return owned.filter((trip) => trip.status === "active" && trip.endDate >= today).length;
}

export async function memberCount(ctx: QueryCtx, tripId: Id<"trips">): Promise<number> {
  const rows = await ctx.db
    .query("memberships")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .take(FREE_LIMITS.membersPerTrip + 1);
  return rows.length;
}
