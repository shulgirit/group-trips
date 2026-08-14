/**
 * Backfills real Google Maps photos for places without an image.
 * Idempotent — only touches places whose imageUrl is empty.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> GOOGLE_MAPS_SERVER_API_KEY=<key> \
 *     node scripts/fetch-place-images.mjs
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY;
if (!KEY) throw new Error("GOOGLE_MAPS_SERVER_API_KEY missing");

const db = getFirestore(initializeApp({ credential: applicationDefault() }));

async function findPhoto(query) {
  const search = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "places.photos,places.displayName",
    },
    body: JSON.stringify({ textQuery: `${query} Sicily` }),
  });
  if (!search.ok) return null;
  const data = await search.json();
  const photoName = data.places?.[0]?.photos?.[0]?.name;
  if (!photoName) return null;
  const media = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${KEY}`
  );
  if (!media.ok) return null;
  const { photoUri } = await media.json();
  return typeof photoUri === "string" && photoUri.startsWith("https://")
    ? photoUri
    : null;
}

const snap = await db.collection("trips/sicily-2026/places").get();
for (const doc of snap.docs) {
  const place = doc.data();
  if (place.imageUrl) {
    console.log(`· ${place.name} — already has an image`);
    continue;
  }
  const query = [place.name, place.area].filter(Boolean).join(" ");
  const photoUrl = await findPhoto(query);
  if (!photoUrl) {
    console.log(`✗ ${place.name} — no photo found, keeping fallback`);
    continue;
  }
  await doc.ref.update({ imageUrl: photoUrl });
  console.log(`✓ ${place.name} — real photo attached`);
}
console.log("Done.");
