#!/bin/bash
# Build the iOS app for TestFlight and submit it. Interactive the first time (Apple login + 2FA).
cd "$(dirname "$0")/.." || exit 1
npx eas-cli build --platform ios --profile testflight --auto-submit-with-profile=production
