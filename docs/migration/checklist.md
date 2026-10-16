# Migration checklist

Tracks every product feature through the migration in
[`docs/architecture/migration-plan.md`](../architecture/migration-plan.md).
Update this file in the same PR that moves a feature.

Legend: `—` not started · `wip` in progress · `done` · `n/a`

| # | Feature | Today (Next.js + Firebase) | Convex backend | Web (transition) | Mobile (Expo) | Auth implications | Tested |
|---|---|---|---|---|---|---|---|
| 1 | Landing page (globe, robot, story) | `/welcome`, `components/landing` | n/a | stays | n/a (native onboarding) | sign-in buttons → Better Auth | — |
| 2 | Legal pages | `/privacy`, `/terms`, `src/legal` | n/a | stays | links out | — | — |
| 3 | Google sign-in | Firebase popup / Capacitor plugin | — | — | — | Better Auth social, native idToken | — |
| 4 | Apple sign-in | Firebase (flagged off on web) | — | — | — | required on iOS (4.8) | — |
| 5 | Email code sign-in | none (new) | — | — | — | email OTP via Resend | — |
| 6 | Guest / kid device | anonymous auth + invite | — | — | — | anonymous plugin + onLinkAccount | — |
| 7 | Guest → account upgrade | `linkGuestAccount`, `POST /api/account` | — | — | — | memberships move to linked user | — |
| 8 | Legacy password + kid name login | `trip_session` cookie, `/gate` | n/a (retired) | removed | n/a | re-invite kids | — |
| 9 | Account deletion | `DELETE /api/account`, `purge.ts` | — | — | — | `deleteUser.beforeDelete` | — |
| 10 | Trips hub (My trips) | `/trips`, `useMyTrips` | — | — | — | — | — |
| 11 | Delete trip from hub | `DeleteTripButton` | — | — | — | owner only | — |
| 12 | Creator wizard: destination search | `/api/places/destination` | — | — | — | — | — |
| 13 | Creator: multi-stop route, dates, departure | `StepWhere` | — | — | — | — | — |
| 14 | Creator: families & members | `StepWho` | — | — | — | — | — |
| 15 | Creator: booking import (PDF/image/text) | `/api/import/booking*`, Storage | — | — | — | — | — |
| 16 | Creator: AI guide persona + avatar | `StepAi`, `AvatarPicker`, `trip-assist` | — | — | — | — | — |
| 17 | Launch + invite links / QR | `InviteLinks`, `/api/trips/[id]/invites` | — | — | — | admin only | — |
| 18 | Join via invite | `/j/[code]`, `invites/redeem` | — | — | — | guest or account | — |
| 19 | Trip home (hero, next up, today) | `(app)/page.tsx` | — | — | — | — | — |
| 20 | Countdown (ltr, days leftmost) | trip home | n/a | — | — | — | — |
| 21 | Schedule timeline | `/calendar` | — | — | — | — | — |
| 22 | Event create / edit / delete | `/calendar/new`, `[eventId]` | — | — | — | — | — |
| 23 | Event reminders push | cron + `ReminderPinger` | — | — | — | — | — |
| 24 | Places list, filters, near me | `/places` | — | — | — | — | — |
| 25 | Add place (name / link AI / manual) | `/places/new`, import routes | — | — | — | — | — |
| 26 | Place detail, enrich, navigate | `/places/[id]`, `place-info` | — | — | — | delete gated by role/setting | — |
| 27 | Place photo backfill | `/api/places/photo` | — | — | — | — | — |
| 28 | Map + filters | `/map` (Google Maps JS) | — | — | — | — | — |
| 29 | Live location sharing | `locations`, `shared-location.ts` | — | — | — | own doc only | — |
| 30 | AI chat + tools + photos | `/ai`, `/api/ai/chat` | — | — | — | private per user | — |
| 31 | Polls create / vote / close | `/polls`, `/polls/new` | — | — | — | — | — |
| 32 | Expenses, multi-currency, split | `/expenses`, `/api/rates` | — | — | — | — | — |
| 33 | Settle up + mark as paid | `settlement.ts`, `recordSettlement` | — | — | — | — | — |
| 34 | Documents shared / private | `/documents`, Storage | — | — | — | private = owner only | — |
| 35 | Families view | `/families` | — | — | — | — | — |
| 36 | Settings: trip info, members, roles | `/settings`, `TripAdminSection` | — | — | — | admin only | — |
| 37 | Settings: notifications | `NotificationsSection`, web-push/FCM | — | — | — | — | — |
| 38 | Language (he/en/ar/es) + RTL | `src/i18n` | — | — | — | — | — |
| 39 | Group push (new event/poll) | `push/notify` | — | — | — | — | — |
| 40 | App tour / onboarding | `components/tour`, `AppOnboarding` | n/a | — | — | — | — |
| 41 | Free-tier limits + AI quota | `usage.ts`, trips/redeem limits | — | — | — | — | — |

## Data migration

| Firestore source | Convex target | Transform | Load | Verified |
|---|---|---|---|---|
| Auth users (Google/Apple) | Better Auth user + account, `users` | — | — | — |
| `users/{uid}` | `users` | — | — | — |
| `trips/{id}` | `trips` | — | — | — |
| `members`, `trips/*/users`, `users.tripIds` | `memberships` | — | — | — |
| `families` | `families` | — | — | — |
| `places` / `events` / `expenses` | same | — | — | — |
| `polls` (votes map) | `polls` + `pollVotes` | — | — | — |
| `documents` + Storage files | `documents` + file storage | — | — | — |
| `chatSessions` | `chatSessions` + `chatMessages` | — | — | — |
| `invites` | `invites` | — | — | — |
| `imports`, `usage` | same | — | — | — |
| `locations`, `pushSubscriptions` | not migrated (ephemeral) | n/a | n/a | n/a |
