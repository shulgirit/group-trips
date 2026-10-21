#!/bin/bash
# Publish an over-the-air update (JS/assets/text only — native changes need a store build).
#   bash apps/mobile/scripts/ota.sh testflight "what changed"     # to the TestFlight build
#   bash apps/mobile/scripts/ota.sh production "what changed"     # to the store build
# The runtime version must equal the installed build's fingerprint, which includes the
# build profile's EXPO_PUBLIC_APP_ENV=production — so it is set here (without it the update is silently ignored).
set -e
cd "$(dirname "$0")/.."
CHANNEL="${1:?channel: testflight | production}"
MESSAGE="${2:?message}"
case "$CHANNEL" in
  testflight|production) ENVIRONMENT=production ;;   # both build profiles use the "production" EAS variables (prod Convex)
  *) echo "unknown channel $CHANNEL"; exit 1 ;;
esac
export EXPO_PUBLIC_APP_ENV=production
npx eas-cli update --channel "$CHANNEL" --environment "$ENVIRONMENT" --message "$MESSAGE" --non-interactive
