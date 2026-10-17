# Migration checklist

Tracks every product feature through the migration in
[`docs/architecture/migration-plan.md`](../architecture/migration-plan.md).
Update this file in the same PR that moves a feature.

Notes: mobile `wip` = built, needs a real device or provider credentials (Google/Apple client ids, push on a device) or isn't ported (live location sharing, notification settings).

Legend: `—` not started · `wip` in progress · `done` · `n/a`

| # | Feature | Today (Next.js + Firebase) | Convex backend | Web (transition) | Mobile (Expo) | Auth implications | Tested |
|---|---|---|---|---|---|---|---|
| 1 | Landing page (globe, robot, story) | `/welcome`, `components/landing` | n/a | stays | n/a (native onboarding) | sign-in buttons → Better Auth | — |
| 2 | Legal pages | `/privacy`, `/terms`, `src/legal` | n/a | stays | links out | — | — |
| 3 | Google sign-in | Firebase popup / Capacitor plugin | done | done | wip | Better Auth social, native idToken | backend |
| 4 | Apple sign-in | Firebase (flagged off on web) | done | done | wip | required on iOS (4.8) | backend |
| 5 | Email code sign-in | none (new) | done | done | done | email OTP via Resend | backend, web, simulator |
| 6 | Guest / kid device | anonymous auth + invite | done | done | done | anonymous plugin + onLinkAccount | backend, web, simulator |
| 7 | Guest → account upgrade | `linkGuestAccount`, `POST /api/account` | done | done | done | memberships move to linked user | backend, web, simulator |
| 8 | Legacy password + kid name login | `trip_session` cookie, `/gate` | n/a (retired) | removed | n/a | re-invite kids | — |
| 9 | Account deletion | `DELETE /api/account`, `purge.ts` | done | done | done | `deleteUser.beforeDelete` | backend, web, simulator |
| 10 | Trips hub (My trips) | `/trips`, `useMyTrips` | done | done | done | — | backend, web, simulator |
| 11 | Delete trip from hub | `DeleteTripButton` | done | done | done | owner only | backend, web, simulator |
| 12 | Creator wizard: destination search | `/api/places/destination` | done | done | done | — | backend, web, simulator |
| 13 | Creator: multi-stop route, dates, departure | `StepWhere` | done | done | done | — | backend, web, simulator |
| 14 | Creator: families & members | `StepWho` | done | done | done | — | backend, web, simulator |
| 15 | Creator: booking import (PDF/image/text) | `/api/import/booking*`, Storage | done | done | done | — | backend, web, simulator |
| 16 | Creator: AI guide persona + avatar | `StepAi`, `AvatarPicker`, `trip-assist` | done | done | done | — | backend, web, simulator |
| 17 | Launch + invite links / QR | `InviteLinks`, `/api/trips/[id]/invites` | done | done | done | admin only | backend, web, simulator |
| 18 | Join via invite | `/j/[code]`, `invites/redeem` | done | done | done | guest or account | backend, web, simulator |
| 19 | Trip home (hero, next up, today) | `(app)/page.tsx` | done | done | done | — | backend, web, simulator |
| 20 | Countdown (ltr, days leftmost) | trip home | n/a | — | done | — | — |
| 21 | Schedule timeline | `/calendar` | done | done | done | — | backend, web, simulator |
| 22 | Event create / edit / delete | `/calendar/new`, `[eventId]` | done | done | done | — | backend, web, simulator |
| 23 | Event reminders push | cron + `ReminderPinger` | done | done | wip | — | backend |
| 24 | Places list, filters, near me | `/places` | done | done | done | — | backend, web, simulator |
| 25 | Add place (name / link AI / manual) | `/places/new`, import routes | done | done | done | — | backend, web, simulator |
| 26 | Place detail, enrich, navigate | `/places/[id]`, `place-info` | done | done | done | delete gated by role/setting | backend, web, simulator |
| 27 | Place photo backfill | `/api/places/photo` | done | done | done | — | backend, web, simulator |
| 28 | Map + filters | done | — | done | done | — | simulator |
| 29 | Live location sharing | `locations`, `shared-location.ts` | done | done | wip | own doc only | backend |
| 30 | AI chat + tools + photos | `/ai`, `/api/ai/chat` | done | done | done | private per user | backend, web, simulator |
| 31 | Polls create / vote / close | `/polls`, `/polls/new` | done | done | done | — | backend, web, simulator |
| 32 | Expenses, multi-currency, split | `/expenses`, `/api/rates` | done | done | done | — | backend, web, simulator |
| 33 | Settle up + mark as paid | `settlement.ts`, `recordSettlement` | done | done | done | — | backend, web, simulator |
| 34 | Documents shared / private | `/documents`, Storage | done | done | done | private = owner only | backend, web, simulator |
| 35 | Families view | `/families` | done | done | done | — | backend, web, simulator |
| 36 | Settings: trip info, members, roles | `/settings`, `TripAdminSection` | done | done | done | admin only | backend, web, simulator |
| 37 | Settings: notifications | `NotificationsSection`, web-push/FCM | done | done | wip | — | backend |
| 38 | Language (he/en/ar/es) + RTL | n/a | — | done | done | — | unit, simulator |
| 39 | Group push (new event/poll) | `push/notify` | done | done | wip | — | backend |
| 40 | App tour / onboarding | `components/tour`, `AppOnboarding` | n/a | — | — | — | — |
| 41 | Free-tier limits + AI quota | `usage.ts`, trips/redeem limits | done | done | done | — | backend, web, simulator |

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
