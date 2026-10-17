# NEXT — prioritised to-do (2026-10-17)

Legend: 🧑 needs Omer · 🤖 an agent can do it. Update this file as you finish items.

## A. Before the production cutover (do these first)
1. ✅ **Rehearsal done (2026-10-17)**: real snapshot loaded into the *local* anonymous Convex twice — second run changed nothing (idempotent),
   all per-trip counts match (Sicily 89 places/57 events/32 expenses/68 chats/4 polls; Sardinia 13 places…), 27 files copied. `verify` only flags
   `users/accounts` totals because that local deployment also holds earlier emulator-rehearsal users (53 + 20 real + 2 test = 75). On the empty prod
   deployment those totals must equal the plan (users 20, accounts 11). Re-export right before the real cutover (see CUTOVER.md).
2. ✅ **Welcome-back + kid re-invite** (2026-10-17): sign-in screens (web `SignInPanel`, mobile `SignIn`) show `product.signIn.welcomeBack`; organizers see a
   dismissible `KidsNudge` card on the mobile Now screen when roster kids have no connected phone (links to the Invites screen). Web has no kids card (web is being retired).
3. ✅ **Apple button hidden until configured**: public query `providers.available` (`convex/providers.ts`) drives the mobile buttons; web uses `NEXT_PUBLIC_APPLE_SIGN_IN=1`.
   Deploy the backend to prod before cutover so the query exists there (`npx convex deploy --yes`).
4. ✅ **Web `/account/delete`** page (public, sign in → delete) for Google Play's data-safety form, and dynamic `/.well-known/apple-app-site-association` +
   `/.well-known/assetlinks.json` routes (404 until Vercel env `APPLE_TEAM_ID` / `ANDROID_SHA256_CERTS` is set — 🧑 provides the values; dev domain togehter.app uses the `.dev` ids).
   The old placeholder files in `apps/web/public/.well-known` were removed.
5. 🧑 **Clean Cloudflare duplicate** `resend._domainkey` TXT (harmless, Resend is verified).
6. 🤖 Re-run all checks (see HANDOFF "How to work locally") and `pnpm build` for `apps/web` before the merge. Then follow **CUTOVER.md**.

## B. Mobile app → real devices and stores
1. ✅ **EAS linked (2026-10-17)**: Expo account **shulgirit**, project **`@shulgirit/together-group-plans`** (ID `b7f14588-d89f-4ee4-8e3e-a113ee10d933`, in `apps/mobile/app.json`
   `extra.eas.projectId`, `owner`, `slug`). EAS env vars exist for development/preview (dev Convex + togehter.app) and production (prod Convex + togethergroup.app).
   ⚠️ Omer's other Expo projects (`dr-fischer`, `dr-fischer-monorepo`, account `wiply`) are a live app — **never touch them**; always check `npx eas-cli project:info` shows `@shulgirit/together-group-plans`.
   GitHub connection in Expo is not needed (builds run from the CLI). `eas.json` `submit.production.ios.ascAppId` is still a placeholder (App Store Connect app id).
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
