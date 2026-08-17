// Read-only: prints the official villa records and every candidate place,
// so the duplicate's doc id + corrected coordinates can be identified.
// Run remotely: gh workflow run admin.yml -f script=villa-inspect.mjs
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore(initializeApp({ credential: applicationDefault() }));
const TRIP = "trips/sicily-2026";

const villa = await db.doc(`${TRIP}/places/villa`).get();
console.log("== places/villa ==");
console.log(JSON.stringify(villa.data() ?? null, null, 2));

const trip = await db.doc(TRIP).get();
console.log("== trip doc `villa` field ==");
console.log(JSON.stringify(trip.data()?.villa ?? null, null, 2));

const places = await db.collection(`${TRIP}/places`).get();
console.log(`== all places (${places.size}) ==`);
for (const docSnap of places.docs) {
  const d = docSnap.data();
  console.log(`- [${docSnap.id}] (${d.category}) ${d.name}`);
}

console.log("== accommodation details ==");
for (const docSnap of places.docs) {
  const d = docSnap.data();
  if (d.category !== "accommodation") continue;
  console.log(
    JSON.stringify(
      {
        id: docSnap.id,
        name: d.name,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        imageUrl: d.imageUrl,
        website: d.website,
        sourceUrl: d.sourceUrl,
        createdByName: d.createdByName,
        createdAt: d.createdAt,
      },
      null,
      2
    )
  );
}
