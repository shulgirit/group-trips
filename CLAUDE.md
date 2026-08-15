# Sicily Together (סיציליה 2026) — agent handoff

Private, Hebrew-first, RTL, mobile-first PWA for four Israeli families
("חבורת מיחא" — parents and deaf kids with cochlear implants) traveling in
Sicily **Aug 15–24, 2026**. Production: https://sicily-together.vercel.app
(Vercel project `sicily-together`, scope `omer-9257s-projects`).

> ## ⚠️ THE APP IS LIVE AND IN USE DURING THE TRIP
> Real families depend on it right now. Before every push: `npm run build`
> must pass, think about data migrations (Firestore has live data), and
> prefer additive changes. Never create test data without deleting it after.

## Ship a change

**`git push origin main` = production deploy.** GitHub Actions
(`.github/workflows/deploy.yml`) runs `vercel pull/build/deploy --prebuilt
--prod` using repo secrets `VERCEL_TOKEN` / `VERCEL_ORG_ID` /
`VERCEL_PROJECT_ID`. No local Vercel login needed. (From Omer's laptop,
`npx vercel deploy --prod --yes --scope omer-9257s-projects` also works.)

All runtime secrets live in **Vercel env** (production + preview): Firebase
client + admin, `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`,
`GOOGLE_MAPS_API_KEY`, VAPID keys, `TRIP_PASSWORD`, `SESSION_SECRET`.
Locally they're in `.env.local` (gitignored). **Never commit secrets.**

## Stack

Next.js 16 App Router (Turbopack) · TypeScript strict · Tailwind **v4**
(`@theme` tokens in `globals.css`) · Firebase (Firestore/Storage/Auth,
client SDK + Admin SDK) · OpenAI `gpt-5.1` · Firecrawl v2 · Google Places
API (New) · web-push · Vercel. Node 22 (`engines`), npm `overrides` pins
`jwks-rsa@3.2.0` (ESM crash on Vercel otherwise — don't remove).

## Map

- `src/proxy.ts` — middleware (v16 rename). Gates all routes on the HMAC
  `trip_session` cookie. Matcher **excludes** `images/`, `sw.js`,
  `api/auth/session`, `api/auth/kid-login` — keep exclusions when adding
  public assets/endpoints.
- `src/app/(app)/*` — pages: home (עכשיו), ai (המשרת), calendar (לו״ז), map,
  places, polls, expenses, photos, documents, families, settings.
- `src/app/api/ai/chat/route.ts` — the AI servant ("המשרת של חבורת מיחא"
  🦻✨). System prompt + trip context builder + tool loop (add_place,
  search_google_places, create_event, create_poll, add_poll_option,
  enrich_place), vision via imageUrl parts, speaker identity from body,
  reasoning_effort medium→low (Safari kills fetches ~60s), maxDuration 300.
- `src/lib/db.ts` — all client Firestore writes (places/events/polls/
  expenses). Places dedupe via `src/lib/place-name.ts` (`samePlaceName`:
  exact normalized OR containment only when shorter name has ≥2 words and
  ≥8 chars — the guard prevents "Erice" absorbing "Erice Adventure Park").
  Places/events stamp `createdByUid`/`createdByName`.
- `src/lib/server/` — `firebase-admin.ts`, `import-place.ts`
  (`geocodePlace` = Places searchText + photo + rating;
  `importPlaceFromUrl` via Firecrawl), `enrich.ts`, `push.ts`
  (`sendPushToAll` with excludeUid).
- `src/app/api/push/*` — subscribe / notify / check-reminders (polled every
  5 min by `ReminderPinger` — Hobby plan has no cron). `public/sw.js` shows
  pushes; `navUrl` payload adds a "נווט 🧭" action opening Waze.
- Firestore under `trips/sicily-2026/*`: places, events, families, polls,
  expenses, photos, documents, chatSessions, users, pushSubscriptions,
  settings. Types in `src/types/index.ts`.

## Auth model (unusual — read before touching)

- Google sign-in (personal users) + one-time join code `italy2026`; kids log
  in by picking their name → `/api/auth/kid-login` mints a custom token
  (uid `member-{memberId}`) + `users/{uid}` profile.
- Everyone gets Firebase custom claim **`member: true`** — Storage rules
  depend on it (cross-service `firestore.exists` is NOT provisioned).
  Any new token-minting path must set it.
- Legacy HMAC cookie `trip_session` still gates routes in `proxy.ts`.
- `isPersonalUser()` (Google) gates destructive UI (e.g. only Google
  accounts may delete places).
- **Firestore/Storage rules deploy via REST API script, not the CLI** (CLI
  lacks serviceusage permission). See git history for the deploy snippet.

## Design system

Tailwind v4: component classes (`.card`, `.btn-*`, `.chip`, `.field`) are
defined in `@layer components` in `globals.css` — **you cannot `@apply` a
custom class in v4**; group selectors instead. Font: Heebo only (user
rejected serif). Home countdown is `dir="ltr"`, days leftmost, clock-style —
**do not flip it**. Bottom nav order (RTL): עכשיו · המשרת (gold bubble,
same size as siblings) · לו״ז · מפה · מקומות · עוד.

## Hard-won gotchas

- User-visible text is Hebrew; keep RTL layout intact (`dir`, logical
  margins). Test flows on mobile widths (~390px).
- Push a new event/poll notification **once per action**, not per option.
- AI must never claim it lacks Google Maps access (it has
  `search_google_places`); address+schedule requests chain
  add_place → create_event.
- `updateEvent` clears `reminderSentAt` (deleteField) so moved events
  re-remind.
- Verification pattern: `npm run build` first, and for UI use
  playwright-core headless screenshots (a `shot.mjs` with the session
  cookie; suppress the onboarding tour via localStorage
  `micha-tour-seen-v1`).

## Firebase admin access from cloud/remote sessions

The service-account JSON is **not in git** (only on Omer's laptop and in
the `FIREBASE_SERVICE_ACCOUNT` repo secret — keep it that way). Remote
sessions run admin/data-fix scripts through GitHub Actions:

1. Write a script under `scripts/admin/<name>.mjs` (use
   `applicationDefault()` credentials — see `health-check.mjs`), commit,
   push.
2. `gh workflow run admin.yml -f script=<name>.mjs`
3. `gh run watch $(gh run list --workflow=admin.yml -L1 --json databaseId -q '.[0].databaseId') --exit-status`
   then `gh run view --log` for output.

Remember the push in step 1 also triggers a production deploy — scripts
are harmless to the build, but the usual "build must pass" rule applies.
Prefer read-only checks first; the app is live.
