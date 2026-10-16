// Read-only sanity check: prints document counts per collection.
// Run remotely: gh workflow run admin.yml -f script=health-check.mjs
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore(initializeApp({ credential: applicationDefault() }));
const TRIP = "trips/sicily-2026";

for (const name of [
  "places",
  "events",
  "families",
  "polls",
  "expenses",
  "users",
  "chatSessions",
  "pushSubscriptions",
  "documents",
]) {
  const snapshot = await db.collection(`${TRIP}/${name}`).count().get();
  console.log(`${name}: ${snapshot.data().count}`);
}
