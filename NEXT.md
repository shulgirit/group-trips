# NEXT — prioritised to-do (2026-10-17)

Legend: 🧑 needs Omer · 🤖 an agent can do it. Update this file as you finish items.

## A. Before the production cutover (do these first)
1. 🤖 **Rehearse the real load + verify.** A fresh snapshot exists on Omer's laptop
   (`scripts/migrate/.migrate/2026-10-17T09-41-50-653Z/snapshot.json`; re-export any time with
   `GOOGLE_APPLICATION_CREDENTIALS=$PWD/group-trips-2f753-firebase-adminsdk-fbsvc.json pnpm --filter @together/migrate export`).
   Dry run passed (`load --dry-run --legacy-owner-email omertalmail@gmail.com`). The real load needs a Convex **admin key**:
   - easiest: load into the *local anonymous* deployment (`cd packages/backend && CONVEX_AGENT_MODE=anonymous npx convex dev`; key in
     `packages/backend/.convex/local/default/config.json`), then `pnpm --filter @together/migrate verify`;
   - or 🧑 create a **dev** deploy key in the Convex dashboard (Settings → URL & Deploy Key) and export `CONVEX_DEPLOY_KEY` + `CONVEX_URL`.
   Check: counts per table, no orphan references, expense balances equal the Firestore ones (`verify`).
2. 🤖 **"Welcome back" + kid re-invite** (not built): after migration everyone must sign in once with the same Google account
   (`providerId+accountId` matching) — add a short "welcome back, sign in with the same Google account" hint on the sign-in screen/landing, and a one-time
   notice to trip admins to re-invite kids (kid devices/shared logins don't carry over; `seat_not_migrated` warnings = 8). Convex `notices` union has `welcome`;
   add a `kids_reinvite` type + per-locale copy (`packages/i18n` `server.push`), send after load.
3. 🤖 **Hide the Apple sign-in button** in `apps/mobile/src/components/auth/SignIn.tsx` (and web `SignInPanel`) unless Apple is configured
   (add a public `auth.providers` query exposing which providers have env set).
4. 🤖 **Web account deletion page** `/account/delete` (Google Play requires a web URL): sign in with Better Auth, then `authClient.deleteUser()`.
   Plus `.well-known/apple-app-site-association` and `assetlinks.json` served by `apps/web` (real Team ID / Play SHA-256 come from 🧑 — leave env-driven).
5. 🧑 **Clean Cloudflare duplicate** `resend._domainkey` TXT (harmless, Resend is verified).
6. 🤖 Re-run all checks (see HANDOFF "How to work locally") and `pnpm build` for `apps/web` before the merge. Then follow **CUTOVER.md**.

## B. Mobile app → real devices and stores
1. 🧑 `npx eas-cli login`, then `cd apps/mobile && npx eas-cli init` (writes `extra.eas.projectId` into app.json — commit it). Create EAS env vars
   (`EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_APP_ENV`) for development/preview/production
   mirroring the Convex deployments (dev = mild-caterpillar-988, prod = tidy-dodo-188).
2. 🤖/🧑 First **development build** on a real iPhone and an Android phone (`eas build --profile development`); needs Apple Developer approval for iOS.
   Verify: Google sign-in (browser flow → deep link back `together-dev://`), push token registration + reminder, deep links, RTL (he/ar), camera/photos, location.
3. 🧑 Apple: Services ID `togethergroup.app`, return URL `https://togethergroup.app/api/auth/callback/apple`, App ID with Sign in with Apple + Associated Domains,
   key (.p8) → Convex env `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` (JWT, **rotate every 6 months**), `APPLE_APP_BUNDLE_ID=app.together.trips`.
4. 🧑 Play Console app signing SHA-256 → `assetlinks.json`; Apple Team ID → AASA. Universal links host is `togethergroup.app` (prod) / `togehter.app` (dev builds).
5. 🤖 Store review checklist: Apple sign-in (guideline 4.8), in-app account deletion (exists: Account screen), privacy labels/data safety, demo account, screenshots, `docs/native-apps.md` is the OLD Capacitor guide (superseded).
6. 🤖 Known mobile gaps: live location sharing UI (backend `locations` exists; the map doesn't show other members), notification settings screen, ILS settlement
   ("shekel conversion") block of expenses, "add to a poll" from a place, invite QR codes, "What reviews say" field in place edit, chat composer padding and
   LTR number marks need a physical-device check, `Intl.DisplayNames` currency names (codes shown), `place/new` doesn't auto-open the event modal.
7. 🤖 Maps: `react-native-maps` uses the system provider; for Google provider in release builds add Maps SDK keys (restricted by bundle/package) in `app.config.ts`.

## C. After the stores ship (P8–P9)
- Web `/j/[code]` sends people to the store if the app isn't installed (currently only previews the invite).
- Remove the product from `apps/web` (keep landing, join, legal, account deletion, `/api/auth`), remove `firebase*` deps, Capacitor (`apps/web/ios`, `android`, `native-shell`, `capacitor.config.ts`,
  `codemagic.yaml`), Firestore/Storage rules + tests, `reminders`/`admin` workflows, `apps/web/scripts/admin`, web-push (`sw.js`, `webPushSubscriptions`, VAPID).
- Archive the final Firestore export (encrypted, off-repo); delete the Firebase project after ~90 days.
- Update `docs/migration/checklist.md` (web column becomes "removed").

## D. Nice-to-have / hardening
- Convex rate limits per user on AI/import actions beyond the existing monthly `usage` quota; alerting on prod errors.
- Playwright sweep in CI for web (the ad-hoc scripts used so far lived in a scratch dir and are not in the repo).
- `pnpm turbo` pipeline in CI for typecheck/lint/test of all workspaces + a `convex deploy` workflow for prod.
- Renovate rule pinning `better-auth`, `@better-auth/expo`, `@convex-dev/better-auth` together.
