/**
 * Multi-trip registry. Pure data — importable from client and server.
 * Each trip gets its own Firestore root (trips/<id>), URL prefix and
 * branding. Sicily keeps prefix "" so its URLs stay unchanged.
 */

export type TripKey = "sicily" | "sardinia";

export interface TripAiConfig {
  /** Bottom-nav label */
  navLabel: string;
  /** Page h1 */
  title: string;
  /** Page kicker */
  kicker: string;
  emoji: string;
  /** The guide's face: gallery robot or uploaded image (resolved URL) */
  avatar?: string | null;
  /** Intro card text */
  heroBlurb: string;
  subtitle: string;
  quickAddLabel: string;
  /** More page row */
  moreEmoji: string;
  moreLabel: string;
  suggestedPrompts: string[];
  aboutTitle: string;
  aboutDescription: string;
  aboutPlaceholder: string;
  aboutSaved: string;
  inputPlaceholder: string;
}

export interface TripGroupConfig {
  /** Generic unit word ("Families" / "Friends") */
  unitLabel: string;
  /** Glyph key for the group row on the More page */
  groupEmoji: string;
  /** Families page h1 */
  pageTitle: string;
  /** Families-page summary suffix, e.g. " · one villa" */
  summarySuffix: string;
  /** More page row */
  moreLabel: string;
  moreDescription: string;
  /** Expenses split labels */
  splitEveryoneLabel: string;
  splitPickLabel: string;
  loadingLabel: string;
  /** Name-pick login (the old "kids" flow) */
  quickLoginTitle: string;
  quickLoginHint: string;
  pickUnitPrompt: string;
  pickNamePrompt: string;
}

export interface TripStopConfig {
  label: string;
  /** Latin word appended to Places/Waze searches */
  region: string;
  timezone: string;
  currency: string;
  startDate: string;
  endDate: string;
  lat: number;
  lng: number;
  flag: string;
}

export interface TripConfig {
  /** "custom" = a self-serve trip built from its Firestore doc */
  key: TripKey | "custom";
  id: string;
  /** Firestore root: trips/<id> */
  path: string;
  /** URL prefix — "" for sicily, "/sardinia" for sardinia */
  prefix: string;
  /** Legacy trips keep the shared-password access model until migrated */
  legacy: boolean;
  name: string;
  shortName: string;
  /** Latin kicker over heroes */
  kicker: string;
  /** Gate subtitle */
  tagline: string;
  /** Gate bottom line */
  groupLine: string;
  /** Settings footer */
  signature: string;
  emoji: string;
  flag: string;
  /** Home "Day X of N · <suffix>" */
  dayLabelSuffix: string;
  heroTitle: string;
  /** null → designed CSS hero (no photo) */
  heroImage: string | null;
  /** Designed hero when there is no photo: a big glyph + small icon */
  heroArt: { big: string; icon: string } | null;
  countdownTarget: string;
  departureNote: string;
  startDate: string;
  endDate: string;
  /** IANA time zone of the destination */
  timezone: string;
  /** ISO 4217 — the current stop's local currency */
  currency: string;
  /** The currencies the organizer chose for expenses (absent = the stops' + ₪) */
  currencies?: string[];
  /** The currency the combined settle-up is shown in (absent = see `mainCurrencyOf`) */
  mainCurrency?: string;
  /** Manually edited rates: units of the main currency per 1 unit of the key */
  rateOverrides?: Record<string, number>;
  /** Itinerary, in order (single entry for one-destination trips) */
  stops: TripStopConfig[];
  mapCenter: { lat: number; lng: number };
  /** Region word appended to Places/Waze searches */
  searchRegionHint: string;
  /** Fallback for the HOME FAB when places/villa is missing; null hides it */
  homeBase: {
    navAria: string;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
  } | null;
  /** Push confirmation / SW fallback title */
  pushTitle: string;
  tourKey: string;
  /** Short AI name used inside chat replies */
  aiName: string;
  ai: TripAiConfig;
  group: TripGroupConfig;
}

const SICILY: TripConfig = {
  key: "sicily",
  id: "sicily-2026",
  path: "trips/sicily-2026",
  prefix: "",
  legacy: true,
  name: "סיציליה 2026",
  shortName: "סיציליה",
  kicker: "Sicily Together",
  tagline: "הטיול המשפחתי הפרטי שלנו",
  groupLine: "חבורת מיחא · ארבע משפחות · ים תיכון",
  signature: "סיציליה 2026 · חבורת מיחא",
  emoji: "sun",
  flag: "",
  dayLabelSuffix: "סיציליה",
  heroTitle: "סיציליה מחכה לנו",
  heroImage: "/images/hero.jpg",
  heroArt: null,
  countdownTarget: "2026-08-15T21:35:00+03:00",
  departureNote: "ההמראה מנתב״ג · שבת 15.8 · 21:35",
  startDate: "2026-08-15",
  endDate: "2026-08-24",
  timezone: "Europe/Rome",
  currency: "EUR",
  stops: [
    {
      label: "סיציליה",
      region: "Sicily",
      timezone: "Europe/Rome",
      currency: "EUR",
      startDate: "2026-08-15",
      endDate: "2026-08-24",
      lat: 37.55,
      lng: 14.25,
      flag: "",
    },
  ],
  mapCenter: { lat: 37.55, lng: 14.25 },
  searchRegionHint: "Sicily",
  homeBase: {
    navAria: "נווט הביתה לוילה",
    name: "הוילה — Villa Maria con piscina e vista mare",
    address:
      "Contrada Bocca della Carrubba, sn, 91014 Castellammare del Golfo TP, Italy",
    lat: 38.0070196,
    lng: 12.887506,
  },
  pushTitle: "סיציליה 2026",
  tourKey: "micha-tour-seen-v1",
  aiName: "המשרת של החבורה",
  ai: {
    navLabel: "המשרת",
    title: "המשרת של חבורת מיחא",
    kicker: "חבורת מיחא",
    emoji: "sparkles",
    heroBlurb:
      "המשרת של החבורה לשירותכם — המלצות, שיבוצים בלוח, סקרים ועדכון מקומות. מחובר לכל נתוני הטיול",
    subtitle: "מכיר את המקומות, הלו״ז ואת כל החבורה",
    quickAddLabel: "שאל את המשרת של החבורה",
    moreEmoji: "sparkles",
    moreLabel: "המשרת של חבורת מיחא",
    suggestedPrompts: [
      "תמליץ לנו על אטרקציה",
      "מה כדאי לעשות מחר?",
      "תמצא לנו מסעדה טובה לילדים",
      "תמצא פעילות לילדים",
      "תמצא Plan B אם יורד גשם",
      "מה עוד לא שובץ בלוח?",
    ],
    aboutTitle: "ספרו למשרת עלינו",
    aboutDescription:
      "כל מה שתכתבו כאן נכנס לידע של המשרת: מי זה מי, גילאים, סיפורים, מה הילדים אוהבים, בדיחות פנימיות — והוא ישתמש בזה בשיחות ובהמלצות",
    aboutPlaceholder:
      "למשל: מיקה בת 10 ואוהבת פארקי מים. אורי משוגע על כדורגל...",
    aboutSaved: "נשמר — המשרת כבר מכיר את זה",
    inputPlaceholder: "שאלו אותי כל דבר על הטיול…",
  },
  group: {
    unitLabel: "משפחות",
    groupEmoji: "users",
    pageTitle: "המשפחות",
    summarySuffix: " · וילה אחת",
    moreLabel: "משפחות",
    moreDescription: "ארבע המשפחות שלנו",
    splitEveryoneLabel: "כולם השתתפו (כל המשפחות)",
    splitPickLabel: "בחרו אילו משפחות השתתפו",
    loadingLabel: "טוען משפחות…",
    quickLoginTitle: "כניסה לילדים — בלי אימייל",
    quickLoginHint:
      "הזינו את קוד הטיול (תשאלו את ההורים), ואז תבחרו את השם שלכם",
    pickUnitPrompt: "מאיזו משפחה אתם?",
    pickNamePrompt: "ועכשיו — מי אתם?",
  },
};

const SARDINIA: TripConfig = {
  key: "sardinia",
  id: "sardinia-2026",
  path: "trips/sardinia-2026",
  prefix: "/sardinia",
  legacy: true,
  name: "סרדיניה 2026",
  shortName: "סרדיניה",
  kicker: "SARDINIA 60",
  tagline: "חוגגים 60 בסרדיניה",
  groupLine: "חמישה חברים אחים · יום הולדת 60 · ים תיכון",
  signature: "סרדיניה 2026 · חוגגים 60",
  emoji: "plane",
  flag: "",
  dayLabelSuffix: "סרדיניה",
  heroTitle: "סרדיניה, אנחנו באים",
  heroImage: "/images/sardinia-hero.jpg",
  heroArt: { big: "60", icon: "plane" },
  countdownTarget: "2026-09-03T07:00:00+03:00",
  departureNote: "ההמראה מנתב״ג · יום חמישי 3.9 · 07:00 · טרמינל 3",
  startDate: "2026-09-03",
  endDate: "2026-09-10",
  timezone: "Europe/Rome",
  currency: "EUR",
  stops: [
    {
      label: "סרדיניה",
      region: "Sardinia",
      timezone: "Europe/Rome",
      currency: "EUR",
      startDate: "2026-09-03",
      endDate: "2026-09-10",
      lat: 40.05,
      lng: 9.05,
      flag: "",
    },
  ],
  mapCenter: { lat: 40.05, lng: 9.05 },
  searchRegionHint: "Sardinia",
  homeBase: null,
  pushTitle: "סרדיניה 2026",
  tourKey: "sardinia-tour-seen-v1",
  aiName: "הטייס",
  ai: {
    navLabel: "הטייס",
    title: "הטייס",
    kicker: "טייסת סרדיניה",
    emoji: "pilot",
    heroBlurb:
      "הטייס בקבינה לשירותכם — המלצות, נופים, מסעדות ושיבוצים בלוח. מחובר לכל נתוני הטיול",
    subtitle: "מכיר את המקומות, הלו״ז ואת כל החבורה",
    quickAddLabel: "שאל את הטייס",
    moreEmoji: "pilot",
    moreLabel: "הטייס",
    suggestedPrompts: [
      "תמליץ לנו על נקודת תצפית מטורפת",
      "מה כדאי לעשות מחר?",
      "תמצא מסעדת דגים טובה",
      "תמצא יקב לטעימות יין",
      "תכנן לנו יום של חופים",
      "מה עוד לא שובץ בלוח?",
    ],
    aboutTitle: "ספרו לטייס עלינו",
    aboutDescription:
      "כל מה שתכתבו כאן נכנס לידע של הטייס: מי זה מי, מה כל אחד אוהב, סיפורים מהטייסת — והוא ישתמש בזה בשיחות ובהמלצות",
    aboutPlaceholder:
      "למשל: אורן חובב יין. נדב מגיע מחו״ל ומצטרף אלינו בקליארי...",
    aboutSaved: "נשמר — הטייס כבר מכיר את זה",
    inputPlaceholder: "שאלו אותי כל דבר על הטיול…",
  },
  group: {
    unitLabel: "חברים",
    groupEmoji: "users",
    pageTitle: "החבורה",
    summarySuffix: " · חוגגים 60",
    moreLabel: "החבורה",
    moreDescription: "חמשת החברים",
    splitEveryoneLabel: "כולם השתתפו (כל החברים)",
    splitPickLabel: "בחרו מי השתתף",
    loadingLabel: "טוען חברים…",
    quickLoginTitle: "כניסה מהירה — בלי אימייל",
    quickLoginHint: "הזינו את קוד הטיול ובחרו את השם שלכם",
    pickUnitPrompt: "מי אתם?",
    pickNamePrompt: "ועכשיו — בחרו את השם",
  },
};

export const TRIPS: Record<TripKey, TripConfig> = {
  sicily: SICILY,
  sardinia: SARDINIA,
};

export const DEFAULT_TRIP = SICILY;

/** Static config for a legacy trip id, or null for self-serve trips. */
export function legacyTripById(
  id: string | undefined | null
): TripConfig | null {
  return Object.values(TRIPS).find((trip) => trip.id === id) ?? null;
}

export function tripById(id: string | undefined | null): TripConfig {
  return (
    Object.values(TRIPS).find((trip) => trip.id === id) ?? DEFAULT_TRIP
  );
}
