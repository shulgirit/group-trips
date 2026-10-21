# NEXT — prioritised to-do (2026-10-17)

Legend: 🧑 needs Omer · 🤖 an agent can do it. Update this file as you finish items.

## Round 2 status (2026-10-17, later) — Omer's 10 items
| # | Item | Status |
|---|---|---|
| 1 | Landing problems | globe drag fixed (desktop mouse + touch verified headless). 🧑 Omer still owes the list of *other* landing issues (screenshots) |
| 2/4 | EAS builds + stores | Android **preview** build started (EAS project `@shulgirit/together-group-plans`, keystore created). iOS waits for Apple. 🧑 Play Console steps below |
| 3 | OTA | done: `eas update:configure`, fingerprint runtime version, `docs/ota.md` |
| 5 | Resend + invites | web `/j/<code>` has "Open in the Together app" (phones); 🧑 OTP deliverability test needs Omer's OK + inbox; universal links wait for AASA/assetlinks values |
| 6 | Native vs web speed | to measure on the preview build (release mode), not Expo Go |
| 7 | Domain emails | code done (legal pages + Account row use `privacy@/support@togethergroup.app`, reply-to on sign-in mail). 🧑 Cloudflare Email Routing steps below |
| 8 | AI speed | ~20 s → p50 9.8 s / max 10.9 s, actions 3–5 s (see D0); streaming is next |
| 9 | Admin panel | **backend foundation done and tested** (`convex/admin.ts`, `platformAdmins`, `adminAudit`, `appConfig`, `config.get`). UI app `apps/admin` not started |
| 10 | Globe | same fix as 1 |

### 🧑 Omer — Cloudflare Email Routing (≈10 min)
Cloudflare → togethergroup.app → Email → Email Routing → Enable (accept the MX/SPF records it adds) → Destination addresses: add `omertalmail@gmail.com` and click the verification link in Gmail → Routing rules: `privacy@togethergroup.app` → that address, `support@togethergroup.app` → that address (optional `hello@`).
Send *as* support@ from Gmail: Gmail → Settings → Accounts and Import → "Send mail as" → add `support@togethergroup.app` → SMTP server `smtp.resend.com`, port 465 (SSL), username `resend`, password = a Resend API key with **sending access** (create a second key just for this) → confirm the code that arrives via the routing rule.
### 🧑 Omer — Google Play (personal account ⇒ 12 testers × 14 days)
1. Play Console → Create app "Together" (default language Hebrew or English), free, app/game = app. 2. Set up store listing basics later. 3. Testing → Closed testing → create a track, add a Google Group of ≥12 testers (the clock starts when 12 are opted in). 4. Upload the first **production** AAB manually (build with `npx eas-cli build -p android --profile production`; ask the agent). 5. Setup → API access → create a service account with "Release manager" rights → JSON key → keep it out of git; then `eas submit -p android` works. 6. App signing: copy the **SHA-256 of the app signing key** → Vercel env `ANDROID_SHA256_CERTS` (feeds `/.well-known/assetlinks.json`).
### 🤖 Admin panel next step
Scaffold `apps/admin` (Next.js 16, Tailwind, Better Auth client already in web — reuse pattern from `apps/web/src/lib/convex.ts`), screens: overview (`admin.overview`), trips, users, audit log, config editor; gate the whole app on `admin.me` and show nothing to non-admins. Seed the first admin after the cutover: `npx convex run admin:grantAdmin '{"email":"omertalmail@gmail.com"}' --prod` (the account must have signed in once).

### Landing CTA after the apps ship (Omer, not now)
Today the hero shows Google/email sign-in. When the iOS/Android apps are live, replace it with "Download on the App Store / Get it on Google Play" badges (keep a small "continue on the web" link only if the web product stays). Design: read a public Convex `appConfig` key `landing.stores` = `{ ios: <url>, android: <url> }` via `config.get`; when set, the hero (`apps/web/src/components/landing/Hero.tsx`) renders the badges instead of `SignInPanel`; invite page `/j/[code]` shows the same badges next to "Open in the app". No code change needed to flip it — set the key from the admin panel (`admin.setConfig`).

### Builds so far (EAS project `@shulgirit/together-group-plans`)
- Android **preview** APK (dev backend, identity `app.together.trips.dev`) — built 2026-10-17; install link in the EAS dashboard (Builds). 🧑 Omer tests on an Android phone (email code: ask the agent to read it from `npx convex logs`, dev doesn't email).
- iOS **simulator** build (`--profile preview-simulator`, no Apple account) — built OK and installed/launched on Omer's simulator (release mode, Hebrew welcome renders). Real iPhone / TestFlight build needs the paid Apple Developer account: `eas build -p ios --profile preview`.
- ⚠️ Unverified: `welcome.tsx` pager no longer uses `inverted` in RTL (the release build showed the wrong page dot on the first card). Check on a device in Hebrew: first card shows the first (right-most) dot, swiping/"Next" advances the dot correctly; revert to `inverted={I18nManager.isRTL}` if Android misbehaves.

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

## D0. AI guide performance (2026-10-17)
Measured (cloud dev, gpt-5.1): the 20 s was **14.5 s of model time over 4 sequential rounds** (tools 1.2 s, Google photos 0.3 s). Done: per-reply
timing/tokens logged to console and to the new `aiRuns` table (`chat.logRun`); read-only tools (`search_google_places`) run in parallel; first-round
reasoning is `low` unless the request is planning/long/has a photo (`firstRoundEffort`); later rounds use `none` (or `low` after a planning
request) — override with Convex env `AI_REASONING_FIRST` / `AI_REASONING_TOOLS`; the prompt tells the model to issue independent tool calls in
the same turn. Result on `apps/web/scripts/ai-eval.mjs` (4 realistic requests × 2 runs, 8/8 pass): p50 9.8 s, max 10.9 s (was ~20 s);
actions 3–5 s. **Done 2026-10-21 — streaming**: `runChat` streams the model (`onReply`), `extractReply` (`packages/integrations/src/stream.ts`) pulls the `reply` text out of the partial JSON, `chatRun` writes it into the pending message every 250 ms (`chat.streamReply`, only while still pending), and both clients show a pending reply with text as a normal bubble. `AI_STREAM=0` turns it off. The last allowed round now runs with `tool_choice: "none"` so a model that keeps searching still answers (it used to throw `tool_loop_exceeded` on planning requests). Eval (12 runs, dev): 12/12 pass, first words p50 4.3 s (recommendations ~3 s, polls 2.2 s), total p50 7.1 s, max 13 s. **Next**: (1) show a short status while tools run ("searching places…") since text only starts after the tool rounds; (2) shrink the final structured JSON (candidate descriptions dominate output tokens);
(3) show `aiRuns` p50/p95 + cost in the admin panel; (4) extend the eval (multi-turn, photos, he/ar/es, prompt-injection document) and run it in CI against dev before changing model/prompt.
Run the eval: `CONVEX_URL=<dev> AUTH_TOKEN=<convex_jwt cookie> node apps/web/scripts/ai-eval.mjs --runs 2` (refuses prod, deletes its trips).

## D. Nice-to-have / hardening
- Convex rate limits per user on AI/import actions beyond the existing monthly `usage` quota; alerting on prod errors.
- Playwright sweep in CI for web (the ad-hoc scripts used so far lived in a scratch dir and are not in the repo).
- `pnpm turbo` pipeline in CI for typecheck/lint/test of all workspaces + a `convex deploy` workflow for prod.
- Renovate rule pinning `better-auth`, `@better-auth/expo`, `@convex-dev/better-auth` together.
