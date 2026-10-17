# Environments and domains

`together.app` was taken, so: **production = `togethergroup.app`**, **dev/preview = `togehter.app`** (a typo'd
domain, never shown to users). One Google OAuth web client serves both.

| | Dev / preview | Production |
|---|---|---|
| Web | `https://togehter.app` → Vercel Preview (branch `convex-web`) | `https://togethergroup.app` → Vercel Production |
| Convex | `mild-caterpillar-988` (EU) — `SITE_URL=https://togehter.app`, `EXTRA_TRUSTED_ORIGINS=http://localhost:3100`, `AUTH_DEV_LOG_OTP=1` (codes in the logs, no email) | `tidy-dodo-188` (EU) — `SITE_URL=https://togethergroup.app`, `RESEND_LIVE=1`; **never** `AUTH_DEV_LOG_OTP` |
| Mobile | `EXPO_PUBLIC_APP_ENV=development\|preview` → `app.config.ts`: host `togehter.app`, `app.together.trips.dev`, scheme `together-dev` | `app.json`: host `togethergroup.app`, `app.together.trips`, scheme `together` |
| Email | not sent | Resend, domain `togethergroup.app` (Ireland), From `Together <no-reply@togethergroup.app>` |
| Google OAuth | redirect `https://togehter.app/api/auth/callback/google` (+ localhost:3100) | redirect `https://togethergroup.app/api/auth/callback/google` |

Secrets live only in Convex env (per deployment) and Vercel env; **never reuse a secret across dev and prod**
(`BETTER_AUTH_SECRET`, VAPID keys are generated per deployment). Only the production domain is crawlable
(`apps/web/src/app/robots.ts`).
