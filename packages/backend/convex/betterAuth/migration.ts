import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Firebase Auth → Better Auth import (idempotent). Creates the identity and
 * one account per social provider, keyed by the provider's own user id
 * (`sub`), so the person's first Google/Apple sign-in after cutover lands
 * on this user. Component functions are never reachable from the internet;
 * only the app's internal migration mutation calls this.
 */
export const importUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    image: v.union(v.string(), v.null()),
    emailVerified: v.boolean(),
    createdAt: v.number(),
    accounts: v.array(v.object({ providerId: v.string(), accountId: v.string() })),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const now = Date.now();
    let userId: string | null = null;
    // An account already imported (re-run) wins over the email match
    for (const account of args.accounts) {
      const existing = await ctx.db
        .query("account")
        .withIndex("accountId_providerId", (q) => q.eq("accountId", account.accountId).eq("providerId", account.providerId))
        .unique();
      if (existing) userId = existing.userId;
    }
    if (!userId) {
      const byEmail = await ctx.db
        .query("user")
        .withIndex("email_name", (q) => q.eq("email", args.email.toLowerCase()))
        .first();
      userId = byEmail?._id ?? null;
    }
    if (!userId) {
      userId = await ctx.db.insert("user", {
        name: args.name,
        email: args.email.toLowerCase(),
        emailVerified: args.emailVerified,
        image: args.image,
        createdAt: args.createdAt,
        updatedAt: now,
        isAnonymous: false,
      });
    }
    for (const account of args.accounts) {
      const existing = await ctx.db
        .query("account")
        .withIndex("accountId_providerId", (q) => q.eq("accountId", account.accountId).eq("providerId", account.providerId))
        .unique();
      if (!existing) {
        await ctx.db.insert("account", {
          accountId: account.accountId,
          providerId: account.providerId,
          userId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return userId;
  },
});
