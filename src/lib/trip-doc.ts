/**
 * Self-serve trips: the Firestore trip doc IS the configuration.
 * Pure data + builders — importable from client and server.
 *
 * Legacy trips (sicily/sardinia) keep their hand-written TripConfig in
 * trips.ts; every trip created through /new is described by a TripDoc
 * and turned into the same TripConfig shape by tripConfigFromDoc(), so
 * the existing pages render it unchanged.
 */

import type { TripConfig } from "@/lib/trips";

export type GroupKind = "families" | "friends" | "couple" | "other";
export type TripStatus = "draft" | "active" | "archived";
export type TripRole = "owner" | "admin" | "member" | "kid";
export type AiPreset = "butler" | "pilot" | "buddy" | "guide" | "custom";

export interface TripDestination {
  label: string;
  placeId?: string;
  lat: number;
  lng: number;
  /** Word appended to Places/Waze searches ("Sicily", "Tuscany") */
  region: string;
  country?: string;
}

export interface TripHomeBase {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface TripAi {
  name: string;
  emoji: string;
  preset: AiPreset;
  /** Toggled rule-chip ids (see AI_RULES) */
  rules: string[];
  /** Free-text extra rules written by the organizer */
  customRules: string;
  /** Full persona override — used for migrated legacy personas */
  customPrompt?: string;
}

export interface TripDoc {
  name: string;
  emoji: string;
  destination: TripDestination;
  startDate: string;
  endDate: string;
  /** IANA zone of the destination, e.g. "Europe/Rome" */
  timezone: string;
  currency: "EUR" | "ILS" | "USD";
  /** https cover photo (Places photo) or null for a designed hero */
  coverImage: string | null;
  /** Outbound departure, ISO with offset — drives the home countdown */
  departureAt?: string | null;
  departureNote?: string;
  homeBase: TripHomeBase | null;
  groupKind: GroupKind;
  /** The group's nickname, e.g. "חבורת מיחא" */
  groupName: string;
  ai: TripAi;
  /** Free text the AI knows about the group (editable by all members) */
  aboutUs?: string;
  summary?: string;
  settings?: {
    membersCanDeletePlaces?: boolean;
  };
  status: TripStatus;
  ownerUid: string;
  plan: "free";
  createdAt: number;
  updatedAt: number;
}

export interface TripMember {
  role: TripRole;
  displayName: string;
  photoURL?: string;
  familyId: string | null;
  memberId: string | null;
  joinedAt: number;
}

export interface TripInvite {
  role: Exclude<TripRole, "owner">;
  /** Pre-selects the family on the join screen */
  familyId: string | null;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  maxUses: number;
  uses: number;
  revoked: boolean;
}

/** Public, non-sensitive slice shown on the invite landing page. */
export interface InvitePreview {
  tripId: string;
  name: string;
  emoji: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverImage: string | null;
  groupName: string;
  familyName: string | null;
  memberCount: number;
  organizer: string;
}

// ── AI personas ─────────────────────────────────────────────

export const AI_PRESETS: Record<
  Exclude<AiPreset, "custom">,
  {
    label: string;
    name: string;
    emoji: string;
    sample: string;
    persona: string;
  }
> = {
  butler: {
    label: "משרת אישי",
    name: "המשרת",
    emoji: "🎩",
    sample: "לשירותכם! הזמנתי לכם שולחן מול השקיעה — רק תגידו מתי 🎩",
    persona:
      "דבר כמו משרת אישי מנומס ושנון — אדיב, מסור, עם הומור עדין. אתה דואג לכל פרט.",
  },
  pilot: {
    label: "טייס / נווט",
    name: "הטייס",
    emoji: "✈️",
    sample: "כאן הקברניט. מזג אוויר מצוין, היעד הבא — חוף שווה במיוחד ✈️",
    persona:
      "דבר כמו נווט ותיק בקבינה — ישיר, חברי, עם קריצה. הומור יבש מותר.",
  },
  buddy: {
    label: "חבר מהחבורה",
    name: "החבר",
    emoji: "😎",
    sample: "אחי, יש פה מקום גלידה שאתם חייבים לנסות היום 😎",
    persona:
      "דבר כמו חבר טוב מהחבורה — קליל, מצחיק, בגובה העיניים, בלי רשמיות.",
  },
  guide: {
    label: "מדריך מקומי",
    name: "המדריך",
    emoji: "🧭",
    sample: "בבוקר מגיעים לפני 9 — ככה נמנעים מהתורים ומהחום 🧭",
    persona:
      "דבר כמו מדריך טיולים מקומי ומנוסה — מדויק, בקיא בהיסטוריה ובטיפים מעשיים, חם ומקצועי.",
  },
};

export const AI_RULES: { id: string; label: string; rule: string }[] = [
  {
    id: "kids",
    label: "👧 מתאים לילדים",
    rule: "יש ילדים בטיול — העדף פעילויות ומסעדות ידידותיות לילדים וציין התאמה לגילאים.",
  },
  {
    id: "adults",
    label: "🍷 מבוגרים בלבד",
    rule: "אין ילדים בטיול — אל תציע פעילויות ילדים. העדף נופים, אוכל טוב ויין.",
  },
  {
    id: "accessible",
    label: "♿ נגישות",
    rule: "חלק מהמטיילים זקוקים לנגישות — ציין נגישות, מדרגות, חניה קרובה ומרחקי הליכה.",
  },
  {
    id: "hearing",
    label: "🦻 רגישות שמיעה",
    rule: "חלק מהמטיילים לקויי שמיעה / עם שתלים — העדף חוויות ויזואליות, שים לב לרעש, ובפעילויות מים הזכר הגנה על המעבדים. בטבעיות ורק כשזה רלוונטי.",
  },
  {
    id: "kosher",
    label: "✡️ כשרות",
    rule: "חלק מהחבורה שומרים כשרות — כשאפשר ציין אפשרויות כשרות או צמחוניות/דגים.",
  },
  {
    id: "veggie",
    label: "🥗 צמחוני/טבעוני",
    rule: "יש צמחונים/טבעונים בחבורה — ודא שיש להם מה לאכול בכל המלצה.",
  },
  {
    id: "budget",
    label: "💰 חסכוני",
    rule: "החבורה מעדיפה תקציב שפוי — ציין טווחי מחירים והעדף תמורה טובה לכסף.",
  },
  {
    id: "short",
    label: "⚡ תשובות קצרות",
    rule: "תשובות קצרות מאוד ולעניין — שורה או שתיים.",
  },
  {
    id: "nature",
    label: "🌿 טבע ומסלולים",
    rule: "החבורה אוהבת טבע — הצע מסלולים, תצפיות וחופים פחות מוכרים.",
  },
];

/** The persona paragraph for a trip (shared rules are appended server-side). */
export function composePersona(trip: TripDoc): string {
  const ai = trip.ai;
  if (ai.customPrompt?.trim()) return ai.customPrompt.trim();
  const preset =
    ai.preset !== "custom" ? AI_PRESETS[ai.preset] : null;
  const group = GROUP_KINDS[trip.groupKind];
  const lines = [
    `אתה ״${ai.name}״ ${ai.emoji} — העוזר האישי של ${trip.groupName || "החבורה"}: ${group.aiDescription} בטיול ל${trip.destination.label} (${trip.startDate} עד ${trip.endDate}).`,
    "",
    "סגנון והתאמה לקבוצה:",
    `- ${preset?.persona ?? "דבר בטון חם, אישי ושנון."}`,
    `- התמחה ב${trip.destination.label}: אטרקציות, אוכל, נופים, טיפים מקומיים ולוגיסטיקה.`,
  ];
  for (const id of ai.rules) {
    const rule = AI_RULES.find((r) => r.id === id);
    if (rule) lines.push(`- ${rule.rule}`);
  }
  for (const line of (ai.customRules ?? "").split("\n")) {
    if (line.trim()) lines.push(`- ${line.trim()}`);
  }
  return lines.join("\n");
}

// ── Group kinds ─────────────────────────────────────────────

export const GROUP_KINDS: Record<
  GroupKind,
  {
    label: string;
    emoji: string;
    unitLabel: string;
    unitSingular: string;
    pageTitle: string;
    aiDescription: string;
  }
> = {
  families: {
    label: "כמה משפחות",
    emoji: "👨‍👩‍👧‍👦",
    unitLabel: "משפחות",
    unitSingular: "משפחה",
    pageTitle: "👨‍👩‍👧‍👦 המשפחות",
    aiDescription: "כמה משפחות שמטיילות יחד",
  },
  friends: {
    label: "חברים",
    emoji: "🥂",
    unitLabel: "חברים",
    unitSingular: "חבר/ה",
    pageTitle: "🥂 החבורה",
    aiDescription: "חבורת חברים שמטיילים יחד",
  },
  couple: {
    label: "זוג",
    emoji: "💑",
    unitLabel: "אנחנו",
    unitSingular: "בן/בת זוג",
    pageTitle: "💑 אנחנו",
    aiDescription: "זוג שמטייל יחד",
  },
  other: {
    label: "קבוצה",
    emoji: "🧳",
    unitLabel: "קבוצות",
    unitSingular: "קבוצה",
    pageTitle: "🧳 הקבוצה",
    aiDescription: "קבוצת מטיילים",
  },
};

/** Family color tokens understood by the UI (globals.css). */
export const FAMILY_COLORS = ["sea", "terra", "lemon", "olive"] as const;

// ── Builder ─────────────────────────────────────────────────

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}`;
}

/** Turns a stored trip doc into the TripConfig every page already reads. */
export function tripConfigFromDoc(id: string, trip: TripDoc): TripConfig {
  const group = GROUP_KINDS[trip.groupKind] ?? GROUP_KINDS.other;
  const ai = trip.ai;
  const aiTitle = `${ai.emoji} ${ai.name}`;
  const groupName = trip.groupName || "החבורה";
  const place = trip.destination.label;
  return {
    key: "custom",
    id,
    path: `trips/${id}`,
    prefix: `/t/${id}`,
    legacy: false,
    name: trip.name,
    shortName: place,
    kicker: place.toUpperCase(),
    tagline: `${trip.emoji} ${trip.name}`,
    groupLine: `${groupName} · ${place}`,
    signature: `${trip.emoji} ${trip.name} · ${groupName}`,
    emoji: trip.emoji,
    flag: trip.emoji,
    dayLabelSuffix: `${place} ${trip.emoji}`,
    heroTitle: `${place} מחכה לנו ${trip.emoji}`,
    heroImage: trip.coverImage,
    heroArt: { big: "", icon: trip.emoji },
    countdownTarget:
      trip.departureAt || `${trip.startDate}T08:00:00`,
    departureNote:
      trip.departureNote ||
      `✈️ יוצאים · ${shortDate(trip.startDate)} – ${shortDate(trip.endDate)}`,
    startDate: trip.startDate,
    endDate: trip.endDate,
    timezone: trip.timezone || "UTC",
    currency: trip.currency || "EUR",
    mapCenter: { lat: trip.destination.lat, lng: trip.destination.lng },
    searchRegionHint: trip.destination.region || place,
    homeBase: trip.homeBase
      ? {
          navAria: `נווט הביתה — ${trip.homeBase.name}`,
          name: trip.homeBase.name,
          address: trip.homeBase.address,
          lat: trip.homeBase.lat,
          lng: trip.homeBase.lng,
        }
      : null,
    pushTitle: `${trip.name} ${trip.emoji}`,
    tourKey: "trip-tour-seen-v1",
    aiName: ai.name,
    ai: {
      navLabel: ai.name,
      title: aiTitle,
      kicker: groupName,
      emoji: ai.emoji,
      heroBlurb: `${ai.name} לשירותכם — המלצות, שיבוצים בלוח, סקרים ועדכון מקומות. מחובר לכל נתוני הטיול`,
      subtitle: "מכיר את המקומות, הלו״ז ואת כל החבורה",
      quickAddLabel: `שאלו את ${ai.name} ${ai.emoji}`,
      moreEmoji: ai.emoji,
      moreLabel: ai.name,
      suggestedPrompts: [
        "תמליץ לנו על אטרקציה",
        "מה כדאי לעשות מחר?",
        "תמצא מסעדה טובה לידנו",
        "תכנן לנו יום מושלם",
        "תמצא Plan B אם יורד גשם",
        "מה עוד לא שובץ בלוח?",
      ],
      aboutTitle: `${ai.emoji} ספרו ל${ai.name.replace(/^ה/, "")} עלינו`,
      aboutDescription: `כל מה שתכתבו כאן נכנס לידע של ${ai.name}: מי זה מי, גילאים, מה כל אחד אוהב, בדיחות פנימיות — והוא ישתמש בזה בשיחות ובהמלצות`,
      aboutPlaceholder: "למשל: נועה בת 9 ואוהבת חיות. דני משוגע על אוכל רחוב...",
      aboutSaved: `✓ נשמר — ${ai.name} כבר מכיר את זה`,
      inputPlaceholder: "שאלו אותי כל דבר על הטיול…",
    },
    group: {
      unitLabel: group.unitLabel,
      pageTitle: group.pageTitle,
      summarySuffix: ` · ${groupName}`,
      moreLabel: group.unitLabel === "אנחנו" ? "אנחנו" : group.unitLabel,
      moreDescription: groupName,
      groupEmoji: group.emoji,
      splitEveryoneLabel: `כולם השתתפו (כל ה${group.unitLabel})`,
      splitPickLabel: "בחרו מי השתתף",
      loadingLabel: "טוען…",
      quickLoginTitle: "🧒 כניסה מהירה",
      quickLoginHint: "בקשו מההורים לסרוק את קוד ההזמנה",
      pickUnitPrompt: `מאיזו ${group.unitSingular} אתם?`,
      pickNamePrompt: "ועכשיו — מי אתם? 👋",
    },
  };
}

/** Random, URL-safe, unguessable id (no ambiguous chars). */
export function randomId(length: number): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

export function tripPhase(
  trip: { startDate: string; endDate: string },
  today: string
): "upcoming" | "live" | "past" {
  if (today < trip.startDate) return "upcoming";
  if (today > trip.endDate) return "past";
  return "live";
}
