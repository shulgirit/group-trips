import { expo } from "@better-auth/expo";
import { type AuthFunctions, createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { anonymous, emailOTP } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { sendOtpEmail } from "./email";

/**
 * Identity lives in the Better Auth component; the app's `users` table is
 * kept in sync by the triggers below and is the only thing app code reads.
 */
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  authFunctions,
  local: { schema: authSchema },
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        const now = Date.now();
        await ctx.db.insert("users", {
          authId: doc._id,
          name: doc.name,
          email: doc.isAnonymous ? undefined : doc.email,
          image: doc.image ?? undefined,
          guest: Boolean(doc.isAnonymous),
          createdAt: now,
          updatedAt: now,
        });
      },
      onUpdate: async (ctx, doc) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", doc._id))
          .unique();
        if (!user) return;
        await ctx.db.patch(user._id, {
          name: doc.name,
          email: doc.isAnonymous ? undefined : doc.email,
          image: doc.image ?? undefined,
          guest: Boolean(doc.isAnonymous),
          updatedAt: Date.now(),
        });
      },
      onDelete: async (ctx, doc) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", doc._id))
          .unique();
        if (user) await ctx.db.delete(user._id);
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const env = (name: string) => process.env[name] || undefined;

/** Better Auth runs inside Convex HTTP actions, which can run mutations. */
function canMutate(ctx: GenericCtx<DataModel>): ctx is ActionCtx {
  return "runMutation" in ctx;
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const googleClientId = env("GOOGLE_CLIENT_ID");
  const appleClientId = env("APPLE_CLIENT_ID");

  return {
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // The site, the app schemes (production + development builds), Apple, and any
    // extra web origins (dev: localhost next to the dev domain)
    trustedOrigins: [
      siteUrl,
      "together://",
      "together-dev://",
      "https://appleid.apple.com",
      ...(env("EXTRA_TRUSTED_ORIGINS")?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
    ],
    socialProviders: {
      ...(googleClientId && {
        google: {
          // Web client first (used for the redirect flow); the native iOS and
          // Android client ids only verify ID tokens from the app.
          clientId: [googleClientId, env("GOOGLE_IOS_CLIENT_ID"), env("GOOGLE_ANDROID_CLIENT_ID")].filter(
            (id): id is string => Boolean(id)
          ),
          clientSecret: env("GOOGLE_CLIENT_SECRET") ?? "",
        },
      }),
      ...(appleClientId && {
        apple: {
          clientId: appleClientId,
          clientSecret: env("APPLE_CLIENT_SECRET") ?? "",
          // Native Sign in with Apple tokens carry the bundle id as audience
          appBundleIdentifier: env("APPLE_APP_BUNDLE_ID") ?? "app.together.trips",
        },
      }),
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple", "email-otp"],
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        // Hand trips over / anonymise before the identity disappears
        beforeDelete: async (user) => {
          if (canMutate(ctx)) await ctx.runMutation(internal.account.purgeForAuthUser, { authId: user.id });
        },
      },
    },
    plugins: [
      expo(),
      convex({ authConfig }),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        sendVerificationOTP: async ({ email, otp }, endpoint) => {
          if (!canMutate(ctx)) return;
          const locale = endpoint?.request?.headers.get("accept-language")?.slice(0, 2);
          await sendOtpEmail(ctx, { email, otp, locale });
        },
      }),
      anonymous({
        // Guest / kid devices joined through an invite; when they later sign
        // in for real, their trips move to the real account.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          if (!canMutate(ctx)) return;
          await ctx.runMutation(internal.account.mergeGuest, {
            fromAuthId: anonymousUser.user.id,
            toAuthId: newUser.user.id,
          });
        },
      }),
    ],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));
