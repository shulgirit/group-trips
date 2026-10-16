/**
 * Seeds the trip document and the four families.
 * Idempotent — safe to run again (merges, never deletes).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> node scripts/seed.mjs
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TRIP_ID = "sicily-2026";

const app = initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

const trip = {
  name: "סיציליה 2026",
  startDate: "2026-08-15",
  endDate: "2026-08-24",
  currency: "EUR",
  villa: { name: "הוילה שלנו", address: "", lat: null, lng: null },
};

const families = [
  {
    id: "tal",
    name: "משפחת טל",
    color: "sea",
    order: 0,
    members: ["עומר", "דניאל", "מיקה", "אורי", "ליבי"],
  },
  {
    id: "ben-hamo",
    name: "משפחת בן חמו",
    color: "terra",
    order: 1,
    members: ["איציק", "דקלה", "גילי", "אסף", "יעל"],
  },
  {
    id: "ben-ari",
    name: "משפחת בן ארי",
    color: "lemon",
    order: 2,
    members: ["אביבה", "עודד", "נועם", "עמית", "דור"],
  },
  {
    id: "gadot",
    name: "משפחת גדות",
    color: "olive",
    order: 3,
    members: ["רונן", "נורית", "מיכאלה"],
  },
];

const tripRef = db.collection("trips").doc(TRIP_ID);
await tripRef.set(trip, { merge: true });
console.log(`✓ trips/${TRIP_ID}`);

for (const family of families) {
  const { id, members, ...rest } = family;
  await tripRef
    .collection("families")
    .doc(id)
    .set(
      {
        ...rest,
        members: members.map((name, i) => ({ id: `${id}-${i}`, name })),
      },
      { merge: true }
    );
  console.log(`✓ families/${id} (${members.length} members)`);
}

// Departure flight as the first scheduled event (only if it doesn't exist)
const flightRef = tripRef.collection("events").doc("flight-out");
if (!(await flightRef.get()).exists) {
  await flightRef.set({
    title: "טיסה לסיציליה ✈️",
    emoji: "✈️",
    placeId: null,
    day: "2026-08-15",
    startTime: "21:35",
    durationMin: null,
    participants: { type: "all" },
    notes: "המראה מנתב״ג",
    createdAt: Date.now(),
  });
  console.log("✓ events/flight-out");
}

console.log("Seed complete.");
