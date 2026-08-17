// Data fix: merge the corrected villa place onto the official places/villa
// doc (fixed id — map home pin + check-in/out events point at it), delete
// the duplicate, and sync the trip doc's `villa` field.
// Fill DUPLICATE_ID from villa-inspect.mjs output before running.
// Run remotely: gh workflow run admin.yml -f script=villa-merge.mjs
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DUPLICATE_ID = "DT4tYxU5whOcP6t9sYtZ"; // הוילה — Villa Maria con piscina e vista mare

const db = getFirestore(initializeApp({ credential: applicationDefault() }));
const TRIP = "trips/sicily-2026";

if (!DUPLICATE_ID) {
  throw new Error("Set DUPLICATE_ID first (run villa-inspect.mjs to find it)");
}
if (DUPLICATE_ID === "villa") {
  throw new Error("DUPLICATE_ID must be the new doc, not places/villa itself");
}

const dupRef = db.doc(`${TRIP}/places/${DUPLICATE_ID}`);
const villaRef = db.doc(`${TRIP}/places/villa`);

const [dupSnap, villaSnap] = await Promise.all([dupRef.get(), villaRef.get()]);
if (!dupSnap.exists) throw new Error(`Duplicate ${DUPLICATE_ID} not found`);
if (!villaSnap.exists) throw new Error("places/villa not found");

const dup = dupSnap.data();
console.log("== before: places/villa ==");
console.log(JSON.stringify(villaSnap.data(), null, 2));
console.log(`== duplicate: places/${DUPLICATE_ID} ==`);
console.log(JSON.stringify(dup, null, 2));

// Copy every substantive field the new doc has; keep id "villa" + category.
const FIELDS = [
  "name",
  "address",
  "lat",
  "lng",
  "imageUrl",
  "summary",
  "website",
  "bookingUrl",
  "sourceUrl",
  "openingHours",
  "priceNotes",
  "tips",
  "reviewsSummary",
];
const patch = {};
for (const field of FIELDS) {
  const value = dup[field];
  if (value !== undefined && value !== null && value !== "") {
    patch[field] = value;
  }
}
await villaRef.set(patch, { merge: true });
await dupRef.delete();

const merged = (await villaRef.get()).data();
await db.doc(TRIP).set(
  {
    villa: {
      name: merged.name,
      address: merged.address ?? null,
      lat: merged.lat ?? null,
      lng: merged.lng ?? null,
    },
  },
  { merge: true }
);

console.log("== after: places/villa ==");
console.log(JSON.stringify(merged, null, 2));
console.log(`Deleted duplicate places/${DUPLICATE_ID}`);
