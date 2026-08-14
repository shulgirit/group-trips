/**
 * Seeds the attractions Omer already knows the group wants.
 * Idempotent — fixed doc IDs, merge writes.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> node scripts/seed-attractions.mjs
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const tripRef = db.collection("trips").doc("sicily-2026");

const places = [
  {
    id: "erice-adventure-park",
    name: "Erice Adventure Park — אומגות",
    category: "attraction",
    area: "אריצ׳ה (ליד טראפני)",
    address: "SP31, 91016 Casa Santa TP, Italy",
    lat: 38.0272785,
    lng: 12.559445,
    website: "http://www.parcoavventuraerice.it/",
    summary:
      "פארק אתגרי ביער של אריצ׳ה, ליד טראפני — אומגות (zipline), גשרי חבלים ומסלולי טיפוס לכל הגילאים. דירוג 4.8 בגוגל. כשעה מהוילה.",
  },
  {
    id: "segesta-tour-4x4",
    name: "Segesta Tour 4x4 — ג׳יפים",
    category: "attraction",
    area: "סג׳סטה",
    address: "SP68, 91013 Calatafimi-Segesta TP, Italy",
    lat: 37.9677684,
    lng: 12.8010668,
    website: "https://segestatour4x4.com/",
    summary:
      "טיולי ג׳יפים בשטח סביב סג׳סטה והמקדש היווני — חוויה שהילדים אוהבים. דירוג 4.9 בגוגל. כ-20 דקות מהוילה. כדאי להזמין מראש.",
  },
  {
    id: "terme-segestane",
    name: "Terme Segestane — מעיינות חמים",
    category: "attraction",
    area: "קסטלמארה דל גולפו",
    address: "Contrada Ponte Bagni, 1, 91014 Castellammare del Golfo TP, Italy",
    lat: 37.9725733,
    lng: 12.8918442,
    website: "http://www.termesegestane.com/",
    summary:
      "מעיינות חמים טבעיים בנחל — מים גופריתיים חמימים שזורמים בין בריכות סלע, חינם באזור הנחל. ממש קרוב לוילה (כ-15 דקות). להביא נעלי מים.",
  },
];

for (const { id, ...place } of places) {
  await tripRef
    .collection("places")
    .doc(id)
    .set({ ...place, createdAt: Date.now() }, { merge: true });
  console.log(`✓ places/${id}`);
}
console.log("Attractions seed complete.");
