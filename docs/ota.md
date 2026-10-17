# Over-the-air updates (EAS Update)

Small fixes (text, design, bug fixes in JavaScript) reach installed apps **without a store release**.
Project: `@shulgirit/together-group-plans` (never `dr-fischer*`). Config: `apps/mobile/app.json`
(`updates.url`, `runtimeVersion: { policy: "fingerprint" }`), channels in `apps/mobile/eas.json`
(development / preview / production = the build profile names).

## Publish
```bash
cd apps/mobile
npx eas-cli update --channel preview    --message "fix: schedule title"            # test on a preview build first
npx eas-cli update --channel production --message "fix: schedule title" --rollout-percentage 20   # staged
npx eas-cli update:rollout --channel production                                     # raise/finish the rollout
npx eas-cli update:rollback --channel production                                    # undo (re-publish the previous update)
```
The app downloads an update in the background and applies it on the **next cold start** (a second launch).

## What can go over the air — and what can't
| OTA is fine | Needs a new store build |
|---|---|
| JS/TypeScript, screens, styles, copy, i18n strings, images in the bundle | adding/upgrading a native module or Expo SDK |
| bug fixes, layout changes | new permissions, app icon/splash, `app.json` native fields, bundle id |

`runtimeVersion` uses the **fingerprint** policy: it is a hash of the native code. An update is only delivered to binaries
with the *same* fingerprint, so a JS change that depends on a new native module can never reach an old binary — it just
won't be offered until users update from the store. If `eas update` says the fingerprint changed, you need a build.

## Content that changes often → not OTA at all
Announcements, banners, feature flags, suggested prompts, default quotas will live in a Convex `appConfig` table edited
from the admin panel (see `NEXT.md`), so they change instantly with no update.

## Store rules
Apple (3.3.2) and Google allow downloading JS/assets that don't change the app's primary purpose. Don't use OTA to
ship a different product or bypass review of a feature.
