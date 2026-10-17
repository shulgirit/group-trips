# HANDOFF — read this first (written 2026-10-17)

Another agent (or session) can continue from here without the earlier chat. Also read:
[`NEXT.md`](NEXT.md) (prioritised to-do), [`CUTOVER.md`](CUTOVER.md) (production cutover runbook),
[`CLAUDE.md`](CLAUDE.md) (project rules), [`docs/environments.md`](docs/environments.md),
[`docs/architecture/migration-plan.md`](docs/architecture/migration-plan.md) (the approved plan),
[`docs/migration/checklist.md`](docs/migration/checklist.md) (feature × platform matrix).

## What this project is
"Together" (ex "Sicily Together"): a private, Hebrew-first RTL trip-planning app (schedule, places/map, expenses,
polls, documents, AI guide, invites). It started as a PWA for four Israeli families in Sicily (Aug 2026) and is
becoming a self-serve product for anyone. Owner: **Omer** (omer@wiply.com; Google account `omertalmail@gmail.com`).
Omer says: *make decisions, don't ask constantly; don't re-litigate things he has confirmed.*

> ⚠️ **Production is LIVE** on branch `main` (Next.js + Firebase, https://sicily-together.vercel.app, also
> `trips.wiply.co.il` and `togethergroup.app`). Real families use it. **`git push origin main` = production deploy.**
> The migration lives on branch **`convex-web`** and must NOT be merged until the cutover (see CUTOVER.md).

## The migration in one paragraph
Firebase (Auth/Firestore/Storage/FCM) + Capacitor webview → **Convex** (data, files, scheduler, actions) +
**Better Auth** (Google, Apple, email code, guest) + a native **Expo React Native app** (`apps/mobile`) and a
Next.js site (`apps/web`) that, after the store launch, is only landing + invite/join + legal + account deletion.
pnpm + Turborepo monorepo.

## Repo map
| Path | What |
|---|---|
| `apps/web` | Next.js 16. Today still the whole product (on Convex on this branch). Landing `/welcome`, `/j/[code]`, legal, `/api/auth/*` proxy to Convex. |
| `apps/mobile` | Expo SDK 57 + Expo Router app. All trip screens built (see NEXT.md for gaps). `app.json` = production identity, `app.config.ts` = dev identity. |
| `packages/backend` | Convex: `convex/*` (schema, authz, domain modules, chat/AI, push, migration), `client/shapes.ts` + `client/creator.ts` (shared by both apps), `test/` (convex-test, 26 tests). |
| `packages/shared` | Pure domain code (settlement, trip-doc/`tripConfigFromDoc`, nav, tokens…). |
| `packages/i18n` | he/en/ar/es messages + `translate` (has a Hermes plural fallback). |
| `packages/integrations` | Server-only: OpenAI chat/tools, Google Places, Firecrawl, booking import, enrich. |
| `scripts/migrate` | Firestore/Auth/Storage → Convex: `export`, `load`, `verify` (idempotent, tested). |
| `apps/web/scripts/admin`, `.github/workflows/admin.yml` | Legacy Firebase admin scripts (removed in P9). |

## Environments (details: `docs/environments.md`)
- **Production domain `togethergroup.app`** (apex is primary, `www` redirects to it). **Dev domain `togehter.app`**
  (a typo'd domain Omer bought; `together.app` is taken). Preview domains are behind Vercel login (Vercel can't
  exempt a preview domain without opening all previews — don't), so **dev web = `localhost:3100`**.
- **Convex dev** `mild-caterpillar-988`, **prod** `tidy-dodo-188` (both EU, project "Together", team `omer-tal`).
  Both have the backend deployed. **Prod is empty** until the cutover.
  - dev env: `SITE_URL=http://localhost:3100`, `EXTRA_TRUSTED_ORIGINS`, `AUTH_DEV_LOG_OTP=1` (login codes in logs, no email), no `RESEND_LIVE`.
  - prod env: `SITE_URL=https://togethergroup.app`, `RESEND_LIVE=1`, own `BETTER_AUTH_SECRET` + VAPID pair. **Never set `AUTH_DEV_LOG_OTP` on prod. Never reuse a secret across deployments.**
- **Vercel** project `sicily-together` (`prj_oTQPSskIBzTHjTdC62uySYKeOtu1`, scope `omer-9257s-projects`). I administer it with
  `npx vercel api …` (the CLI isn't linked in `apps/web`). Remote build only — **never `--prebuilt`** (NEXT_PUBLIC vars are Sensitive).
  Preview env → dev Convex; Production env → prod Convex but **inert until the merge** (live build is Firebase code).
  Production `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is still the OLD Firebase-era key — switch it at cutover.
- **Email**: Resend, domain `togethergroup.app`, region Ireland, **verified**. From `Together <no-reply@togethergroup.app>`.
  (Cloudflare may still hold a stale duplicate `resend._domainkey` TXT from the first Tokyo attempt — harmless, clean when convenient.)
- **Google OAuth** (GCP project "Group Trips" `group-trips-2f753`, only used as an OAuth client): Web client
  `189376911004-l5ffls48m7tr1vbc1c98a71432gnddhf.apps.googleusercontent.com`, origins/redirects for both domains + localhost:3100.
  Secret is in Convex env (dev+prod). The mobile app signs in with Google through the browser flow (callback via `SITE_URL`).
- **Cloudflare** holds DNS for both domains. A/CNAME for Vercel exist for both.
- **Apple**: waiting for Omer's Apple Developer approval. Backend ignores Apple until `APPLE_CLIENT_ID` is set; **TODO: hide the Apple button in the app until configured**.
- **Expo/EAS**: NOT initialised. Omer must run `npx eas-cli login` and `cd apps/mobile && npx eas-cli init` (writes `extra.eas.projectId`
  — push tokens can't register without it). Then create EAS env vars per profile (see `apps/mobile/eas.json`, `.env.example`).

## How to work locally
```bash
pnpm install
# backend (cloud dev):  cd packages/backend && npx convex dev      (already linked to mild-caterpillar-988 via .env.local)
# web:    apps/web/.env.local → NEXT_PUBLIC_CONVEX_URL/SITE_URL of dev cloud (a copy for the old local backend: .env.local.localbackend)
#         cd apps/web && npx next dev -p 3100
# mobile: cd apps/mobile && npx expo start --clear     (Expo Go on the iOS simulator works; Xcode here is 16.2, no local native builds)
#         open routes with: xcrun simctl openurl booted "exp://127.0.0.1:8081/--/t/<tripId>/schedule"
#         dev-only sign-in: route /dev-sign-in?email=…&otp=…  (the OTP is in `npx convex logs` because AUTH_DEV_LOG_OTP=1 on dev)
pnpm --filter @together/backend test     # 26 tests;   also: packages/i18n (6), scripts/migrate (13), apps/*: npx tsc --noEmit, mobile: npx expo lint
```
Verified end to end on **cloud dev** on 2026-10-17: email-code sign-in on web, AI chat (OpenAI + Places + scheduler, ~20 s).
Mobile verified in the iOS simulator (Hebrew/RTL) against the *local* anonymous Convex; not yet on a physical device.

## Decisions already made (don't reopen)
- After store launch the web is landing + join + legal + account deletion only; all trip features live in the app.
- Sicily and Sardinia migrate as normal trips. The shared password and the kid pick-your-name login are **retired**;
  kids re-join with a kid invite link; trip admins should get a one-time "re-invite your kids" notice.
- Better Auth is pinned to **1.6.x** (`@convex-dev/better-auth` 0.12.x doesn't support 1.7) — don't upgrade casually.
- Expo SDK 57 (SDK 58 judged too new). No state libraries; Convex `useQuery` + React state. No shared UI package.
- Convex custom domain isn't used; OAuth redirects live on the web domain (`SITE_URL`), which proxies `/api/auth/*` to Convex.
- Pronouns: never infer from names (use they/them).

## Security & hygiene rules
- Never commit secrets. The Firebase service-account JSON (`group-trips-2f753-firebase-adminsdk-fbsvc.json`, repo root) is
  gitignored and exists only on Omer's laptop + the `FIREBASE_SERVICE_ACCOUNT` repo secret. Never print secret values.
- Migration snapshots (`scripts/migrate/.migrate/`, mode 600, gitignored) contain real users' PII (emails, kids' names):
  **never print or commit their contents**; counts only. A real snapshot from 2026-10-17 is on Omer's laptop.
- Omer's prod deploy key is exported only in *his* terminal as `CONVEX_DEPLOY_KEY` — an agent can't see it; ask him to run prod commands
  that need it, or use `npx convex env set --prod …` / `npx convex deploy --yes` which work through the logged-in CLI.
- Confirm before outward-facing or security-setting changes (e.g. Vercel protection, DNS). He is generally fine with CLI-doable
  setup done for him; give click-by-click steps only for consoles an agent can't reach (Cloudflare, Google, Apple, Expo, Resend).

## Gotchas learned the hard way
- Metro: `apps/mobile/metro.config.js` pins `react` to the app's copy (pnpm shares packages built against the web's newer React). After adding
  native deps run `npx expo start --clear`; a stale bundle shows "Cannot find native module …".
- Hermes has no `Intl.PluralRules` (fallback in `packages/i18n/src/translate.ts`), no `crypto.getRandomValues` (`apps/mobile/src/lib/polyfills.ts`), no `Intl.DisplayNames`.
- React Compiler lint forbids `setState` in effects — derive state or use the "compare previous prop during render" pattern.
- RTL: `I18nManager` reload happens once per direction change; Expo Go needs `extra.supportsRTL`; real builds use `CFBundleLocalizations`.
- Home countdown stays LTR with days leftmost (Omer's rule). Bottom-tab order (RTL): Now · Guide · Schedule · Places · More.
- `npx convex logs` streams forever — run it in the background to a file, never in the foreground.
- Vercel `api` CLI: PATCH/POST bodies via `--input -` with JSON; one object per POST for env vars; strip the CLI banner before parsing JSON.
- Pushing to `main` deploys production. Pushing other branches builds a Vercel preview via `.github/workflows/preview.yml`.

## State of each area (2026-10-17, branch `convex-web`, HEAD `76f65dd`)
- Convex backend: done, deployed to dev + prod, 26 tests. Authorization via `userQuery/tripQuery/tripMutation` (`convex/lib`).
- Web on Convex: done and verified locally and on cloud dev. Not yet live.
- Mobile: all screens built and type/lint clean; simulator-verified; push code written (backend tested) but unverified on a device.
- Migration tooling: export/load/verify built; **real export done** (3 trips, 20 users, 109 places, 77 events, 69 expenses, 72 chat sessions,
  27 files); dry-run load OK. The **real load + verify rehearsal passed on the local Convex** (idempotent, counts match).
- Store launch, AASA/assetlinks, Apple, Expo init, production cutover, Firebase/Capacitor cleanup: **not started**.
