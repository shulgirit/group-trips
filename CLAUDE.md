# Together — agent handoff

Together is a trip-planning app for groups: an **Expo mobile app** (iOS live on the App Store, Android in progress),
a **Convex + Better Auth backend**, and a **Next.js landing site**. There is no web product: the only web pages are
the landing page, invite links, legal pages and account deletion. (The old Sicily/Firebase web app, Capacitor shells
and the Firestore migration tool are gone; see `docs/archive/`.)

> **The apps are live and used by real people.** Think about data and migrations before changing the Convex schema
> (additive only), never push test data to production, and never deploy to production without the owner's explicit go.

## Monorepo (pnpm + Turborepo)
Root: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` (all via turbo). CI (`.github/workflows/ci.yml`)
runs typecheck + tests on every push; `preview.yml` deploys web previews; `deploy.yml` deploys the landing site.

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 57 app (expo-router, Convex client, EAS builds + OTA). Package `@together/mobile`. |
| `apps/web` | Next.js 16 landing only: `/welcome`, `/j/[code]` (opens the app / store), `/privacy`, `/terms`, `/support`, `/account` (+ `/delete`), `/api/auth`, `.well-known` (universal links). |
| `packages/backend` | Convex (schema, functions, AI chat + planner, crons) + convex-test/vitest. Dev `mild-caterpillar-988`, **prod `tidy-dodo-188`**. |
| `packages/shared` | Pure domain code (holiday/date resolver, settlement, tokens, trip types). |
| `packages/i18n` | Messages (he/en/ar/es) shared by mobile and web. |
| `packages/integrations` | OpenAI (gpt-5.1), Google Places, Firecrawl wrappers; the AI planner. |

## Services
Convex (db, storage, functions, EU) · Better Auth (inside Convex; Google, Apple, email OTP) · Resend (OTP email) · OpenAI ·
Google Maps Platform (Places, Android map key) · Firecrawl · Expo/EAS (builds, push, OTA) · Vercel (landing) · PostHog
(product analytics, US cloud, id-only) · Sentry (crash reports, EU, org `tal-pituach`, project `react-native`).
Production secrets live in Convex env (`npx convex env list --prod`, never print values), EAS env (`eas env:list production`)
and Vercel env (project `sicily-together`, scope `omer-9257s-projects`; the name is historical).

## Shipping
- **Backend:** `cd packages/backend && npx convex deploy --yes` (production; owner's go required). Codegen: `npx convex dev --once`.
- **Landing site:** push to `main` → GitHub Action `deploy.yml` → `vercel deploy --prod` (remote build on Vercel; never `--prebuilt`).
  Other branches get Vercel previews (behind Vercel login). Domains: `togethergroup.app` (primary).
- **App OTA (JS only):** `bash apps/mobile/scripts/ota.sh <testflight|production> "message"`. Android: prefix `EAS_BUILD_PLATFORM=android`
  (different runtime fingerprint). Export `SENTRY_AUTH_TOKEN` in the shell first so source maps upload. `docs/ota.md` has details.
- **Store builds (native changes):** `npx eas-cli build --platform ios|android --profile production`, then upload the iOS `.ipa`
  with Transporter (Expo submit has been unreliable) and attach it to the version in App Store Connect.
  Store texts, permission reasons and privacy answers: `docs/store/`.
- Analytics/Sentry only run in production builds (`EXPO_PUBLIC_APP_ENV=production`); keys are public env vars in `eas.json` + EAS env.

## Conventions and gotchas
- User-visible text goes through `@together/i18n` (all four languages, Hebrew/Arabic are RTL — use logical start/end styles).
- Convex field names must be plain ASCII (use arrays of `{key,value}` instead of objects keyed by free text).
- pnpm blocks install scripts unless listed in `pnpm-workspace.yaml` `allowBuilds`; `@sentry/cli` must stay a direct dependency of `apps/mobile`.
- The AI planner (`packages/integrations/src/planner.ts`, `packages/backend/convex/planner*.ts`) retries model calls, has timeouts and a
  watchdog; tentative trips are private to the creator until published.
- Tests: `pnpm --filter @together/backend test` (convex-test). Run `pnpm typecheck` before pushing; it must pass for CI.
