# Store apps (iOS + Android) — Capacitor

The store apps are a native shell around the **live web app**
(`capacitor.config.ts` → `server.url`). Every web deploy reaches the apps
instantly; only native changes (plugins, icons, permissions) need a new
store build. Native features are reached from web code through
`window.Capacitor` (`src/lib/native.ts`) — the web bundle never imports
native packages.

| Feature | Native plugin | Web fallback |
| --- | --- | --- |
| GPS ("me" dot, near-me, live sharing) | `@capacitor/geolocation` | `navigator.geolocation` |
| Google / Apple sign-in | `@capacitor-firebase/authentication` (skipNativeAuth → `signInWithCredential`) | popup → redirect |
| Push | `@capacitor-firebase/messaging` (FCM/APNs, `kind: "fcm"` subscriptions) | web-push (VAPID) |
| Invite links open the app | `@capacitor/app` `appUrlOpen` + universal/app links | — |

## Coming from Expo? The equivalents

| Expo | Here (Capacitor) |
| --- | --- |
| Expo Go / dev client | open the live site, or the store build (it loads production) |
| EAS Build | **Codemagic** (`codemagic.yaml`) — cloud Mac + Linux builders |
| EAS Submit | Codemagic publishing → TestFlight / Play internal track |
| EAS Update (OTA) | automatic — every `git push main` reaches the apps instantly |
| `app.json` | `capacitor.config.ts` + `ios/` + `android/` |
| expo-location | `@capacitor/geolocation` |
| expo-notifications | `@capacitor-firebase/messaging` |
| expo-auth-session | `@capacitor-firebase/authentication` |

A new store build is only needed when native things change (plugins,
permissions, icon, app name). Web/feature changes never need one.

## One-time setup (Omer)

1. **Accounts**: Apple Developer Program ($99/yr), Google Play Console ($25).
2. **Pick final identity**: app name + bundle id. Replace `app.together.trips`
   in `capacitor.config.ts`, `public/.well-known/*`, Xcode and
   `android/app/build.gradle` (`applicationId`).
3. **Firebase console** (project `group-trips-2f753`):
   - Add an iOS app and an Android app with that bundle id → download
     `GoogleService-Info.plist` → `ios/App/App/`, `google-services.json` →
     `android/app/`.
   - Authentication → enable **Apple** provider (Services ID + key from the
     Apple developer portal). Then set `NEXT_PUBLIC_APPLE_SIGN_IN=1` in
     Vercel so the web shows the Apple button too.
   - Cloud Messaging → upload the **APNs auth key** (.p8).
   - Add the Android **SHA-1/SHA-256** (debug + Play App Signing) for Google sign-in.
4. **Universal / app links**: fill `TEAMID` in
   `public/.well-known/apple-app-site-association`, the Play signing SHA-256
   in `assetlinks.json`; in Xcode add the *Associated Domains* capability
   `applinks:<domain>`. A custom domain is strongly recommended before launch
   (and update `server.url`, `allowNavigation`, the Android intent-filter host).
5. **Xcode capabilities**: Push Notifications, Background Modes → Remote
   notifications, Sign in with Apple, Associated Domains.

## Cloud builds (no Mac needed) — Codemagic

1. Sign up at codemagic.io with GitHub and add the `group-trips` repo
   (free tier: 500 build-minutes/month — plenty).
2. **App Store Connect → Users and Access → Integrations → App Store Connect
   API** → generate a key (role *App Manager*). In Codemagic: Team settings →
   Integrations → App Store Connect → add it, name it **`ASC`**.
3. In App Store Connect create the app record (bundle id
   `app.together.trips`, primary language Hebrew).
4. Codemagic → Code signing identities:
   - iOS: "Fetch certificate/profile" (Codemagic creates them via the API key).
   - Android: generate an upload keystore (Codemagic can create one) with
     reference name **`together_upload`**. Keep a backup of it.
5. Google Play Console: create the app; Setup → API access → create a
   service account with *Release manager* rights; download its JSON.
6. Codemagic → Environment variables:
   - group `firebase`: `GOOGLE_SERVICE_INFO_PLIST` and `GOOGLE_SERVICES_JSON`
     = `base64` of the two Firebase config files.
   - group `google_play`: `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` = the JSON.
7. Build: push a tag `git tag app-v1.0.0 && git push origin app-v1.0.0`
   (or press "Start new build"). iOS lands in **TestFlight**, Android in
   the Play **internal testing** track. Install on your phones, test.
8. When happy: in App Store Connect / Play Console fill the listing
   (Hebrew texts, screenshots, privacy answers), attach the build and
   submit for review. Apple review is usually 1–3 days; Google 1–7 for a
   new developer account (Google also requires 12 testers × 14 days of
   closed testing for brand-new *personal* developer accounts — an
   organization account skips that).

## Build locally (optional, needs a Mac for iOS)

```bash
npm ci
npx cap sync            # after any plugin/config change
npx cap open ios        # Xcode → Product → Archive → TestFlight
npx cap open android    # Android Studio → Build → Generate signed bundle
```

Icons/splash: put a 1024×1024 icon + 2732×2732 splash in `resources/` and run
`npx @capacitor/assets generate`.

## Store review checklist

- Sign in with Apple is offered on iOS (done in code when the native plugin is present).
- **Account deletion in-app**: `/account` → "מחיקת החשבון" (done).
- Privacy policy `/privacy` + terms `/terms` — drafts, have them reviewed.
- Location / camera / photos purpose strings: `ios/App/App/Info.plist` (Hebrew, done).
- Demo account for the reviewer: create a Google test account, a demo trip,
  and put the credentials in App Store Connect review notes.
- Guideline 4.2 (minimum functionality): native GPS, push, native sign-in,
  deep links — keep these working in the review build.
