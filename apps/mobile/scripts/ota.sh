#!/bin/bash
# Publish an over-the-air update (JS/assets/text only — native changes need a store build).
#   bash apps/mobile/scripts/ota.sh testflight "what changed"     # to the TestFlight build
#   bash apps/mobile/scripts/ota.sh production "what changed"     # to the store build
# The runtime version must equal the installed build's fingerprint, which includes the
# build profile's EXPO_PUBLIC_APP_ENV=production — so it is set here (without it the update is silently ignored).
# With SENTRY_AUTH_TOKEN exported, the JS source maps are also uploaded to Sentry.
set -e
cd "$(dirname "$0")/.."
CHANNEL="${1:?channel: testflight | production}"
MESSAGE="${2:?message}"
case "$CHANNEL" in
  testflight|production) ENVIRONMENT=production ;;   # both build profiles use the "production" EAS variables (prod Convex)
  *) echo "unknown channel $CHANNEL"; exit 1 ;;
esac
export EXPO_PUBLIC_APP_ENV=production

if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then
  # Export once with source maps, publish exactly that bundle, then give Sentry the maps (readable crash reports for updates).
  # EXPO_PUBLIC_* come from the EAS "production" environment, same as `eas update --environment production`.
  rm -rf dist
  npx eas-cli env:exec "$ENVIRONMENT" "npx expo export --platform ios --platform android --dump-sourcemap --output-dir dist" --non-interactive
  npx eas-cli update --skip-bundler --input-dir dist --channel "$CHANNEL" --environment "$ENVIRONMENT" --message "$MESSAGE" --non-interactive
  SENTRY_ORG=tal-pituach SENTRY_PROJECT=react-native SENTRY_URL=https://de.sentry.io/ npx sentry-expo-upload-sourcemaps dist || echo "WARNING: the update is published, but uploading source maps to Sentry failed"
  rm -rf dist
else
  echo "NOTE: SENTRY_AUTH_TOKEN is not set in this shell, so Sentry will not get source maps for this update."
  echo "      export SENTRY_AUTH_TOKEN=<your Sentry token> and run again to include them."
  npx eas-cli update --channel "$CHANNEL" --environment "$ENVIRONMENT" --message "$MESSAGE" --non-interactive
fi
