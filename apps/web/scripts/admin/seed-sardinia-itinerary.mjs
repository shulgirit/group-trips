// Seeds the full Sardinia itinerary from the trip Excel: two hotels,
// booked activities (guides/phones/costs) and the day-by-day schedule.
// Addresses/coords/photos come from Google via the DEPLOYED app's own
// member-gated /api/import/search (the Maps key lives only in Vercel);
// curated fallbacks keep every place sane when a lookup is weak.
// Idempotent — fixed ids with { merge: true }. Never touches sicily.
// Run remotely: gh workflow run admin.yml -f script=seed-sardinia-itinerary.mjs
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore(initializeApp({ credential: applicationDefault() }));
const TRIP = "trips/sardinia-2026";
const APP = "https://sicily-together.vercel.app";
// The shared gate password — already documented in the public CLAUDE.md
const TRIP_PASSWORD = process.env.TRIP_PASSWORD || "italy2026";

/* ---------- login to the deployed app for Google-powered lookups ---------- */

let cookie = null;
try {
  const login = await fetch(`${APP}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: TRIP_PASSWORD }),
  });
  const setCookie = login.headers.get("set-cookie");
  if (login.ok && setCookie) {
    cookie = setCookie.split(";")[0];
    console.log("logged into deployed app for Google lookups");
  } else {
    console.log(`login failed (${login.status}) — using curated data only`);
  }
} catch (error) {
  console.log("login error — using curated data only:", String(error));
}

async function googleLookup(query) {
  if (!cookie) return null;
  try {
    const response = await fetch(`${APP}/api/import/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ query, tripId: "sardinia-2026" }),
    });
    if (!response.ok) return null;
    const { results } = await response.json();
    return results?.[0] ?? null;
  } catch {
    return null;
  }
}

function decentMatch(candidate, spec) {
  if (!candidate) return false;
  if (spec.expectDomain && candidate.website) {
    try {
      if (new URL(candidate.website).hostname.includes(spec.expectDomain)) {
        return true;
      }
    } catch {
      // fall through to name check
    }
  }
  const words = spec.matchWords ?? [];
  const hay = `${candidate.name} ${candidate.address}`.toLowerCase();
  return words.some((w) => hay.includes(w.toLowerCase()));
}

/* ---------- places ---------- */

const PLACES = [
  {
    id: "hotel-nascar",
    query: "Hotel Nascar Santa Maria Navarrese",
    matchWords: ["nascar"],
    expectDomain: "nascarhotel",
    data: {
      name: "מלון Nascar — סנטה מריה נבארזה",
      category: "accommodation",
      area: "סנטה מריה נבארזה",
      website: "https://www.nascarhotel.eu/hotel/",
      stayFrom: "2026-09-03",
      stayTo: "2026-09-07",
      priceNotes: "€170 ללילה הראשון · €136 ללילה · החדרים שמורים כבר מ-2.9",
      summary: "הבסיס לחלק הראשון (3–7.9): שייט, Sa Giuntura ויום הליכה וחוף.",
    },
    fallback: {
      address: "Via Lungomare, 08040 Santa Maria Navarrese NU, Italy",
      lat: 39.9922,
      lng: 9.6853,
    },
  },
  {
    id: "hotel-don-diego",
    query: "Hotel Don Diego Puntaldia San Teodoro",
    matchWords: ["don diego"],
    expectDomain: "hoteldondiego",
    data: {
      name: "מלון Don Diego — צפון-מזרח סרדיניה",
      category: "accommodation",
      area: "סן תאודורו",
      website: "https://www.hoteldondiego.com/en/",
      stayFrom: "2026-09-07",
      stayTo: "2026-09-10",
      priceNotes: "€207.67 לאדם ללילה",
      summary: "הבסיס לחלק השני (7–10.9): קניונינג, Tavolara ויום חוף.",
    },
    fallback: {
      address: "Località Puntaldia, 07052 San Teodoro SS, Italy",
      lat: 40.8317,
      lng: 9.6539,
    },
  },
  {
    id: "marina-smn",
    query: "Porto Santa Maria Navarrese marina",
    matchWords: ["navarrese", "porto", "marina"],
    data: {
      name: "נמל סנטה מריה נבארזה — יציאה לשייט",
      category: "other",
      area: "סנטה מריה נבארזה",
      summary: "נקודת היציאה לשייט במפרץ אורוזיי (Nautica).",
    },
    fallback: {
      address: "Porto Turistico, 08040 Santa Maria Navarrese NU, Italy",
      lat: 39.9931,
      lng: 9.6893,
    },
  },
  {
    id: "genna-cruxi",
    query: "Genna Croce SS125 Urzulei",
    matchWords: ["genna", "urzulei", "ss125"],
    data: {
      name: "נקודת מפגש Genna Cruxi (SS125)",
      category: "other",
      area: "אורזולאי",
      summary:
        "נקודת המפגש לטרק Sa Giuntura עם Sergio. כ-45 דקות נסיעה מסנטה מריה נבארזה.",
    },
    fallback: {
      address: "Genna Cruxi, SS125, Urzulei NU, Italy",
      lat: null,
      lng: null,
    },
  },
  {
    id: "pedra-longa",
    query: "Pedra Longa Baunei",
    matchWords: ["pedra longa"],
    data: {
      name: "Pedra Longa — צוק בים",
      category: "attraction",
      area: "באוניי",
      summary: "מחט אבן מרהיבה בים. תחילת מסלול ההליכה לכיוון סנטה מריה נבארזה.",
    },
    fallback: {
      address: "Pedra Longa, 08040 Baunei NU, Italy",
      lat: 39.9757,
      lng: 9.7043,
    },
  },
  {
    id: "cala-luna",
    query: "Cala Luna beach",
    matchWords: ["cala luna"],
    data: {
      name: "חוף Cala Luna",
      category: "beach",
      area: "מפרץ אורוזיי",
      summary: "מהחופים המפורסמים של מפרץ אורוזיי — מערות, מים צלולים.",
    },
    fallback: {
      address: "Cala Luna, Dorgali NU, Italy",
      lat: 40.2262,
      lng: 9.6247,
    },
  },
  {
    id: "grotta-bue-marino",
    query: "Grotta del Bue Marino Dorgali",
    matchWords: ["bue marino"],
    data: {
      name: "מערת Bue Marino",
      category: "attraction",
      area: "מפרץ אורוזיי",
      summary: "מערת נטיפים על קו החוף — תחנה במסלול Cala Luna.",
    },
    fallback: {
      address: "Grotta del Bue Marino, Dorgali NU, Italy",
      lat: 40.248,
      lng: 9.6222,
    },
  },
  {
    id: "riu-pitrisconi",
    query: "Rio Pitrisconi canyoning Monte Nieddu San Teodoro",
    matchWords: ["pitrisconi", "nieddu"],
    data: {
      name: "קניון Riu Pitrisconi",
      category: "sport",
      area: "סן תאודורו",
      website:
        "https://www.booking-sardinia.ovh/experiences/canyoning-rio-pitrisconi",
      summary: "קניונינג בנחל Pitrisconi שבמונטה ניידו — גלישות וקפיצות למים.",
    },
    fallback: {
      address: "Monte Nieddu, 07052 San Teodoro SS, Italy",
      lat: 40.7576,
      lng: 9.5905,
    },
  },
  {
    id: "tavolara",
    query: "Isola Tavolara",
    matchWords: ["tavolara"],
    data: {
      name: "האי Tavolara",
      category: "attraction",
      area: "צפון-מזרח סרדיניה",
      website:
        "https://www.booking-sardinia.ovh/experiences/hiking-tavolara-island",
      summary: "אי סלעי מרהיב מול החוף — סירות יוצאות מ-Porto San Paolo.",
    },
    fallback: {
      address: "Isola Tavolara, Olbia SS, Italy",
      lat: 40.8955,
      lng: 9.7093,
    },
  },
  {
    id: "il-portolano",
    query: "Ristorante Il Portolano Sardinia",
    matchWords: ["portolano"],
    expectDomain: "ristoranteilportolano",
    data: {
      name: "מסעדת Il Portolano",
      category: "restaurant",
      website: "https://www.ristoranteilportolano.it/?lang=en",
      summary: "ארוחת הערב החגיגית של 9.9 🎉",
    },
    fallback: {
      address: "Il Portolano, Sardinia, Italy",
      lat: null,
      lng: null,
    },
  },
];

let withPhoto = 0;
for (const spec of PLACES) {
  const candidate = await googleLookup(spec.query);
  const good = decentMatch(candidate, spec);
  const resolved = good
    ? {
        address: candidate.address || spec.fallback.address,
        lat: candidate.lat ?? spec.fallback.lat,
        lng: candidate.lng ?? spec.fallback.lng,
        imageUrl: candidate.imageUrl || undefined,
        rating: candidate.rating ?? undefined,
      }
    : { ...spec.fallback };
  const doc = {
    ...spec.data,
    address: resolved.address,
    lat: resolved.lat,
    lng: resolved.lng,
    createdAt: Date.now(),
  };
  if (resolved.imageUrl) {
    doc.imageUrl = resolved.imageUrl;
    withPhoto++;
  }
  await db.doc(`${TRIP}/places/${spec.id}`).set(
    Object.fromEntries(
      Object.entries(doc).filter(([, v]) => v !== undefined)
    ),
    { merge: true }
  );
  console.log(
    `place ${spec.id}: ${good ? "GOOGLE" : "curated"} · ${doc.address} · ` +
      `coords=${doc.lat != null} · photo=${Boolean(resolved.imageUrl)}`
  );
}

/* ---------- events ---------- */

const EVENTS = [
  {
    id: "checkin-nascar",
    title: "צ'ק-אין במלון Nascar 🏨",
    emoji: "🏨",
    day: "2026-09-03",
    startTime: "14:00",
    durationMin: 60,
    placeId: "hotel-nascar",
    notes:
      "אחרי הנחיתה בקליארי — כ-2.5 שעות נסיעה לסנטה מריה נבארזה. החדרים שמורים כבר מ-2.9.",
  },
  {
    id: "boat-orosei",
    title: "שייט במפרץ אורוזיי 🚤",
    emoji: "🚤",
    day: "2026-09-04",
    startTime: "09:00",
    durationMin: 420,
    placeId: "marina-smn",
    notes:
      "הוזמן דרך Nautica · טלפון ‎+39 0782 615522 · €66 לאדם · שעת יציאה מדויקת לתיאום מולם.",
  },
  {
    id: "sa-giuntura",
    title: "טרק Sa Giuntura 🥾",
    emoji: "🥾",
    day: "2026-09-05",
    startTime: "09:00",
    durationMin: 420,
    placeId: "genna-cruxi",
    notes:
      "הוזמן עם Sergio · טלפון ‎+39 338 305 4973 · €80 לאדם · מפגש ב-Genna Cruxi על SS125 — כ-45 דק' נסיעה, לצאת מהמלון ~08:00. פרטים: bestsardiniatrips.com/trekking-tour-to-the-waterfall-of-sa-giuntura-urzulei",
  },
  {
    id: "hike-beach",
    title: "יום הליכה וחוף — עצמאי 🥾🏖️",
    emoji: "🏖️",
    day: "2026-09-06",
    startTime: "09:30",
    durationMin: 420,
    placeId: "pedra-longa",
    notes:
      "שתי אפשרויות: (1) Pedra Longa → סנטה מריה נבארזה — alltrails.com/trail/italy/sardinia/pedra-longa-santa-maria-navarrese · (2) Cala Luna + מערת Bue Marino + Spiaggia Ziu Santoru — alltrails.com/trail/italy/sardinia/cala-luna-grotte-blu-marino-spiaggia-ziu-santoru · בלי מדריך, בלי עלות.",
  },
  {
    id: "move-don-diego",
    title: "מעבר למלון Don Diego 🚗",
    emoji: "🚗",
    day: "2026-09-07",
    startTime: "10:00",
    durationMin: 150,
    placeId: "hotel-don-diego",
    notes:
      "צ'ק-אאוט מ-Nascar ונסיעה לצפון-מזרח (כשעתיים). צ'ק-אין ב-Don Diego לפני הקניונינג.",
  },
  {
    id: "canyoning",
    title: "קניונינג Riu Pitrisconi 🧗",
    emoji: "🧗",
    day: "2026-09-07",
    startTime: "14:30",
    durationMin: 240,
    placeId: "riu-pitrisconi",
    notes:
      "הוזמן עם Stefano · טלפון ‎+39 333 689 8145 · €75 לאדם בקבוצה עד 10 (או €110 פרטי) · שעה מדויקת לתיאום מולו.",
  },
  {
    id: "tavolara-hike",
    title: "יום טיול ב-Tavolara 🥾",
    emoji: "⛰️",
    day: "2026-09-08",
    startTime: "09:00",
    durationMin: 420,
    placeId: "tavolara",
    notes:
      "הוזמן עם Stefano · טלפון ‎+39 333 689 8146 · €70 לאדם בקבוצה עד 10 (או €110 פרטי) · סירות יוצאות מ-Porto San Paolo.",
  },
  {
    id: "beach-day",
    title: "יום חוף רגוע 🏖️",
    emoji: "🏖️",
    day: "2026-09-09",
    startTime: "11:00",
    durationMin: 360,
    placeId: "hotel-don-diego",
    notes: "יום אחרון של ים ושמש לפני הטיסה הביתה.",
  },
  {
    id: "dinner-portolano",
    title: "ארוחת ערב חגיגית — Il Portolano 🍽️",
    emoji: "🍽️",
    day: "2026-09-09",
    startTime: "20:00",
    durationMin: 150,
    placeId: "il-portolano",
    notes: "סוגרים את הטיול בסטייל 🎉 · ristoranteilportolano.it",
  },
];

for (const event of EVENTS) {
  await db.doc(`${TRIP}/events/${event.id}`).set(
    {
      title: event.title,
      emoji: event.emoji,
      day: event.day,
      startTime: event.startTime,
      durationMin: event.durationMin,
      placeId: event.placeId,
      participants: { type: "all" },
      notes: event.notes,
      createdAt: Date.now(),
    },
    { merge: true }
  );
}
console.log(`events seeded: ${EVENTS.length}`);

// Refresh the two flight events' notes with the final picture
await db.doc(`${TRIP}/events/flight-out`).set(
  {
    notes:
      "המראה מנתב״ג טרמינל 3 (התייצבות ~04:30) · נחיתה בקליארי 09:55 · מושבים 17B-E · Locator 7T2P6I · נדב נוחת גם היום בטיסה נפרדת מחו״ל — לתאם מפגש!",
  },
  { merge: true }
);
await db.doc(`${TRIP}/events/flight-back`).set(
  {
    notes:
      "המראה מקליארי 11:00 · נחיתה בנתב״ג 15:35 טרמינל 3 · מושבים 23C-F · Locator 7T2P6I · צ'ק-אאוט ויציאה ~07:00 (כ-3 שעות נסיעה לקליארי) · נדב טס לבוסטון ✈️",
  },
  { merge: true }
);
console.log("flight notes refreshed");

/* ---------- trip doc ---------- */

await db.doc(TRIP).set(
  {
    aboutUs:
      "חמישה חברים ותיקים מהטייסת — אופיר, אייל, נדב, אורן ורונן — חוגגים יחד יום הולדת 60. " +
      "מבוגרים שאוהבים לטייל: נופים, טרקים, חופים, אוכל טוב ויין. בלי ילדים בטיול. " +
      "ארבעה טסים יחד מנתב״ג ב-3.9 (LY5487); נדב מגיע מחו״ל באותו יום בטיסה נפרדת וחוזר לבוסטון. " +
      "מבנה הטיול: 3–7.9 בסיס במלון Nascar בסנטה מריה נבארזה (שייט במפרץ אורוזיי, טרק Sa Giuntura, יום הליכה וחוף); " +
      "7.9 מעבר למלון Don Diego בצפון-מזרח + קניונינג Riu Pitrisconi; 8.9 טיול באי Tavolara; " +
      "9.9 יום חוף וארוחת ערב חגיגית ב-Il Portolano; 10.9 טיסה הביתה.",
  },
  { merge: true }
);
console.log("trip aboutUs refreshed");

console.log(
  `DONE — itinerary seeded: ${PLACES.length} places (${withPhoto} with photos), ${EVENTS.length} events + 2 flight updates`
);
