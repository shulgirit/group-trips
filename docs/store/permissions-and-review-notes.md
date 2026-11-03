# Permissions, data collection and what to tell App Review / Google Play

Build that adds: live location sharing (opt-in), PostHog analytics, Sentry crash reports, profile photo.
Everything below matches `apps/mobile/app.json`. If you change one, change the other.

## 1. What the app asks the device for (and why)

| Permission | Platform | Exact text shown to the person | Used for | Not used for |
|---|---|---|---|---|
| Location, **when in use** | iOS `NSLocationWhenInUseUsageDescription`; Android `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` | "Together uses your precise location only while the app is open: to show you on the trip map, to sort the trip's places by distance, and — only if you choose to share — to show your position to the members of your trip for the time you pick (1 hour, 4 hours or until the end of the day). You can stop at any moment." | The blue dot on the trip map; "Near me" sort (computed on the phone, nothing stored); optional live sharing with the trip's members | Background tracking, advertising, any use outside a trip |
| Photo library | iOS `NSPhotoLibraryUsageDescription`; Android reads through the system photo picker (no storage permission) | "Together uses a photo you choose from your library as your profile picture, the trip cover, a document or ticket for the trip, or a picture you send to the trip guide." | Profile photo, trip cover photo, uploading tickets/documents, attaching a photo for the AI guide | Reading the library in the background or without the person picking a photo |
| Notifications | iOS push entitlement; Android `POST_NOTIFICATIONS` | System prompt | Trip reminders (event starts), poll and member updates | Marketing |

Deliberately **not** requested: background location ("Always"), camera, microphone (`RECORD_AUDIO` is blocked
in the Android manifest), contacts, Bluetooth, tracking (no `NSUserTrackingUsageDescription`, no IDFA, no
App Tracking Transparency prompt, because nothing is used for tracking).
Sign in with Apple capability is declared because Google sign-in is offered (guideline 4.8).

## 2. Live location sharing — how it works (for review notes)

- **Opt-in, per person, every time.** Nothing is shared by default. The person taps "Share location with the
  group", reads the explanation, and picks a duration: 1 hour, 4 hours or until the end of the day. There is
  no "always on" option.
- **Foreground only.** Position is sent only while the app is open and sharing is on (at most every 30 seconds).
  There is no background location mode in the app (`UIBackgroundModes` has no `location`).
- **Visible and stoppable.** While sharing, a green bar on the map says "Sharing until 18:30 · Stop sharing".
  One tap stops it and deletes the stored position at once.
- **Private to the trip.** Only the members of that one trip can see it. A person who is not a member, or who
  left the trip, cannot.
- **Self-deleting.** The position is removed when the chosen time ends (a cleanup job runs every 15 minutes
  and expired positions are never shown), when the person stops, when they leave the trip, or when the trip
  or the account is deleted.
- **Not used for anything else.** Not for analytics (the analytics SDK never receives coordinates), not for ads,
  not shared with third parties.

## 3. Text to paste into App Review → Notes

> Location: Together asks for location "when in use" only, and only after the person taps a location feature
> ("Near me" on the Places tab, the map's my-location button, or "Share location with the group" on the Places
> map). Live sharing is optional, time-boxed (1 h / 4 h / end of day), foreground only, visible while active, and
> can be stopped at any time; positions are visible only to members of the same private trip and are deleted
> when sharing ends. There is no background location. To test with the demo account: open the trip → Places →
> Map → "Share location with the group" → choose 1 hour → the bar "Sharing until …" appears → tap it to stop.
>
> Analytics and crash reports: the app uses PostHog (product analytics, US cloud) and Sentry (crash reports).
> They receive a random account id, screen names, action names (for example "plan_started") and error reasons.
> They never receive names, emails, trip content, messages, photos or location. No session recording.
> No data is used for tracking across other companies' apps or sites, and no data is sold.

## 4. App Store Connect → App Privacy answers

Data types collected, **linked to the user**, **not used for tracking**:

| Data type | Purpose | Notes |
|---|---|---|
| Contact info: email address, name | App functionality | Account sign-in, shown to the trip's members |
| Photos or videos (profile photo, trip cover, documents) | App functionality | Only what the person uploads |
| User content: other user content (trip plans, messages to the AI guide, places) | App functionality | |
| **Precise location** | App functionality | Only when the person opts into live sharing; deleted when sharing ends. "Near me" is computed on the device and not collected |
| Identifiers: user ID | App functionality, Analytics | Random account id |
| Usage data: product interaction | Analytics, App functionality | PostHog events |
| Diagnostics: crash data, performance data | App functionality | Sentry |
| Purchases / financial info / health / contacts / browsing / search history | — not collected | |

Tracking: **No** ("Data Used to Track You": none).

## 5. Google Play → Data safety

Same list as above. Location: **Collected** (approximate and precise), purpose App functionality, **shared**: No
(only with other members of the same trip, which is the app's core function and is not "sharing" with third
parties); optional; **Data is encrypted in transit: Yes**; **Users can request data deletion: Yes**
(in-app account deletion and email support). Crash logs and diagnostics: collected, purpose App functionality
and analytics. Declare the PostHog and Sentry SDKs as processors. No background location permission, so no
background-location declaration video is needed.

## 6. Privacy policy

`apps/web/src/legal/privacy.en.ts` / `privacy.he.ts` already describe optional live location (time-boxed,
members only, deleted at the end) and now PostHog. Add Sentry (crash reports, no personal content) to the
processors list when the Sentry project exists. The policy still names Firebase as database/auth provider;
update to Convex and Better Auth.

## 7. Reviewer-friendly checklist before submitting

- Purpose strings match what the screen does at the moment of the prompt (they do: the prompt appears right
  after the person taps a location feature).
- Location is requested after a tap, never at launch.
- Demo account can reach the share sheet without special setup.
- Screen recording shows: tap share → system prompt → choose 1 hour → green bar → stop.
