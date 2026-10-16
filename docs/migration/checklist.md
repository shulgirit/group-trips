# Migration checklist

Tracks every product feature through the migration in
[`docs/architecture/migration-plan.md`](../architecture/migration-plan.md).
Update this file in the same PR that moves a feature.

Legend: `—` not started · `wip` in progress · `done` · `n/a`

| # | Feature | Today (Next.js + Firebase) | Convex backend | Web (transition) | Mobile (Expo) | Auth implications | Tested |
|---|---|---|---|---|---|---|---|
| 1 | Landing page (globe, robot, story) | `/welcome`, `components/landing` | n/a | stays | n/a (native onboarding) | sign-in buttons → Better Auth | — |
| 2 | Legal pages | `/privacy`, `/terms`, `src/legal` | n/a | stays | links out | — | — |
| 3 | Google sign-in | Firebase popup / Capacitor plugin | done | — | — | Better Auth social, native idToken | backend |
| 4 | Apple sign-in | Firebase (flagged off on web) | done | — | — | required on iOS (4.8) | backend |
| 5 | Email code sign-in | none (new) | done | — | — | email OTP via Resend | backend |
| 6 | Guest / kid device | anonymous auth + invite | done | — | — | anonymous plugin + onLinkAccount | backend |
| 7 | Guest → account upgrade | `linkGuestAccount`, `POST /api/account` | done | — | — | memberships move to linked user | backend |
| 8 | Legacy password + kid name login | `trip_session` cookie, `/gate` | n/a (retired) | removed | n/a | re-invite kids | — |
| 9 | Account deletion | `DELETE /api/account`, `purge.ts` | done | — | — | `deleteUser.beforeDelete` | backend |
| 10 | Trips hub (My trips) | `/trips`, `useMyTrips` | done | — | — | — | backend |
| 11 | Delete trip from hub | `DeleteTripButton` | done | — | — | owner only | backend |
| 12 | Creator wizard: destination search | `/api/places/destination` | done | — | — | — | backend |
| 13 | Creator: multi-stop route, dates, departure | `StepWhere` | done | — | — | — | backend |
| 14 | Creator: families & members | `StepWho` | done | — | — | — | backend |
| 15 | Creator: booking import (PDF/image/text) | `/api/import/booking*`, Storage | done | — | — | — | backend |
| 16 | Creator: AI guide persona + avatar | `StepAi`, `AvatarPicker`, `trip-assist` | done | — | — | — | backend |
| 17 | Launch + invite links / QR | `InviteLinks`, `/api/trips/[id]/invites` | done | — | — | admin only | backend |
| 18 | Join via invite | `/j/[code]`, `invites/redeem` | done | — | — | guest or account | backend |
| 19 | Trip home (hero, next up, today) | `(app)/page.tsx` | done | — | — | — | backend |
| 20 | Countdown (ltr, days leftmost) | trip home | n/a | — | — | — | — |
| 21 | Schedule timeline | `/calendar` | done | — | — | — | backend |
| 22 | Event create / edit / delete | `/calendar/new`, `[eventId]` | done | — | — | — | backend |
| 23 | Event reminders push | cron + `ReminderPinger` | done | — | — | — | backend |
| 24 | Places list, filters, near me | `/places` | done | — | — | — | backend |
| 25 | Add place (name / link AI / manual) | `/places/new`, import routes | done | — | — | — | backend |
| 26 | Place detail, enrich, navigate | `/places/[id]`, `place-info` | done | — | — | delete gated by role/setting | backend |
| 27 | Place photo backfill | `/api/places/photo` | done | — | — | — | backend |
| 28 | Map + filters | `/map` (Google Maps JS) | — | — | — | — | — |
| 29 | Live location sharing | `locations`, `shared-location.ts` | done | — | — | own doc only | backend |
| 30 | AI chat + tools + photos | `/ai`, `/api/ai/chat` | done | — | — | private per user | backend |
| 31 | Polls create / vote / close | `/polls`, `/polls/new` | done | — | — | — | backend |
| 32 | Expenses, multi-currency, split | `/expenses`, `/api/rates` | done | — | — | — | backend |
| 33 | Settle up + mark as paid | `settlement.ts`, `recordSettlement` | done | — | — | — | backend |
| 34 | Documents shared / private | `/documents`, Storage | done | — | — | private = owner only | backend |
| 35 | Families view | `/families` | done | — | — | — | backend |
| 36 | Settings: trip info, members, roles | `/settings`, `TripAdminSection` | done | — | — | admin only | backend |
| 37 | Settings: notifications | `NotificationsSection`, web-push/FCM | done | — | — | — | backend |
| 38 | Language (he/en/ar/es) + RTL | `src/i18n` | — | — | — | — | — |
| 39 | Group push (new event/poll) | `push/notify` | done | — | — | — | backend |
| 40 | App tour / onboarding | `components/tour`, `AppOnboarding` | n/a | — | — | — | — |
| 41 | Free-tier limits + AI quota | `usage.ts`, trips/redeem limits | done | — | — | — | backend |

## Data migration

| Firestore source | Convex target | Transform | Load | Verified |
|---|---|---|---|---|
| Auth users (Google/Apple) | Better Auth user + account, `users` | done | done | rehearsed (emulator) |
| `users/{uid}` | `users` | done | done | rehearsed (emulator) |
| `trips/{id}` | `trips` | done | done | rehearsed (emulator) |
| `members`, `trips/*/users`, `users.tripIds` | `memberships` | done | done | rehearsed (emulator) |
| `families` | `families` | done | done | rehearsed (emulator) |
| `places` / `events` / `expenses` | same | done | done | rehearsed (emulator) |
| `polls` (votes map) | `polls` + `pollVotes` | done | done | rehearsed (emulator) |
| `documents` + Storage files | `documents` + file storage | done | done | rehearsed (emulator) |
| `chatSessions` | `chatSessions` + `chatMessages` | done | done | rehearsed (emulator) |
| `invites` | `invites` | done | done | rehearsed (emulator) |
| `imports`, `usage` | same | done | done | rehearsed (emulator) |
| `locations`, `pushSubscriptions` | not migrated (ephemeral) | n/a | n/a | n/a |
