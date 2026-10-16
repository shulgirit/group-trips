/**
 * Self-serve trips: the Firestore trip doc IS the configuration.
 * Pure data + builders — importable from client and server.
 *
 * Legacy trips (sicily/sardinia) keep their hand-written TripConfig in
 * trips.ts; every trip created through /new is described by a TripDoc
 * and turned into the same TripConfig shape by tripConfigFromDoc(), so
 * the existing pages render it unchanged.
 */

import { avatarSrc } from "@/lib/avatars";
import type { TripConfig } from "@/lib/trips";
import { activeLocale } from "@/i18n/active";
import type { Locale } from "@/i18n/config";
import { translate } from "@/i18n/translate";

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

/** One leg of a (possibly multi-country) trip. */
export interface TripStop {
  id: string;
  label: string;
  placeId?: string;
  lat: number;
  lng: number;
  region: string;
  country?: string;
  timezone: string;
  /** ISO 4217 local currency */
  currency: string;
  coverImage: string | null;
  startDate: string;
  endDate: string;
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
  /** "bot:<id>" or an uploaded image URL — see src/lib/avatars.ts */
  avatar?: string | null;
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
  /** First stop — kept for every single-destination reader */
  destination: TripDestination;
  /** Ordered itinerary; absent on trips created before multi-stop */
  stops?: TripStop[];
  startDate: string;
  endDate: string;
  /** IANA zone of the destination, e.g. "Europe/Rome" */
  timezone: string;
  /** ISO 4217 — the first stop's currency */
  currency: string;
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
  /** Joined without an account (anonymous identity on one device) */
  guest?: boolean;
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
    emoji: "butler",
    sample: "לשירותכם! הזמנתי לכם שולחן מול השקיעה — רק תגידו מתי",
    persona:
      "דבר כמו משרת אישי מנומס ושנון — אדיב, מסור, עם הומור עדין. אתה דואג לכל פרט.",
  },
  pilot: {
    label: "טייס / נווט",
    name: "הטייס",
    emoji: "pilot",
    sample: "כאן הקברניט. מזג אוויר מצוין, היעד הבא — חוף שווה במיוחד",
    persona:
      "דבר כמו נווט ותיק בקבינה — ישיר, חברי, עם קריצה. הומור יבש מותר.",
  },
  buddy: {
    label: "חבר מהחבורה",
    name: "החבר",
    emoji: "buddy",
    sample: "אחי, יש פה מקום גלידה שאתם חייבים לנסות היום",
    persona:
      "דבר כמו חבר טוב מהחבורה — קליל, מצחיק, בגובה העיניים, בלי רשמיות.",
  },
  guide: {
    label: "מדריך מקומי",
    name: "המדריך",
    emoji: "guide",
    sample: "בבוקר מגיעים לפני 9 — ככה נמנעים מהתורים ומהחום",
    persona:
      "דבר כמו מדריך טיולים מקומי ומנוסה — מדויק, בקיא בהיסטוריה ובטיפים מעשיים, חם ומקצועי.",
  },
};

export const AI_RULES: { id: string; label: string; rule: string }[] = [
  {
    id: "kids",
    label: "מתאים לילדים",
    rule: "יש ילדים בטיול — העדף פעילויות ומסעדות ידידותיות לילדים וציין התאמה לגילאים.",
  },
  {
    id: "adults",
    label: "מבוגרים בלבד",
    rule: "אין ילדים בטיול — אל תציע פעילויות ילדים. העדף נופים, אוכל טוב ויין.",
  },
  {
    id: "accessible",
    label: "נגישות",
    rule: "חלק מהמטיילים זקוקים לנגישות — ציין נגישות, מדרגות, חניה קרובה ומרחקי הליכה.",
  },
  {
    id: "hearing",
    label: "רגישות שמיעה",
    rule: "חלק מהמטיילים לקויי שמיעה / עם שתלים — העדף חוויות ויזואליות, שים לב לרעש, ובפעילויות מים הזכר הגנה על המעבדים. בטבעיות ורק כשזה רלוונטי.",
  },
  {
    id: "kosher",
    label: "כשרות",
    rule: "חלק מהחבורה שומרים כשרות — כשאפשר ציין אפשרויות כשרות או צמחוניות/דגים.",
  },
  {
    id: "veggie",
    label: "צמחוני/טבעוני",
    rule: "יש צמחונים/טבעונים בחבורה — ודא שיש להם מה לאכול בכל המלצה.",
  },
  {
    id: "budget",
    label: "חסכוני",
    rule: "החבורה מעדיפה תקציב שפוי — ציין טווחי מחירים והעדף תמורה טובה לכסף.",
  },
  {
    id: "short",
    label: "תשובות קצרות",
    rule: "תשובות קצרות מאוד ולעניין — שורה או שתיים.",
  },
  {
    id: "nature",
    label: "טבע ומסלולים",
    rule: "החבורה אוהבת טבע — הצע מסלולים, תצפיות וחופים פחות מוכרים.",
  },
];

/** A trip's itinerary — stored stops, or the single destination. */
export function stopsOf(trip: TripDoc): TripStop[] {
  if (trip.stops?.length) return trip.stops;
  return [
    {
      id: "main",
      label: trip.destination.label,
      placeId: trip.destination.placeId,
      lat: trip.destination.lat,
      lng: trip.destination.lng,
      region: trip.destination.region,
      country: trip.destination.country,
      timezone: trip.timezone,
      currency: trip.currency,
      coverImage: trip.coverImage,
      startDate: trip.startDate,
      endDate: trip.endDate,
    },
  ];
}

/** The stop covering a day; before/after the trip → first/last stop. */
export function stopForDay<T extends { startDate: string; endDate: string }>(
  stops: T[],
  dayIso: string
): T {
  // On a shared transit day the later stop wins (you sleep there)
  const covering = stops.filter((s) => s.startDate <= dayIso && dayIso <= s.endDate);
  if (covering.length) return covering[covering.length - 1];
  if (dayIso < stops[0].startDate) return stops[0];
  const past = stops.filter((s) => s.endDate < dayIso);
  return past[past.length - 1] ?? stops[stops.length - 1];
}

/** Regional-indicator flag from "IT" (data only — never rendered in UI chrome). */
export function flagEmoji(country: string | undefined): string {
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return "";
  return String.fromCodePoint(
    ...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** "Italy · France" or "Italy +2" */
export function itineraryName(stops: { label: string }[]): string {
  const labels = stops.map((s) => s.label).filter((label, i, all) => all.indexOf(label) === i);
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels[0]} +${labels.length - 1}`;
}

function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** The persona paragraph for a trip (shared rules are appended server-side). */
export function composePersona(trip: TripDoc): string {
  const ai = trip.ai;
  if (ai.customPrompt?.trim()) return ai.customPrompt.trim();
  const preset =
    ai.preset !== "custom" ? AI_PRESETS[ai.preset] : null;
  const group = GROUP_KINDS[trip.groupKind];
  const stops = stopsOf(trip);
  const where = itineraryName(stops);
  const lines = [
    `אתה ״${ai.name}״ — העוזר האישי של ${trip.groupName || "החבורה"}: ${group.aiDescription} בטיול ל${where} (${trip.startDate} עד ${trip.endDate}).`,
    ...(stops.length > 1
      ? [
          "",
          "מסלול הטיול (לפי הסדר):",
          ...stops.map(
            (s, i) => `${i + 1}. ${s.label}${s.region && s.region !== s.label ? ` (${s.region})` : ""}: ${s.startDate} עד ${s.endDate}, מטבע ${s.currency}`
          ),
          "בכל המלצה התאם ליעד של אותו יום. בחיפוש מקומות ציין region של היעד הרלוונטי.",
        ]
      : []),
    "",
    "סגנון והתאמה לקבוצה:",
    `- ${preset?.persona ?? "דבר בטון חם, אישי ושנון."}`,
    `- התמחה ב${where}: אטרקציות, אוכל, נופים, טיפים מקומיים ולוגיסטיקה.`,
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
    emoji: "users",
    unitLabel: "משפחות",
    unitSingular: "משפחה",
    pageTitle: "המשפחות",
    aiDescription: "כמה משפחות שמטיילות יחד",
  },
  friends: {
    label: "חברים",
    emoji: "wine",
    unitLabel: "חברים",
    unitSingular: "חבר/ה",
    pageTitle: "החבורה",
    aiDescription: "חבורת חברים שמטיילים יחד",
  },
  couple: {
    label: "זוג",
    emoji: "heart",
    unitLabel: "אנחנו",
    unitSingular: "בן/בת זוג",
    pageTitle: "אנחנו",
    aiDescription: "זוג שמטייל יחד",
  },
  other: {
    label: "קבוצה",
    emoji: "luggage",
    unitLabel: "קבוצות",
    unitSingular: "קבוצה",
    pageTitle: "הקבוצה",
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

/**
 * Turns a stored trip doc into the TripConfig every page already reads.
 * UI copy follows `locale` (defaults to the active UI language); the
 * organizer's own text (names, notes) is passed through untouched.
 */
export function tripConfigFromDoc(
  id: string,
  trip: TripDoc,
  locale: Locale = activeLocale()
): TripConfig {
  const kind = GROUP_KINDS[trip.groupKind] ? trip.groupKind : "other";
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string>) =>
    translate(locale, key, vars);
  const ai = trip.ai;
  const groupName = trip.groupName || t("config.groupFallback");
  const stops = stopsOf(trip);
  const current = stopForDay(stops, localToday());
  const place = itineraryName(stops);
  const unitLabel = t(`config.kinds.${kind}.unitLabel`);
  // Hebrew prefixes "to" onto the name and drops its definite article (he-)
  const bareName = locale === "he" ? ai.name.replace(/^\u05D4/, "") : ai.name;
  return {
    key: "custom",
    id,
    path: `trips/${id}`,
    prefix: `/t/${id}`,
    legacy: false,
    name: trip.name,
    shortName: place,
    kicker: place.toUpperCase(),
    tagline: trip.name,
    groupLine: `${groupName} · ${place}`,
    signature: t("config.signature", { trip: trip.name, group: groupName }),
    emoji: trip.emoji,
    flag: "",
    dayLabelSuffix: current.label,
    heroTitle: t("config.heroTitle", { place }),
    heroImage: trip.coverImage,
    heroArt: null,
    countdownTarget:
      trip.departureAt || `${trip.startDate}T08:00:00`,
    departureNote:
      trip.departureNote ||
      t("config.departureNote", {
        start: shortDate(trip.startDate),
        end: shortDate(trip.endDate),
      }),
    startDate: trip.startDate,
    endDate: trip.endDate,
    timezone: current.timezone || trip.timezone || "UTC",
    currency: current.currency || trip.currency || "EUR",
    mapCenter: {
      lat: stops.reduce((sum, s) => sum + s.lat, 0) / stops.length,
      lng: stops.reduce((sum, s) => sum + s.lng, 0) / stops.length,
    },
    searchRegionHint: current.region || current.label,
    stops: stops.map((s) => ({
      label: s.label,
      region: s.region || s.label,
      timezone: s.timezone,
      currency: s.currency,
      startDate: s.startDate,
      endDate: s.endDate,
      lat: s.lat,
      lng: s.lng,
      flag: flagEmoji(s.country),
    })),
    homeBase: trip.homeBase
      ? {
          navAria: t("config.navHome", { name: trip.homeBase.name }),
          name: trip.homeBase.name,
          address: trip.homeBase.address,
          lat: trip.homeBase.lat,
          lng: trip.homeBase.lng,
        }
      : null,
    pushTitle: trip.name,
    tourKey: "trip-tour-seen-v1",
    aiName: ai.name,
    ai: {
      navLabel: ai.name,
      title: ai.name,
      kicker: groupName,
      emoji: ai.emoji,
      avatar: avatarSrc(ai.avatar),
      heroBlurb: t("config.ai.heroBlurb", { name: ai.name }),
      subtitle: t("config.ai.subtitle"),
      quickAddLabel: t("config.ai.quickAdd", { name: ai.name }),
      moreEmoji: ai.emoji,
      moreLabel: ai.name,
      suggestedPrompts: (["a", "b", "c", "d", "e", "f"] as const).map((k) =>
        t(`config.ai.prompts.${k}`)
      ),
      aboutTitle: t("config.ai.aboutTitle", { name: ai.name, bare: bareName }),
      aboutDescription: t("config.ai.aboutDescription", { name: ai.name }),
      aboutPlaceholder: t("config.ai.aboutPlaceholder"),
      aboutSaved: t("config.ai.aboutSaved", { name: ai.name }),
      inputPlaceholder: t("config.ai.inputPlaceholder"),
    },
    group: {
      unitLabel,
      pageTitle: t(`config.kinds.${kind}.pageTitle`),
      summarySuffix: t("config.summarySuffix", { group: groupName }),
      moreLabel: unitLabel,
      moreDescription: groupName,
      groupEmoji: GROUP_KINDS[kind].emoji,
      splitEveryoneLabel: t(`config.kinds.${kind}.splitEveryone`),
      splitPickLabel: t("config.group.splitPick"),
      loadingLabel: t("config.group.loading"),
      quickLoginTitle: t("config.group.quickLoginTitle"),
      quickLoginHint: t("config.group.quickLoginHint"),
      pickUnitPrompt: t(`config.kinds.${kind}.pickUnit`),
      pickNamePrompt: t("config.group.pickName"),
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
