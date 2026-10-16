# Together → Turborepo · Next.js landing · Expo app · Convex · Better Auth

## Context
Together is a live Next.js 16 product: a landing page plus the trip app, running on Firebase (Auth, Firestore, Storage, FCM). The store apps are a Capacitor webview of the website. Omer wants:
- a production-grade architecture: pnpm Turborepo, Next.js for the landing page only, a real Expo/React Native app (iOS and Android), Convex for data and backend logic, Better Auth for identity;
- the landing page preserved exactly, existing users and data migrated, and Firebase eventually removed.

Decisions taken with Omer (2026-10-16):
- After the store launch the website is **landing + invite/join + legal + web account deletion**. All trip features live in the app.
- **Sicily and Sardinia migrate as normal trips.** The shared password and the pick-your-name kid login are retired; kids rejoin with a kid invite link.
- **Domain: `together.app`** (DNS at Cloudflare). It hosts the landing page, universal links and email (OTP sender).
- **Convex project "together" already exists in the EU (Ireland, `aws-eu-west-1`).** Omer runs `npx convex login` once; the browser profile I control isn't signed in.

## A. Current architecture (from the audit)
**Code**
- Already TypeScript (strict): 272 files under `src`, no JS. "JS→TS" applies only to `scripts/*.mjs`.
- Versions: Next 16.3.1, React 19.2.8, Tailwind 4, firebase 12, firebase-admin 14, openai 7, zod 4, motion, three.

**Routes**
- Public: `/welcome` (globe + robot landing; it switches to `AppOnboarding` when the user agent contains `TogetherApp`), `/privacy`, `/terms`, `/j/[code]` (invite preview + join).
- Product: `/trips`, `/new` (creator wizard, about 2.4k lines), `/account`, `/t/[tripId]/*`. The 16 pages under `(app)` are re-exported for `/t/[id]` and `/sardinia`, and `TripGate` and `TripAppShell` wrap them.
- Legacy Sicily (root) and Sardinia: HMAC `trip_session` cookie, the `/gate` password page, kid name-login.

**Backend**
- 26 API routes, thin wrappers over `src/lib/server/*` (firebase-admin).
- AI chat: a tool loop, not streamed, maxDuration 300.
- Imports: booking (OpenAI vision), place (Firecrawl), enrich, search (Places API (New)).
- Also: destination autocomplete with time zone, photo backfill, invites, trips CRUD and purge, rates, push.
- `authorizeTrip()` checks the cookie, or a Bearer token plus `members/{uid}`.

**Firebase**
- **Auth:**
  - Google (web popup; native via the Capacitor plugin passing the provider token to the web SDK) and Apple (flagged off on web).
  - Anonymous guests, for kid devices and guest invites; upgrading keeps the same uid via `linkWithCredential`.
  - Custom tokens: `member-{memberId}` for kids, plus a shared `trip-member` uid used by everyone with the password.
  - Claims: `member: true`, and a `t{tripId}` map that Storage rules depend on.
- **Firestore:**
  - Top level: `users`, `invites`.
  - Under `trips/{id}`: members, users (legacy profile), families, places, events, expenses, polls (votes map), documents, chatSessions (messages array), locations, pushSubscriptions, imports, usage.
  - Nearly every screen uses realtime `onSnapshot`.
  - The client writes places, events, expenses and polls directly, guarded only by rules; the rules don't validate document shape.
- **Storage:**
  - Documents (shared/private), booking imports, chat photos and AI avatars.
  - Chat photos and avatars store full tokenized download URLs in documents; documents and imports store paths only.
- **FCM:** native push through `adminMessaging`. Web push uses VAPID and `sw.js`.
- **Not used:** Analytics, Crashlytics, App Check, Remote Config, Dynamic Links, Functions.

**Jobs and deploy**
- Reminders: a GitHub Actions cron every 5 minutes, plus the in-app `ReminderPinger`, hit `/api/push/check-reminders`.
- Deploy: Vercel (remote build; the `NEXT_PUBLIC_*` vars are Sensitive). `admin.yml` runs data scripts.
- The Capacitor app loads `sicily-together.vercel.app/trips` remotely; Codemagic builds it.

**Shareable pure logic**
- `settlement`, `currency`, `trip`, `trip-doc` (`tripConfigFromDoc`, `composePersona`, presets), `place-name`, `booking`/`trip-schemas`/`schemas` (zod), `avatars`, `nav`, `participants`, `home-base`, `types`.
- `i18n`: config, translate, format and 4 locales × 12 namespaces. It's DOM-free except the cookie/reload helper and `server.ts`.
- A caveat: render-time module globals (`setActiveTrip`, `setActiveLocale`) must become explicit parameters.

**Housekeeping found**
- `robots: noindex` on every page, including the landing page.
- No `metadataBase`, sitemap or robots file.
- The AASA and assetlinks files contain placeholders.
- `firebase-debug.log` is committed.
- The service-account key is on disk but gitignored and was never committed.

## B. Target architecture
```
Expo app (iOS/Android) ─┐                     ┌─ Convex (EU): schema, queries/mutations,
                        ├─ Better Auth ──────►│  actions (OpenAI, Places, Firecrawl),
Next.js together.app ───┘  (Convex component) │  file storage, scheduler + crons,
  landing · join · legal · account-delete     └─ Expo push component
```
**Key choices**
- **Backend-first cutover.** The current web product is moved onto Convex and Better Auth *before* the Expo app exists. Only one backend is ever live, with no dual-writes. The web product then retires once the store apps ship.
- **Better Auth via `@convex-dev/better-auth` 0.12.x, with `better-auth` and `@better-auth/expo` pinned to `~1.6.x`.**
  - The component does not support 1.7; the pins are documented in the package.
  - Local Install mode, so the migration can write the auth tables and so we control the indexes.
- **Expo SDK 57 and Expo Router.** SDK 58 is one day old and has no Expo Go yet; upgrade after it settles.
- **Maps:** `react-native-maps` with the Google provider.
- **No shared UI package.** Web keeps Tailwind; mobile gets its own RN components built on shared design tokens.
- **No state libraries.** Convex `useQuery` for server state, React state for the rest.

## C. Firebase → Convex mapping
**Convex schema** (`packages/backend/convex/schema.ts`). Every migrated table gets `firebaseId` and a `by_firebaseId` index, so the import is idempotent.

| Convex table | From | Key indexes / notes |
|---|---|---|
| `users` (app profile) | `users/{uid}` + auth profile | `by_authId`, `by_firebaseUid`; locale, name, image. No provider data |
| `trips` | `trips/{id}` (TripDoc) | `by_firebaseId`, `by_owner`; `joinCode` is dropped |
| `memberships` | `members/{uid}` + `trips/*/users/{uid}` + `users.tripIds` | `by_trip`, `by_user`, `by_trip_user`; role, familyId, memberKey, guest. Replaces three copies and the `t` claim |
| `families` | `families` | `by_trip`; members stay embedded (small, edited together) |
| `places`, `events`, `expenses` | same | `by_trip` (+ `events.by_trip_day`); createdBy is `Id<"users">` |
| `polls` + `pollVotes` | `polls` (votes map) | `pollVotes.by_poll_user`, which removes write contention and simplifies purge |
| `documents` | `documents` + Storage files | `by_trip_visibility`, `by_trip_owner`; `storageId` replaces the path |
| `chatSessions` + `chatMessages` | `chatSessions.messages[]` | `by_session`; avoids the 1 MiB document limit and lets replies stream |
| `locations` | `locations` | `by_trip`, `by_expires` |
| `invites` | `invites` | `by_code`, `by_trip` |
| `imports`, `usage` | same | `by_trip`, `by_trip_month` |
| `rates` (cache) | in-memory cache | refreshed by a daily cron |
| Push tokens | `pushSubscriptions` | `@convex-dev/expo-push-notifications` for native; a `webPushSubscriptions` table only during the transition |

**Logic moves**
- Firestore rules and `authorizeTrip` become helpers in `convex/lib/authz.ts`: `requireUser(ctx)`, `requireMember(ctx, tripId, {roles})`, `requireAdult`, `canDeletePlace`.
- Custom functions wrap them: `userQuery`, `tripQuery` and `tripMutation` via `convex-helpers`. They take `tripId`, load the membership, and never accept userId, role or email from the client.
- Mutations validate input with `v` validators. The client-side zod schemas are re-used in actions where useful.
- The `aboutUs` exception and `membersCanDeletePlaces` become explicit checks inside mutations.

**API routes → Convex**

| Today | Convex |
|---|---|
| `trips` CRUD, invites, redeem, account, purge | mutations. Purge runs as a scheduled internal mutation chain, batching deletes of documents and files |
| AI chat | `chat.send` mutation stores the user message and schedules `internal.chat.run`, an action running the OpenAI tool loop. The action patches the assistant message as it goes. The client subscribes, so there's no Safari 60 s timeout, replies stream, and tools call internal mutations |
| booking / place / enrich / search / destination / photo / trip-assist / place-info / rates | actions with an auth check (`ctx.runQuery(internal.authz…)`), plus quota enforcement in `usage` |
| Uploads | `generateUploadUrl` mutation, then `documents.create({storageId})`; serving through `ctx.storage.getUrl` |
| Reminders (5-minute cron + pinger) | `scheduler.runAt(eventStart − lead)` stored on the event; rescheduled on update, cancelled on delete. A cron handles the expired-location cleanup |
| FCM / web-push | Expo push component for the app. A web-push Node action during the transition only |

**Storage**
- Everything moves to Convex file storage. Volumes are small: trip documents and photos.
- The migration copies each Firebase object into Convex storage and records `storageId`.
- Stored tokenized URLs (chat photos, `ai.avatar`) are rewritten to storage references; `ai.avatar` becomes `{kind: "bot", id} | {kind: "file", storageId}`.
- Google Places photo URLs stay external.

## D. Firebase Auth → Better Auth
**Methods**
- **Apple:** native `expo-apple-authentication` (idToken + nonce) on iOS; web flow on Android and web. It is mandatory under App Store guideline 4.8 because we offer Google. `appBundleIdentifier` is set. The client-secret JWT needs rotating every 6 months; there's a calendar note in the docs.
- **Google:** native idToken through `@react-native-google-signin` on both platforms; redirect on web. `clientId: [web, ios, android]`.
- **Email OTP:** a 6-digit code, the universal fallback, sent through Resend from `no-reply@together.app` (Cloudflare DNS: SPF, DKIM, DMARC).
- **Anonymous:** guest and kid devices from invite links. `onLinkAccount` moves memberships when a guest later signs in.
- **Not offered:**
  - Password login: OTP removes the reset and breach surface.
  - Magic links: unreliable when mail apps open in-app browsers.
  - SSO, which the component doesn't support.

**Sessions**
- Mobile: `expoClient` keeps the session in `expo-secure-store`; the `convex()` plugin issues JWTs to `ConvexReactClient`. We don't set `expectAuth`, so the signed-out onboarding and join preview can still run queries.
- Web: `convexBetterAuthNextJs` handler at `together.app/api/auth/*`, with httpOnly cookies.
- `SITE_URL=https://together.app`, so OAuth redirect URIs live on our domain and no paid Convex custom domain is needed.

**Linking and deletion**
- Account linking is on, with trusted providers google, apple and email-otp.
- `deleteUser` is enabled. Its `beforeDelete` hook runs the app purge: ownership transfer and anonymising data, the same rules as today's `purgeAccount`.

**Identity vs profile**
- Better Auth owns user, account, session and verification.
- A trigger, `triggers.user.onCreate/onUpdate/onDelete`, keeps the app `users` row (`authId`) in sync.
- App code only ever reads `users` and `memberships`.

**Existing-user migration** (`scripts/migrate`, idempotent)
1. Export Firebase Auth with the Admin SDK `listUsers`. For each Google or Apple user:
   - create a Better Auth `user`, with email marked verified when the provider verified it;
   - create an `account` row `{providerId: "google" | "apple", accountId: providerData.uid}` (the provider `sub`);
   - create the app `users` row `{firebaseUid}`.
   - A returning user signing in with Google or Apple then matches by `providerId + accountId`, with email as the linking fallback. There are no duplicates and the data is already attached. Apple subs carry over because the same Apple team is used.
2. Anonymous guests, kid custom tokens (`member-*`) and the shared `trip-member` identity are **not** carried over as logins. Their data is attributed to the family member (`memberKey`) or kept as authored-by-name. Kid devices re-pair with a kid invite link; the trip admins get a one-time "re-invite your kids" notice.
3. Everyone signs in once after cutover; sessions can't be transferred. The app shows a "welcome back, sign in with the same Google/Apple account" screen.

## E. Next.js vs Expo
**`apps/web`, kept long-term**
- The landing page (`/welcome` content moves to `/`), with Hero, Story, Globe, Robot, the Companion orb, the language menu and SEO.
- Legal pages.
- `/j/[code]`: invite preview with OG tags; opens the app via the universal link, otherwise sends people to the stores.
- `/account/delete`: required by Google Play. Signs in with the same Better Auth account.
- The auth proxy route, `/.well-known` (AASA and assetlinks with real IDs), robots, sitemap and `metadataBase`.
- `AppOnboarding` and the UA switch move to mobile as a native onboarding screen.

**`apps/web`, temporary**
- The whole current product, moved onto Convex for phases 5–8, then deleted.

**`apps/mobile`** (Expo Router)
- `(auth)` onboarding and sign-in.
- `trips` hub; `new` wizard (a native stack per step).
- `join/[code]`.
- `t/[tripId]/(tabs)` with tabs Now · Guide · Schedule · Map · Places, plus a More stack (expenses, polls, documents, families, settings, account).
- Sheets for quick add and the event, place and expense forms.

**Native replacements**

| Web today | Mobile |
|---|---|
| `<input type=file>` + canvas resize | `expo-image-picker`, `expo-document-picker`, `expo-image-manipulator` |
| `navigator.share` | `Share` |
| Google Maps JS | `react-native-maps` |
| Geolocation | `expo-location` (foreground) |
| Push | `expo-notifications` |
| Fonts | `expo-font`, same families |
| RTL | `I18nManager` + `Updates.reloadAsync` |

## F. Shared packages (only where they pay off)
- **`packages/backend`:** `convex/` (schema, functions, Better Auth local component, crons, http), with generated `api` and `Doc` types exported as `@together/backend`. Both apps import from it.
- **`packages/shared`:** pure domain code with no React, DOM or Firebase.
  - Settlement, currency, trip days, `tripConfigFromDoc` (→ `tripView`), `composePersona` and presets, `place-name`, booking and trip zod schemas, avatars, nav (Waze/Maps URLs), participants, design tokens (`tokens.ts`), domain types.
  - Convex re-uses it too: dedupe, personas, settlement.
- **`packages/i18n`:**
  - Messages (4 locales), `translate`, config, format, `TKey`. Used by web, mobile and Convex (localized push and AI text).
  - Platform adapters stay in each app: cookie on web, AsyncStorage + reload on mobile.
- **`packages/config`:** tsconfig bases (strict), eslint and prettier.
- **Not shared:** UI components, hooks tied to the platform, auth clients (about 20 lines per app). There is no `packages/auth` or `ui` until something real needs sharing.

## G. Migration phases (repo runnable and deployable after each)
**P0 · Baseline**
- Finish the review of the in-flight redesign, commit it, merge `hotfix`, build, deploy.
- Write the docs:
  - `docs/architecture/current.md` (this audit)
  - `docs/architecture/target.md`
  - `docs/migration/checklist.md`: a feature × web/mobile/backend/auth/tested matrix covering the 40 features, updated every PR.

**P1 · Monorepo**
- pnpm workspace + Turborepo. `git mv` the app to `apps/web` with no code changes.
- Vercel Root Directory becomes `apps/web` and the install command becomes pnpm. Update the `deploy.yml`/`preview.yml` paths.
- Confirm the production build is byte-identical in behaviour.
- Keep `jwks-rsa` as a pnpm override while firebase-admin remains.

**P2 · Shared packages**
- Move pure logic and i18n into `packages/shared` and `packages/i18n`; web imports them.
- Replace the module globals with parameters (web keeps a thin adapter).
- Add vitest for settlement, currency, place-name, translate (plurals and fallback) and the schemas.

**P3 · Convex + Better Auth foundation (dev deployment, EU)**
- `packages/backend`: schema, authz helpers, Better Auth local install with Google, Apple, email OTP (Resend) and anonymous, the `users` trigger.
- Domain functions ported from `lib/server/*`: trips, memberships, invites, families, places, events, expenses, polls, documents, chat, imports, locations, usage, rates, push, purge.
- convex-test suites for authorization (non-member denied, kid limits, owner-only purge, invite expiry and uses) and the critical mutations.

**P4 · Migration tooling**
- `scripts/migrate/{export,transform,load,files,verify}.ts`:
  - **export:** read-only Firestore, Auth and Storage listing written as a timestamped JSONL snapshot.
  - **transform:** pure, unit-tested functions. Normalize timestamps, drop malformed rows into a report, dedupe, map ids by firebaseId.
  - **load:** internal `migration.upsert*` mutations via the deploy key; batched, idempotent upserts by `firebaseId`; references resolved through indexes.
  - **files:** an action streams objects from the bucket into Convex storage, keyed by Firebase path.
  - **verify:** counts per table, orphan refs, balances recomputed against `verify-expense-balances`.
- Rehearse on the dev deployment with a production snapshot until the verify output is clean.

**P5 · Web product on Convex (behind a flag)**
- Swap the data layer in `apps/web`. `useCollectionData`/`useDocData` become `useQuery(api.*)`; `db.ts` becomes `useMutation`; `apiFetch` routes become actions; uploads go to `generateUploadUrl`; `FirebaseProvider` becomes `ConvexBetterAuthProvider`; sign-in becomes the Better Auth client.
- Delete the Next API routes, the legacy gate, the cookie, the proxy branches and the `/sardinia` and `/t` re-export trees as each is replaced.
- Run the Playwright harness against Convex dev in he, en, ar and es.

**P6 · Production cutover (about a 30-minute write freeze)**
- Maintenance banner, then the final export → load → files → verify on Convex prod, then deploy the Convex web build, then smoke-test as a real user.
- Rollback: redeploy the previous Vercel build. Firestore was frozen, so it is still consistent. Keep Firebase read-only for 30 days.

**P7 · Expo app**
- Scaffold `apps/mobile` with SDK 57, Expo Router, EAS profiles (development, preview, production) and `app.config.ts`:
  - bundle `app.together.trips`
  - scheme `together`
  - associated domains `applinks:together.app`
  - `usesAppleSignIn`
  - expo-localization RTL
- Auth screens first, then screens in value order: trips hub · join · trip home · schedule + event sheet · places, detail and add · map + live location · AI chat (streaming) · expenses + settle · polls · documents · families/settings/invites/members · creator wizard · account/delete.
- Push through the Expo component, with the reminders scheduler delivering to the app.

**P8 · Store launch**
- EAS Build/Submit to TestFlight and Play internal testing.
- AASA (real Team ID) and assetlinks (Play signing SHA-256) on together.app.
- Review checklist: Apple sign-in, in-app deletion, privacy labels, demo account.
- The web `/j` page starts sending people to the stores.

**P9 · Cleanup**
- Remove the product from `apps/web` (landing, join, legal and account deletion stay).
- Remove `firebase`, `firebase-admin`, Capacitor, `ios/`, `android/`, `native-shell/`, `codemagic.yaml`, the rules files, the reminders and admin workflows, VAPID and `sw.js` push.
- Archive the final Firestore export. Delete the Firebase project after 90 days.

## H. Risks
1. **Better Auth version lock.** The component needs 1.6.x and is a pre-1.0 component. Pin exact versions and add a renovate rule so upgrades happen deliberately.
2. **Auth-table import with Local Install.** Validated in P4 rehearsal; the fallback is lazy linking by verified email at first sign-in.
3. **Kids, guests and shared logins lose their credential.** Mitigated by re-invite links and an admin notice. A few users are affected; Omer is informed.
4. **Turbopack with pnpm symlinks.** Seen earlier with a symlinked `node_modules`. Mitigation: `turbopack.root` / `outputFileTracingRoot` at the repo root, and `nodeLinker: hoisted` if needed. Verified in P1 before anything else.
5. **Vercel Sensitive env.** The remote build stays and `--prebuilt` is never used; the Root Directory change is tested first on a preview.
6. **Long OpenAI loops.** Actions have a 10-minute limit; the loop is split per tool round via the scheduler if needed. Actions are not auto-retried, so idempotent tool writes are keyed by message id.
7. **RTL and Hebrew typography in RN**, plus forced-RTL restarts and `textAlign` quirks. Each screen is checked in he and ar from day one.
8. **Store review** (4.2 minimum functionality, 4.8 sign-in, 5.1.1 deletion). Covered in P8.
9. **Data shape drift in legacy Sicily docs.** Transform reports malformed rows rather than guessing.
10. **Cost.** EU paid tier is about 30% more. Free tier covers the current scale; watch bandwidth from file serving.

## I. Final repository tree
```
together/
├── apps/
│   ├── web/                 Next.js 16: landing, /j/[code], legal, account delete, api/auth proxy
│   └── mobile/              Expo SDK 57 + Expo Router (app/, components/, lib/, app.config.ts, eas.json)
├── packages/
│   ├── backend/             convex/{schema,auth,http,crons,lib/authz,betterAuth/,trips,members,
│   │                        invites,places,events,expenses,polls,documents,chat,imports,
│   │                        locations,push,rates,usage,purge,migration}.ts + tests
│   ├── shared/              domain logic, zod schemas, tokens, types
│   ├── i18n/                messages he/en/ar/es, translate, format, config
│   └── config/              tsconfig, eslint, prettier
├── scripts/migrate/         export · transform · load · files · verify (TS, tested)
├── docs/                    architecture/, migration/checklist.md, design/, native-apps.md
├── turbo.json · pnpm-workspace.yaml · package.json
└── .github/workflows/       web deploy (Vercel), convex deploy, eas build
```

## Environment strategy
- **Convex deployments:** `dev` (per developer), `preview`, `prod`, all EU. Server secrets live only in Convex env: `BETTER_AUTH_SECRET`, `SITE_URL`, Google and Apple secrets, `RESEND_API_KEY`, `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`, `EXPO_ACCESS_TOKEN`.
- **Next.js:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL` (public by design). Nothing secret on web after P9.
- **Expo:** `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`, the Maps SDK keys (restricted by bundle and package). Secrets are **never** set as `EXPO_PUBLIC_*`. EAS environments (development, preview, production) mirror the Convex deployments.
- `.env.example` per app and package documents every name.

## Verification
- **Every phase:** `pnpm turbo build lint typecheck test` green, then a Vercel preview, then the Playwright screenshot sweep (390 and 1440 px, he/en, spot-checks in ar/es).
- **Backend:**
  - convex-test authorization matrix: non-member, kid, member, admin, owner, guest.
  - Mutation tests: settle up, poll vote, invite redeem limits, purge.
  - Transform unit tests on real anonymised fixtures from the snapshot.
  - The verify report must be clean before cutover.
- **Auth:**
  - Rehearsal: sign in with Omer's real Google account against dev after the import. The same user is matched and his trips are visible.
  - Apple native on a TestFlight build. Email OTP end to end. Guest to Google linking keeps memberships.
- **Mobile:** EAS development builds on a real iPhone and Android device; deep links `together://` and `https://together.app/j/<code>`; push reminder received; RTL in he and ar.
- **Cutover:** smoke script plus manual pass over trips, schedule, places, AI chat, expenses, polls and documents on production with a real account.

## What happens right after approval
Start P0, then P1: commit and deploy the reviewed redesign, write the architecture and checklist docs, then the monorepo move with a preview deploy check. Each step is a reviewable commit. I stop for Omer only for things that need his accounts:
- `npx convex login`
- the Google/Apple console client IDs
- the Resend DNS records in Cloudflare
- Vercel project settings
