# CUTOVER — move production from Firebase to Convex (runbook, draft 2026-10-17)

Goal: `togethergroup.app` / `sicily-together.vercel.app` switch from the Firebase build (`main`) to the Convex build (`convex-web`) with
~30 minutes of write freeze. **Real families depend on the app — do not start without Omer's explicit go and a quiet moment (not mid-trip day,
not in the evening when people post expenses).** Rollback is a redeploy of the previous Vercel build; Firestore stays untouched.

## 0. Pre-flight (all must be true)
- [ ] NEXT.md section A done (rehearsal load + verify clean, welcome-back + kid re-invite notice, Apple button hidden, account-delete page).
- [ ] `convex-web` is rebased/merged with the latest `main` (hotfixes!) — `git fetch && git log main..origin/main`; typecheck/tests/build green:
      `pnpm turbo typecheck lint test build` (web: `pnpm --filter @together/web build`).
- [ ] Convex prod `tidy-dodo-188` has current code: `cd packages/backend && npx convex deploy --yes` (and `npx convex env list --prod` has
      BETTER_AUTH_SECRET, SITE_URL=https://togethergroup.app, GOOGLE_CLIENT_ID/SECRET, RESEND_API_KEY, RESEND_LIVE=1, OPENAI/FIRECRAWL/GOOGLE_MAPS keys, VAPID_*; **no AUTH_DEV_LOG_OTP**).
- [ ] Vercel Production env has `NEXT_PUBLIC_CONVEX_URL`/`_SITE_URL` (prod) and `NEXT_PUBLIC_SITE_URL=https://togethergroup.app` (already set) and the **new** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = prod's `VAPID_PUBLIC_KEY` (set it as part of step 5, not earlier).
- [ ] Omer has `CONVEX_DEPLOY_KEY` (prod) exported in his terminal and is reachable. Real sign-in test account ready (his Google account).
- [ ] Announce to the families a short maintenance window.

## 1. Freeze writes on the Firebase app
Deploy a maintenance banner / read-only flag to `main` (small, additive change) **or** simply agree a quiet window. Firestore must not change between
the final export and the switch.

## 2. Final export (read-only)
```bash
GOOGLE_APPLICATION_CREDENTIALS=$PWD/group-trips-2f753-firebase-adminsdk-fbsvc.json pnpm --filter @together/migrate export
# prints counts only; writes scripts/migrate/.migrate/<ts>/snapshot.json (mode 600, gitignored). Never print/commit it.
```
## 3. Load + verify on Convex PROD (idempotent; safe to re-run)
```bash
export CONVEX_URL=https://tidy-dodo-188.eu-west-1.convex.cloud     # CONVEX_DEPLOY_KEY is in Omer's shell (prod key)
GOOGLE_APPLICATION_CREDENTIALS=$PWD/group-trips-2f753-firebase-adminsdk-fbsvc.json \
pnpm --filter @together/migrate load -- --snapshot .migrate/<ts>/snapshot.json \
  --legacy-owner-email omertalmail@gmail.com --site-url https://togethergroup.app --dry-run     # review counts/warnings first
# then the same command without --dry-run (copies 27 files into Convex storage, upserts users/trips/memberships/places/events/expenses/polls/documents/chats/invites)
pnpm --filter @together/migrate verify -- --snapshot .migrate/<ts>/snapshot.json      # counts, orphans, expense balances
```
Expected (2026-10-17 snapshot): users 20, trips 3, memberships 13, places 109, events 77, expenses 69, polls 4, documents 2, chats 72, invites 3;
warnings `seat_not_migrated` 8 (kid/shared logins) and `placeholder_user` 1. **Stop if verify isn't clean.**
Sign-in matching: returning Google users match by provider account id (imported `account` rows), so their trips are attached on first sign-in.

## 4. Smoke test on Convex prod *before* switching traffic
Point a local web at prod (`NEXT_PUBLIC_CONVEX_*` of tidy-dodo-188, `SITE_URL` must equal the origin you test from — easiest is to test right after step 5 on the real domain).
As Omer (real Google): trips visible (Sicily, Sardinia), schedule/places/expenses match the old app, AI chat replies, upload a document, invite link opens `/j/<code>`.

## 5. Switch (this is the production deploy)
1. Set Vercel Production `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the prod key (value from `npx convex env get VAPID_PUBLIC_KEY --prod`; never print it in logs/chat unnecessarily — it's public but keep tidy).
2. `git checkout main && git merge --no-ff convex-web && git push origin main` → GitHub Actions `deploy.yml` runs `vercel deploy --prod` (remote build). Watch: `gh run watch`.
3. Check `https://togethergroup.app/welcome` (200), `/api/auth/ok`, sign in with Google + email code (real email arrives from `no-reply@togethergroup.app`).
4. Old URLs: `next.config` redirects legacy `/…` routes to `/t/sicily-2026/…` and `/t/sardinia-2026/…` (trip refs resolve Firestore ids via `trips.resolve`).

## 6. After the switch
- Tell the families: sign in once with the same Google account; kids use the new kid invite link (admins got the notice).
- Keep Firebase **read-only for 30 days** (do not delete anything), keep the `FIREBASE_SERVICE_ACCOUNT` secret until P9.
- Watch Convex logs for errors for the first day (`npx convex logs --prod` in the background, to a file).

## Rollback
Vercel dashboard → Deployments → redeploy the last good Firebase build of `main` (promote). Convex prod data can stay (re-load later is idempotent).
Do **not** delete Convex prod data on rollback; do not push more to Firestore-incompatible code.

## Known risks
- Kids/guests/shared-login users lose their credential (by design) — support them with kid invite links.
- Push subscriptions don't migrate (web push re-enabled by users; native push is new).
- First sign-in per user requires the same Google account email/provider id as before; email-only users use the email code.
