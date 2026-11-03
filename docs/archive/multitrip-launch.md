# Multi-trip launch runbook

Self-serve trips (`/welcome`, `/trips`, `/new`, `/j/<code>`, `/t/<tripId>`)
ship **alongside** the legacy Sicily/Sardinia trips, which keep their
password/cookie model untouched until they are switched over.

## Order of operations

1. **Merge the branch** (CI deploys production). Nothing changes for the
   existing families: `/`, `/sardinia/*`, cookies and data are the same.
   New visitors without a cookie land on `/welcome` instead of the Sicily gate.
2. **Deploy rules**: `gh workflow run admin.yml -f script=deploy-rules.mjs`.
   The new rules are backward compatible (the legacy branch is unchanged —
   see `tests/rules.test.mjs`, 32 cases).
3. **Vercel env** (production + preview):
   - `CRON_SECRET` (any long random string) — also as a GitHub repo secret,
     enables `.github/workflows/reminders.yml` (server-side reminders).
   - Google Cloud: enable the **Time Zone API** on the server Maps key
     (destination time zone; falls back to a country table without it).
   - Optional `NEXT_PUBLIC_APPLE_SIGN_IN=1` once Apple sign-in is configured.
   - Firebase console → Authentication → Sign-in method → enable
     **Anonymous** (guest join without an account, kids' phones).
4. **Migration (prep only)**: `migrate-multitrip.mjs` (dry run) →
   `migrate-multitrip-apply.mjs`. Writes `members/*`, root `users/*.tripIds`
   and storage claims for legacy Google users — invisible until a legacy
   trip is switched to the new access model.

## Testing locally (no live data)

```bash
npx firebase-tools emulators:start --project demo-trips --only auth,firestore,storage
# in another shell — see e2e env in docs: NEXT_PUBLIC_FIREBASE_EMULATORS=1,
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080, FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099,
# FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199, NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-trips
npm run dev
npm run test:rules      # with the emulators running
```

With `NEXT_PUBLIC_FIREBASE_EMULATORS=1`, `window.__e2eSignIn(name, email)`
signs in a fake Google user (emulator only).

## Free-plan limits (`src/lib/server/usage.ts`)

5 active trips per organizer · 40 members per trip · 400 AI messages and
60 booking imports per trip per month. `TripDoc.plan` is where paid plans plug in.
