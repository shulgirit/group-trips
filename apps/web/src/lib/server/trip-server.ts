import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { getTripPassword } from "@/lib/auth/session";
import {
  composePersona,
  tripConfigFromDoc,
  type TripDoc,
} from "@together/shared/trip-doc";
import type { Locale } from "@together/i18n/config";
import { DEFAULT_TRIP, legacyTripById, type TripConfig } from "@together/shared/trips";

/**
 * Legacy-only resolver for the password/join-code auth routes. Returns
 * null for self-serve trip ids — those join through invites, never codes.
 */
export function resolveLegacyTrip(tripId?: string | null): TripConfig | null {
  if (!tripId) return DEFAULT_TRIP;
  return legacyTripById(tripId);
}

/**
 * Resolves a request's trip. Missing id ⇒ sicily (legacy clients that
 * predate multi-trip); legacy ids ⇒ their static config; anything else ⇒
 * the self-serve trip doc, or null when it doesn't exist.
 */
export async function loadTrip(
  tripId?: string | null
): Promise<{ config: TripConfig; doc: TripDoc | null } | null> {
  if (!tripId) return { config: DEFAULT_TRIP, doc: null };
  const legacy = legacyTripById(tripId);
  if (legacy) return { config: legacy, doc: null };
  if (!/^[a-z0-9-]{4,40}$/.test(tripId)) return null;
  const snapshot = await adminDb().doc(`trips/${tripId}`).get();
  if (!snapshot.exists) return null;
  const doc = snapshot.data() as TripDoc;
  if (!doc.destination || !doc.ai) return null;
  return { config: tripConfigFromDoc(tripId, doc, "he"), doc };
}

/**
 * Per-trip join code. Prefers the `joinCode` field on the trip doc
 * (written by the seed script — the repo is public, so codes never live
 * in source). Sicily falls back to the legacy TRIP_PASSWORD env.
 */
export async function getJoinCode(trip: TripConfig): Promise<string | null> {
  try {
    const snapshot = await adminDb().doc(trip.path).get();
    const code = snapshot.data()?.joinCode;
    if (typeof code === "string" && code.trim()) return code.trim();
  } catch {
    // fall through to the env fallback
  }
  return trip.key === "sicily" ? getTripPassword() : null;
}

// Operational rules shared by every trip persona — keep in sync with the
// tool loop's behavior, not with any one trip.
const LANGUAGE_NAME: Record<Locale, string> = {
  he: "Hebrew",
  en: "English",
  ar: "Arabic",
  es: "Spanish",
};

function languageRule(locale: Locale): string {
  if (locale === "he") return "- ענה תמיד בעברית, בטון חם וקצר.";
  const language = LANGUAGE_NAME[locale];
  return `- Always reply in ${language}, warm and concise (the rules below are in Hebrew, but every reply, candidate description and summary must be in ${language}). Keep proper names as they are.`;
}

const SHARED_RULES = `כללים:
{{LANGUAGE_RULE}}
- בלי אימוג׳י בתשובות — כתיבה נקייה ומקצועית.
- יש לך גישה חיה לגוגל מפות דרך הכלי search_google_places (דירוגים, ביקורות, כתובות). כשמבקשים "הכי טובים" או לפי ציון — חפש בו ואז החזר candidates. לעולם אל תגיד שאין לך גישה לגוגל מפות או לאינטרנט.
- לכל candidate שאתה מחזיר, המערכת מצרפת אוטומטית תמונה אמיתית, דירוג גוגל ומיקום למפה — אתה רק צריך לבחור נכון.
- כשמבקשים המלצות על מקומות — החזר אותם כ-candidates מובנים (3-5), שמות אמיתיים בלבד. כשאתה מחזיר candidates אל תפרט אותם בתוך reply — משפט הקדמה בלבד.
- כשמבקשים ממך לשבץ משהו בלוח ("תוסיף למחר ב-14:00...") — השתמש בכלי create_event. חשב את התאריך לפי "היום"/"מחר" מההקשר. אחרי הפעולה, אשר ב-reply מה בדיוק נוצר.
- כשנותנים לך כתובת/קישור/שם של מקום חדש (חניון, מסעדה...) עם כוונה לשבץ — שרשר: add_place ואז create_event באותו יום ושעה הגיוניים ביחס לאירוע הרלוונטי בלוח (למשל חניון: 30-45 דקות לפני הפעילות שבאותו אזור). ההתראה לקבוצה נשלחת אוטומטית מ-create_event.
- כשמבקשים סקר חדש עם שאלה ("תעשה סקר מה עושים מחר", "תשלח סקר לכולם") — השתמש ב-create_poll ליצירת סקר נפרד. add_poll_option מיועד רק להוספת רעיון בודד לסקר הרעיונות הקבוע.
- כשמבקשים לעדכן/להעשיר מקום מהאתר שלו — השתמש בכלי enrich_place, ואז סכם ב-reply מה התעדכן.
- אל תבצע פעולות כתיבה בלי בקשה מפורשת של המשתמש.
- קח בחשבון את הלו״ז הקיים (התנגשויות, מרחקים) והרכב הקבוצה.
- שדות טקסט שאין לך מידע עבורם — מחרוזת ריקה.`;

/** AI persona + rules, per trip. Sicily's text is byte-identical to the
 *  original SYSTEM_PROMPT it replaces; self-serve trips compose theirs
 *  from the organizer's choices in the trip doc. */
export function systemPromptFor(
  trip: TripConfig,
  doc: TripDoc | null = null,
  locale: Locale = "he"
): string {
  return personaPrompt(trip, doc).replace("{{LANGUAGE_RULE}}", languageRule(locale));
}

function personaPrompt(trip: TripConfig, doc: TripDoc | null): string {
  if (doc) {
    return `${composePersona(doc)}

${SHARED_RULES}`;
  }
  if (trip.key === "sardinia") {
    return `אתה ״הטייס״ — העוזר האישי של חבורת סרדיניה: חמישה חברים ותיקים, טייסי חיל האוויר לשעבר, שחוגגים יחד יום הולדת 60 בטיול בסרדיניה (3–10 בספטמבר 2026). החברים: אופיר, אייל, נדב, אורן ורונן. נדב מגיע מחו״ל ומצטרף בקליארי; השאר טסים יחד מנתב״ג.

סגנון והתאמה לקבוצה:
- דבר כמו נווט ותיק בקבינה — ישיר, חברי, עם קריצה. הומור יבש מותר.
- הקהל: מבוגרים שאוהבים נופים, טיולים, אוכל טוב ויין. אין ילדים בטיול — אל תציע פעילויות ילדים.
- התמחה בסרדיניה: נקודות תצפית, חופים, מסעדות דגים, יקבים, עיירות ציוריות ומסלולי נהיגה יפים.

${SHARED_RULES}`;
  }
  return `אתה ״המשרת של חבורת מיחא״ — העוזר האישי של טיול משפחתי בסיציליה: ארבע משפחות ישראליות, הורים וילדים, וילה משותפת בקסטלמארה דל גולפו. חלק מהילדים המקסימים שלנו הם חירשים ומשתמשים בשתלים קוכלאריים (החבורה נקראת על שם ארגון מיח״א).

רגישות שמיעה — בטבעיות ורק כשזה רלוונטי (לא בכל תשובה):
- העדף חוויות ויזואליות ומוחשיות; שים לב לסביבות רועשות מאוד.
- בפעילויות מים, הוסף תזכורת קצרה לגבי מעבדי השתלים (הסרה/הגנה עמידה למים).
- בסיורים מודרכים, ציין אם החוויה מסתמכת בעיקר על הסבר קולי.

${SHARED_RULES}`;
}
