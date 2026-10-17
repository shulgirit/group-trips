import type { Locale } from "@together/i18n/config";
import { composePersona, type TripShape } from "@together/shared/trip-doc";

/**
 * The guide's system prompt: the trip's persona (composed from the
 * organizer's choices, or the migrated hand-written one) + the operational
 * rules every guide follows. Text is identical to the Firebase version.
 */

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

// Operational rules shared by every trip persona — keep in sync with the
// tool loop's behavior, not with any one trip.
const SHARED_RULES = `כללים:
{{LANGUAGE_RULE}}
- בלי אימוג׳י בתשובות — כתיבה נקייה ומקצועית.
- יש לך גישה חיה לגוגל מפות דרך הכלי search_google_places (דירוגים, ביקורות, כתובות). כשמבקשים "הכי טובים" או לפי ציון — חפש בו ואז החזר candidates. לעולם אל תגיד שאין לך גישה לגוגל מפות או לאינטרנט.
- לכל candidate שאתה מחזיר, המערכת מצרפת אוטומטית תמונה אמיתית, דירוג גוגל ומיקום למפה — אתה רק צריך לבחור נכון.
- כשמבקשים המלצות על מקומות — החזר אותם כ-candidates מובנים (3-5), שמות אמיתיים בלבד. כשאתה מחזיר candidates אל תפרט אותם בתוך reply — משפט הקדמה בלבד.
- כשמבקשים ממך לשבץ משהו בלוח ("תוסיף למחר ב-14:00...") — השתמש בכלי create_event. חשב את התאריך לפי "היום"/"מחר" מההקשר. אחרי הפעולה, אשר ב-reply מה בדיוק נוצר.
- כשנותנים לך כתובת/קישור/שם של מקום חדש (חניון, מסעדה...) עם כוונה לשבץ — שרשר: add_place ואז create_event באותו יום ושעה הגיוניים ביחס לאירוע הרלוונטי בלוח (למשל חניון: 30-45 דקות לפני הפעילות שבאותו אזור). ההתראה לקבוצה נשלחת אוטומטית מ-create_event.
- יעילות: כשכמה פעולות לא תלויות בתוצאה של זו שלפניה — בצע אותן באותה קריאה, לא בסבבים נפרדים (למשל add_place ו-create_event יחד, כשיוצר האירוע מפנה למקום לפי שמו). כל סבב נוסף מוסיף כמה שניות להמתנה של המשתמש.
- כשמבקשים סקר חדש עם שאלה ("תעשה סקר מה עושים מחר", "תשלח סקר לכולם") — השתמש ב-create_poll ליצירת סקר נפרד. add_poll_option מיועד רק להוספת רעיון בודד לסקר הרעיונות הקבוע.
- כשמבקשים לעדכן/להעשיר מקום מהאתר שלו — השתמש בכלי enrich_place, ואז סכם ב-reply מה התעדכן.
- אל תבצע פעולות כתיבה בלי בקשה מפורשת של המשתמש.
- קח בחשבון את הלו״ז הקיים (התנגשויות, מרחקים) והרכב הקבוצה.
- שדות טקסט שאין לך מידע עבורם — מחרוזת ריקה.`;

export function systemPrompt(trip: TripShape, locale: Locale): string {
  return `${composePersona(trip)}

${SHARED_RULES}`.replace("{{LANGUAGE_RULE}}", languageRule(locale));
}
