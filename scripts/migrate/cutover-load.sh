#!/bin/bash
# Load the real Firebase data into the PRODUCTION Convex deployment (idempotent; safe to re-run).
# Run it in a normal Terminal window:  bash scripts/migrate/cutover-load.sh
# It asks for the prod deploy key (hidden input — Convex dashboard → prod deployment → Settings → URL & Deploy Key),
# exports a fresh snapshot (read-only on Firebase), shows a dry run, and loads only after you type y.
set -e
cd "$(dirname "$0")/../.."
CONVEX_URL="https://tidy-dodo-188.eu-west-1.convex.cloud"
OWNER_EMAIL="${OWNER_EMAIL:-omertalmail@gmail.com}"
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/group-trips-2f753-firebase-adminsdk-fbsvc.json"
[ -f "$GOOGLE_APPLICATION_CREDENTIALS" ] || { echo "Firebase service-account file not found at $GOOGLE_APPLICATION_CREDENTIALS"; exit 1; }
if [ -z "$CONVEX_DEPLOY_KEY" ]; then
  printf "Paste the PROD deploy key (input hidden), then Enter: "
  read -rs CONVEX_DEPLOY_KEY; echo
fi
case "$CONVEX_DEPLOY_KEY" in prod:*) ;; *) echo "That does not look like a prod deploy key (should start with prod:)"; exit 1 ;; esac
export CONVEX_DEPLOY_KEY CONVEX_URL

echo "1/4 Export from Firebase (read-only)…"
pnpm --filter @together/migrate export | tail -3
SNAPDIR=$(ls -d scripts/migrate/.migrate/*/ | tail -1)
SNAP="${SNAPDIR#scripts/migrate/}snapshot.json"   # path as the migrate package sees it
echo "snapshot: scripts/migrate/$SNAP (kept on this laptop, never committed)"

echo "2/4 Dry run…"
pnpm --filter @together/migrate load -- --snapshot "$SNAP" --legacy-owner-email "$OWNER_EMAIL" --dry-run | tail -4
printf "Load this into PRODUCTION (%s)? [y/N] " "$CONVEX_URL"; read -r answer
[ "$answer" = "y" ] || { echo "Stopped. Nothing was loaded."; exit 0; }

echo "3/4 Load…"
pnpm --filter @together/migrate load -- --snapshot "$SNAP" --legacy-owner-email "$OWNER_EMAIL" | tail -14
echo "4/4 Verify…"
pnpm --filter @together/migrate verify -- --snapshot "$SNAP" --legacy-owner-email "$OWNER_EMAIL" | tail -6
echo "Done. Tell the agent: 'prod load finished' and paste the last lines if anything says mismatch."
