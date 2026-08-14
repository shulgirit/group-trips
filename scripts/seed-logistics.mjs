/**
 * Seeds trip logistics: first-night hotel, Palermo airport (car rental),
 * the villa, and all fixed transit events. Idempotent — fixed doc IDs,
 * merge writes, never deletes.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> node scripts/seed-logistics.mjs
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TRIP_ID = "sicily-2026";

const app = initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const tripRef = db.collection("trips").doc(TRIP_ID);

const places = [
  {
    id: "hotel-kristal",
    name: "מלון Kristal",
    category: "accommodation",
    area: "צ'יניזי",
    address: "Corso Umberto I, 204A, 90045 Cinisi PA, Italy",
    lat: 38.1582732,
    lng: 13.1054526,
    summary:
      "המלון של הלילה הראשון (15.8) — כמה דקות נסיעה משדה התעופה. צ'ק-אין עד 23:00, הודענו שמגיעים 01:00–02:00.",
  },
  {
    id: "palermo-airport",
    name: "שדה התעופה פלרמו (PMO)",
    category: "other",
    area: "פונטה ראיזי",
    address: "Punta Raisi, 90045 Cinisi PA, Italy",
    lat: 38.1795458,
    lng: 13.0989603,
    summary:
      "כאן נוחתים, ממריאים, אוספים ומחזירים את הרכבים. דלפק Discovery Cars נמצא בטרמינל, באזור השכרת הרכב.",
  },
  {
    id: "villa",
    name: "הוילה — קסטלמארה דל גולפו",
    category: "accommodation",
    area: "קסטלמארה דל גולפו",
    address: "Contrada Bocca della Carrubba, 1, 91014 Castellammare del Golfo TP, Italy",
    lat: 38.0140133,
    lng: 12.8876269,
    summary:
      "הבית שלנו לשמונה לילות — בריכה, נוף לים ועצי זית, באירוח של Maria. צ'ק-אין 16.8 ב-15:00, צ'ק-אאוט 24.8 ב-10:00.",
  },
];

const events = [
  {
    id: "landing-hotel",
    title: "נחיתה בפלרמו → מלון Kristal",
    emoji: "🛬",
    placeId: "hotel-kristal",
    day: "2026-08-16",
    startTime: "00:30",
    durationMin: 90,
    participants: { type: "all" },
    notes: "הגעה משוערת למלון 01:00–02:00",
  },
  {
    id: "car-pickup",
    title: "איסוף רכבים",
    emoji: "🚗",
    placeId: "palermo-airport",
    day: "2026-08-16",
    startTime: "09:00",
    durationMin: 60,
    participants: { type: "all" },
    notes: "Discovery Cars — מומלץ להגיע בזמן כדי לא לאבד את הרכב",
  },
  {
    id: "villa-checkin",
    title: "צ'ק-אין בוילה",
    emoji: "🏡",
    placeId: "villa",
    day: "2026-08-16",
    startTime: "15:00",
    durationMin: null,
    participants: { type: "all" },
    notes: "",
  },
  {
    id: "villa-checkout",
    title: "צ'ק-אאוט מהוילה",
    emoji: "🧳",
    placeId: "villa",
    day: "2026-08-24",
    startTime: "10:00",
    durationMin: null,
    participants: { type: "all" },
    notes: "לפנות את הבית עד 10:00",
  },
  {
    id: "car-return",
    title: "החזרת רכבים",
    emoji: "🚗",
    placeId: "palermo-airport",
    day: "2026-08-24",
    startTime: "15:00",
    durationMin: null,
    participants: { type: "all" },
    notes: "Discovery Cars — החזרה עד 15:00, הטיסה ב-16:25",
  },
  {
    id: "flight-back",
    title: "טיסה חזרה לישראל",
    emoji: "✈️",
    placeId: "palermo-airport",
    day: "2026-08-24",
    startTime: "16:25",
    durationMin: null,
    participants: { type: "all" },
    notes: "נחיתה בתל אביב 20:40 (שעון ישראל)",
  },
];

for (const { id, ...place } of places) {
  await tripRef
    .collection("places")
    .doc(id)
    .set({ ...place, createdAt: Date.now() }, { merge: true });
  console.log(`✓ places/${id}`);
}

for (const { id, ...event } of events) {
  await tripRef
    .collection("events")
    .doc(id)
    .set({ ...event, createdAt: Date.now() }, { merge: true });
  console.log(`✓ events/${id}`);
}

// Clean up emoji duplication on the outbound flight + link it to the airport
await tripRef.collection("events").doc("flight-out").set(
  {
    title: "טיסה לסיציליה",
    emoji: "✈️",
    placeId: "palermo-airport",
    notes: "המראה מנתב״ג 21:35, נחיתה בפלרמו בסביבות חצות (שעון מקומי)",
  },
  { merge: true }
);
console.log("✓ events/flight-out updated");

// Villa on the trip document
await tripRef.set(
  {
    villa: {
      name: "הוילה — קסטלמארה דל גולפו",
      address:
        "Contrada Bocca della Carrubba, 1, 91014 Castellammare del Golfo TP, Italy",
      lat: 38.0140133,
      lng: 12.8876269,
    },
  },
  { merge: true }
);
console.log("✓ trip villa updated");

console.log("Logistics seed complete.");
