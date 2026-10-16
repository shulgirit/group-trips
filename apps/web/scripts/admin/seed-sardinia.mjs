// Seeds the Sardinia trip: trip doc (+ join code), the five friends as
// single-member units, the booked flights, and the Cagliari airport place.
// Idempotent — fixed doc ids with { merge: true }; never touches sicily.
// Run remotely: gh workflow run admin.yml -f script=seed-sardinia.mjs
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore(initializeApp({ credential: applicationDefault() }));
const TRIP = "trips/sardinia-2026";

// Low-security friend-group code (same tier as the documented sicily one).
// Change anytime by editing the trip doc's joinCode field.
const JOIN_CODE = "sardinia60";

await db.doc(TRIP).set(
  {
    name: "סרדיניה 2026",
    slug: "sardinia",
    startDate: "2026-09-03",
    endDate: "2026-09-10",
    currency: "EUR",
    joinCode: JOIN_CODE,
    aboutUs:
      "חמישה חברים ותיקים מהטייסת — אופיר, אייל, נדב, אורן ורונן — חוגגים יחד יום הולדת 60. " +
      "מבוגרים שאוהבים לטייל: נופים ונקודות תצפית, עיירות ציוריות, אוכל טוב, דגים ויין. בלי ילדים בטיול. " +
      "נדב מגיע מחו״ל ומצטרף אלינו ישירות בקליארי; שאר הארבעה טסים יחד מנתב״ג.",
  },
  { merge: true }
);
console.log("trip doc seeded");

const FRIENDS = [
  { id: "ofir", name: "אופיר", full: "אופיר זמר", color: "sea", order: 0 },
  { id: "eyal", name: "אייל", full: "אייל לוין", color: "terra", order: 1 },
  { id: "nadav", name: "נדב", full: "נדב", color: "lemon", order: 2 },
  { id: "oren", name: "אורן", full: "אורן ברון", color: "olive", order: 3 },
  { id: "ronen", name: "רונן", full: "רונן גדות", color: "sea", order: 4 },
];
for (const friend of FRIENDS) {
  await db.doc(`${TRIP}/families/${friend.id}`).set(
    {
      name: friend.name,
      color: friend.color,
      order: friend.order,
      members: [{ id: `${friend.id}-0`, name: friend.name }],
    },
    { merge: true }
  );
}
console.log(`families seeded: ${FRIENDS.length}`);

await db.doc(`${TRIP}/events/flight-out`).set(
  {
    title: "טיסה לסרדיניה ✈️ LY5487",
    emoji: "✈️",
    day: "2026-09-03",
    startTime: "07:00",
    durationMin: 235,
    placeId: null,
    participants: { type: "all" },
    notes:
      "המראה מנתב״ג טרמינל 3 · נחיתה בקליארי 09:55 · מושבים 17B-E · Locator 7T2P6I · אופיר, אייל, אורן ורונן. נדב נוחת בקליארי בנפרד — לתאם איסוף!",
    createdAt: Date.now(),
  },
  { merge: true }
);
await db.doc(`${TRIP}/events/flight-back`).set(
  {
    title: "טיסה הביתה ✈️ LY5488",
    emoji: "🛬",
    day: "2026-09-10",
    startTime: "11:00",
    durationMin: 215,
    placeId: "cagliari-airport",
    participants: { type: "all" },
    notes:
      "המראה מקליארי 11:00 · נחיתה בנתב״ג 15:35 טרמינל 3 · מושבים 23C-F · Locator 7T2P6I · להגיע לשדה עד 09:00",
    createdAt: Date.now(),
  },
  { merge: true }
);
console.log("flight events seeded");

await db.doc(`${TRIP}/places/cagliari-airport`).set(
  {
    name: "שדה התעופה קליארי (CAG)",
    category: "other",
    area: "קליארי",
    address: "Via dei Trasvolatori, 09030 Elmas CA, Italy",
    lat: 39.2515,
    lng: 9.0543,
    summary: "שדה הבית של הטיול — נחיתה 3.9 ב-09:55, המראה חזרה 10.9 ב-11:00.",
    createdAt: Date.now(),
  },
  { merge: true }
);
console.log("cagliari airport seeded");

const check = await db.doc(TRIP).get();
console.log("verify trip doc:", JSON.stringify({ ...check.data(), joinCode: "***" }));
console.log("DONE — sardinia-2026 seeded");
