# Reply to App Review — Guideline 2.1 "Information Needed" (build 6)

Paste the **Reply** below in Resolution Center, and the **Notes** block into App Review Information → Notes.
Attach the screen recording described at the bottom (physical iPhone, starts from launching the app).

## Reply (Resolution Center)

Hello App Review team,

Thank you for the review. Together is my first submission on this developer account (an individual
account), so here is everything you asked for. I replaced build 5 with build 6, which also contains the
latest design and the items below.

1. **Screen recording** (attached, physical iPhone, latest iOS): launch → onboarding → sign in with the
   demo account → open the trip → AI Concierge → adding a place → schedule → expenses → reporting content
   and removing a member → account deletion flow (shown on a throw-away account).
2. **Purpose.** Together is a planner for people who travel in a group (families, friends). One shared
   place for the schedule, saved places and map, polls, bookings/documents, an expense ledger with
   settle-up, and an AI travel guide that answers questions about the trip. It solves the usual chaos of
   planning in chat threads.
3. **How to use it.** Sign in with the demo account below (email `review@togethergroup.app`, code
   `610019` — this account uses a fixed code because reviewers cannot read email; real users receive a
   random 6-digit code). Open the trip "London Getaway" (it starts next month). Tabs: Now, Concierge (AI),
   Schedule, Places, More (polls, expenses, bookings & documents, members, settings).
4. **External services:** Convex (database, file storage, backend functions, EU region); Better Auth
   (sign-in: Google, Sign in with Apple, email code; runs inside our Convex backend); Resend (sign-in
   emails); OpenAI (AI guide text and image understanding); Google Maps Platform / Places (place search,
   ratings, photos); Firecrawl (reads a web page when a user imports a place from a link); Expo (push
   notification delivery and over-the-air JavaScript updates).
5. **Regional differences:** none. The app works the same in every region; the interface is available in
   English, Hebrew, Arabic and Spanish and the user chooses the language in My account.
6. **Regulated industry / third-party material:** none. No paid content or in-app purchases; the app is
   free. Place names, ratings and photos come from the Google Places API under its terms of service.

**User-generated content.** Content is shared only inside private groups that people are invited to
(no public feed, no discovery, no direct messages between strangers). Because members can add places,
events, poll options and notes visible to the group, the app has: in-app "Report" on AI replies,
shared places and members (sent to support@togethergroup.app and stored for review within 24 hours);
organizers can remove a member at any time and any member can leave the trip; AI guide conversations
are private to the person who wrote them. **Account deletion** is in More → Settings → My account →
Delete account, and at https://togethergroup.app/account/delete.

Privacy Policy: https://togethergroup.app/privacy · Terms: https://togethergroup.app/terms ·
Support: https://togethergroup.app/support

Thank you,
Omer Tal

## Notes (App Review Information → Notes)

```
Together is a group trip planner (schedule, places/map, polls, documents, expenses with settle-up, AI travel guide).

SIGN IN: use the demo account above. This app uses passwordless sign-in (Google, Apple, or an email code). The demo account has a fixed code (the "password" field) because reviewers cannot read email. Then open the trip "London Getaway".

MAIN FEATURES: Now (next activity, today's route) · Concierge (AI guide; try "Plan a rainy afternoon near the British Museum") · Schedule · Places and map · More: Polls, Expenses (add an expense, combined settle-up), Bookings & documents (upload a photo or PDF), Members, Settings.

USER CONTENT: private invite-only groups, no public feed. Report: long-press/ "Report" on AI replies, places and members. Organizers can remove members; anyone can leave a trip. Account deletion: More > Settings > My account > Delete account (also https://togethergroup.app/account/delete).

EXTERNAL SERVICES: Convex (backend, database, storage), Better Auth (sign-in), Resend (sign-in email), OpenAI (AI guide), Google Maps Platform/Places (place data and photos), Firecrawl (page import), Expo (push + updates).

NO paid content, no in-app purchases, no regional differences, not a regulated industry.
```

## Screen recording script (physical iPhone, ~3 minutes)
Settings → Control Center → add Screen Recording. Start recording, then:
1. Force-quit Together, open it (show first screen), swipe through the three onboarding pages.
2. Sign in: Continue with email → `review@togethergroup.app` → code `610019`.
3. Trips list → London Getaway → Now tab.
4. Concierge: ask a question, show the answer; open an answer and use Report.
5. Places → add a place by name; Schedule → open a day; Expenses → show combined settle-up; More → Bookings & documents → upload a photo.
6. More → Members → show Remove and Report; Settings → My account → Delete account page (stop before confirming), then back.
7. (Optional, on a throw-away account) sign in with Apple, complete Delete account, show it returns to the welcome screen.
Stop recording, AirDrop the video to the Mac, attach it in the reply.
