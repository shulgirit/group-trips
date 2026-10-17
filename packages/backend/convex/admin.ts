import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { getUser } from "./lib/authz";
import { adminMutation, adminQuery } from "./lib/functions";

/**
 * Owner admin panel API. Every function here is adminQuery/adminMutation (platform
 * owners only) except `me`, which just tells the panel whether to show itself, and
 * the CLI-only grantAdmin. Reads are bounded (`take`) — this is a dashboard, not an export.
 */

const DAY = 86_400_000;

/** Is the caller a platform admin? (never throws — the panel uses it to gate its own UI) */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user || user.guest) return { isAdmin: false as const };
    const row = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return { isAdmin: Boolean(row), name: user.name };
  },
});

/** Seed the first admin from the CLI (admin key required): the user must have signed in once. */
export const grantAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const wanted = email.trim().toLowerCase();
    const users = await ctx.db.query("users").collect();
    const user = users.find((candidate) => candidate.email?.toLowerCase() === wanted && !candidate.guest);
    if (!user) throw new Error(`No account with email ${wanted} — sign in once first`);
    const existing = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) return "already_admin";
    await ctx.db.insert("platformAdmins", { userId: user._id, createdAt: Date.now() });
    await ctx.db.insert("adminAudit", { adminId: user._id, action: "grant_admin", target: user._id, detail: "via CLI", createdAt: Date.now() });
    return "granted";
  },
});

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

export const overview = adminQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [users, trips, runs] = await Promise.all([
      ctx.db.query("users").take(20_000),
      ctx.db.query("trips").take(20_000),
      ctx.db
        .query("aiRuns")
        .withIndex("by_created", (q) => q.gte("createdAt", now - 7 * DAY))
        .take(5_000),
    ]);
    const accounts = users.filter((user) => !user.guest);
    const countries = new Map<string, number>();
    for (const trip of trips) {
      if (trip.status === "archived") continue;
      for (const country of new Set(trip.stops.map((stop) => stop.country).filter(Boolean) as string[])) {
        countries.set(country, (countries.get(country) ?? 0) + 1);
      }
    }
    const latencies = runs.filter((run) => run.ok).map((run) => run.totalMs).sort((a, b) => a - b);
    return {
      users: { total: users.length, accounts: accounts.length, guests: users.length - accounts.length, last7d: users.filter((user) => user.createdAt >= now - 7 * DAY).length, last30d: users.filter((user) => user.createdAt >= now - 30 * DAY).length },
      trips: {
        total: trips.length,
        active: trips.filter((trip) => trip.status === "active").length,
        draft: trips.filter((trip) => trip.status === "draft").length,
        archived: trips.filter((trip) => trip.status === "archived").length,
        last7d: trips.filter((trip) => trip.createdAt >= now - 7 * DAY).length,
      },
      topCountries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, count]) => ({ country, count })),
      ai: {
        replies7d: runs.length,
        failed7d: runs.filter((run) => !run.ok).length,
        p50Ms: percentile(latencies, 0.5),
        p95Ms: percentile(latencies, 0.95),
        promptTokens7d: runs.reduce((sum, run) => sum + run.promptTokens, 0),
        completionTokens7d: runs.reduce((sum, run) => sum + run.completionTokens, 0),
      },
    };
  },
});

/** Newest trips first; optional case-insensitive name filter. */
export const listTrips = adminQuery({
  args: { search: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { search, limit }) => {
    const rows = await ctx.db.query("trips").order("desc").take(2_000);
    const needle = search?.trim().toLowerCase();
    return Promise.all(
      rows
        .filter((trip) => !needle || trip.name.toLowerCase().includes(needle) || trip.destination.label.toLowerCase().includes(needle))
        .slice(0, Math.min(limit ?? 50, 200))
        .map(async (trip: Doc<"trips">) => {
          const owner = await ctx.db.get(trip.ownerId);
          const members = await ctx.db.query("memberships").withIndex("by_trip", (q) => q.eq("tripId", trip._id)).take(100);
          return {
            id: trip._id,
            name: trip.name,
            destination: trip.destination.label,
            countries: [...new Set(trip.stops.map((stop) => stop.country).filter(Boolean))],
            status: trip.status,
            plan: trip.plan,
            startDate: trip.startDate,
            endDate: trip.endDate,
            ownerName: owner?.name ?? "",
            members: members.length,
            createdAt: trip.createdAt,
          };
        })
    );
  },
});

/** Newest users first; filter by name or email. Returns no tokens or provider data. */
export const listUsers = adminQuery({
  args: { search: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { search, limit }) => {
    const rows = await ctx.db.query("users").order("desc").take(5_000);
    const needle = search?.trim().toLowerCase();
    return rows
      .filter((user) => !needle || user.name.toLowerCase().includes(needle) || (user.email ?? "").toLowerCase().includes(needle))
      .slice(0, Math.min(limit ?? 50, 200))
      .map((user) => ({ id: user._id, name: user.name, email: user.email ?? null, guest: user.guest, locale: user.locale ?? null, createdAt: user.createdAt }));
  },
});

/** Hide a trip from everyone (reversible: status back to active). Audited. */
export const setTripStatus = adminMutation({
  args: { tripId: v.id("trips"), status: v.union(v.literal("active"), v.literal("archived")) },
  handler: async (ctx, { tripId, status }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) throw new Error("not_found");
    await ctx.db.patch(tripId, { status, updatedAt: Date.now() });
    await ctx.db.insert("adminAudit", { adminId: ctx.admin._id, action: "set_trip_status", target: tripId, detail: `${trip.status} -> ${status}`, createdAt: Date.now() });
  },
});

export const auditLog = adminQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("adminAudit").withIndex("by_created").order("desc").take(Math.min(limit ?? 50, 200));
    return Promise.all(
      rows.map(async (row) => ({ action: row.action, target: row.target, detail: row.detail ?? null, at: row.createdAt, admin: (await ctx.db.get(row.adminId))?.name ?? "" }))
    );
  },
});

/** Set a remote config value (banner, flag, default). Audited. */
export const setConfig = adminMutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, { key, value }) => {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(key)) throw new Error("invalid_key");
    const existing = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (existing) await ctx.db.patch(existing._id, { value, updatedBy: ctx.admin._id, updatedAt: Date.now() });
    else await ctx.db.insert("appConfig", { key, value, updatedBy: ctx.admin._id, updatedAt: Date.now() });
    await ctx.db.insert("adminAudit", { adminId: ctx.admin._id, action: "set_config", target: key, detail: JSON.stringify(value).slice(0, 300), createdAt: Date.now() });
  },
});

export const listConfig = adminQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("appConfig").take(500)).map(({ key, value, updatedAt }) => ({ key, value, updatedAt })),
});
