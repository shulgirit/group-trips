import { samePlaceName } from "@together/shared/place-name";
import { stopForDay } from "@together/shared/trip-doc";
import { PLACE_CATEGORIES } from "@together/shared/types";
import type OpenAI from "openai";
import { z } from "zod";
import { geocodePlace } from "./import-place";
import { extractReply } from "./stream";

/**
 * The trip guide's chat engine, independent of storage: the caller supplies
 * the trip context and executes tool side effects. Prompts, tools and the
 * tool loop are the same as the Firebase version (api/ai/chat).
 */

const CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as [string, ...string[]];

// ── response ──────────────────────────────────────────────────────────

const CandidateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(CATEGORY_KEYS),
  area: z.string().optional(),
  description: z.string(),
  why: z.string(),
  address: z.string().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  priceNotes: z.string().optional(),
  website: z.string().optional(),
});

export const AiResponseSchema = z.object({ reply: z.string(), candidates: z.array(CandidateSchema) });
export type AiResponse = z.infer<typeof AiResponseSchema>;

const JSON_SCHEMA = {
  name: "trip_ai_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: { type: "string", description: "תשובה שיחתית קצרה, בשפה שבה המשתמש כותב" },
      candidates: {
        type: "array",
        description: "מקומות מומלצים קונקרטיים. ריק אם השאלה לא מבקשת המלצות על מקומות.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: CATEGORY_KEYS },
            area: { type: "string" },
            description: { type: "string" },
            why: { type: "string" },
            address: { type: "string" },
            lat: { type: ["number", "null"] },
            lng: { type: ["number", "null"] },
            priceNotes: { type: "string" },
            website: { type: "string" },
          },
          required: ["name", "category", "area", "description", "why", "address", "lat", "lng", "priceNotes", "website"],
        },
      },
    },
    required: ["reply", "candidates"],
  },
} as const;

// ── tools ─────────────────────────────────────────────────────────────

export function buildTools(range: { startDate: string; endDate: string }): OpenAI.Chat.ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "add_place",
        description:
          "יצירת מקום חדש במאגר המשותף מתוך כתובת, שם חופשי או קישור — בלי שהמשתמש ימלא טפסים. המערכת מוצאת אוטומטית מיקום, תמונה ודירוג. אחרי היצירה אפשר לשרשר create_event כדי לשבץ אותו בלוח.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "כתובת או תיאור חופשי, למשל: 'parking Piazza Ungheria Palermo'" },
            url: { type: "string", description: "קישור לאתר/דף של המקום (אם המשתמש נתן קישור)" },
            name: { type: "string", description: "שם ידידותי למקום בשפה שבה המשתמש כותב, למשל: 'חניון פיאצה אונגריה'" },
            category: { type: "string", enum: CATEGORY_KEYS },
            region: {
              type: "string",
              description: "באיזה יעד במסלול לחפש (שם לועזי, למשל 'Lyon' או 'Provence'). ברירת מחדל: היעד הנוכחי",
            },
          },
          required: ["name", "category"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_event",
        description:
          "הוספת אירוע ללוח הטיול המשותף של הקבוצה. השתמש רק כשהמשתמש מבקש במפורש להוסיף/לשבץ משהו בלוח. האירוע נוצר מיד וכולם רואים אותו (אפשר לערוך ידנית אחר כך).",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "שם הפעילות, בשפה שבה המשתמש כותב" },
            emoji: {
              type: "string",
              description: "מפתח אייקון אחד: plane, hotel, car, ticket, dining, pin, luggage, sun, waves, mountain, city, wine, castle",
            },
            day: { type: "string", description: `תאריך YYYY-MM-DD בטווח הטיול (${range.startDate} עד ${range.endDate})` },
            startTime: { type: "string", description: "שעה HH:mm (24h)" },
            durationMin: { type: "number", description: "משך בדקות (אופציונלי)" },
            placeName: { type: "string", description: "שם של מקום שמור (מהרשימה בהקשר) כדי לקשר את האירוע אליו — לניווט" },
            participants: {
              type: "array",
              items: { type: "string" },
              description: "שמות משתתפים (חברי משפחה) או שמות משפחות. רשימה ריקה = כל הקבוצה",
            },
            notes: { type: "string" },
          },
          required: ["title", "day", "startTime"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "enrich_place",
        description:
          "עדכון/העשרה של מקום שמור מתוך אתר אינטרנט: קורא את הדף (Firecrawl) ומעדכן תיאור, שעות פתיחה, מחירים, טיפים, ביקורות ותמונה. לוקח עד דקה. השתמש כשמבקשים לעדכן/להעשיר מקום מהאתר שלו.",
        parameters: {
          type: "object",
          properties: {
            placeName: { type: "string", description: "שם המקום השמור לעדכון (מהרשימה בהקשר)" },
            url: { type: "string", description: "כתובת האתר לקריאה. אופציונלי — אם לא סופק, נשתמש באתר השמור של המקום" },
          },
          required: ["placeName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_google_places",
        description:
          "חיפוש חי בגוגל מפות: מקומות אמיתיים עם דירוג, מספר ביקורות, כתובת ואתר. השתמש כשמבקשים 'הכי טובים', לפי ציון, או כשאתה רוצה לוודא דירוגים עדכניים לפני המלצה.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "שאילתת חיפוש כולל אזור, למשל: 'fine dining restaurants Castellammare del Golfo'" },
            minRating: { type: "number", description: "סינון לדירוג מינימלי, למשל 4.5" },
            region: {
              type: "string",
              description: "באיזה יעד במסלול לחפש (שם לועזי, למשל 'Lyon' או 'Provence'). ברירת מחדל: היעד הנוכחי",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_poll",
        description:
          "יצירת סקר חדש ונפרד עם שאלה משלו ואפשרויות. השתמש כשמבקשים סקר על שאלה ספציפית (״תעשה סקר מה עושים מחר״, ״תשלח סקר לכולם על...״). אל תשתמש ב-add_poll_option במקרה כזה.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string", description: "שאלת הסקר, בשפה שבה המשתמש כותב" },
            options: {
              type: "array",
              description: "2-6 אפשרויות",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  placeName: { type: "string", description: "שם מקום שמור לקישור (אם קיים ברשימה)" },
                },
                required: ["label"],
              },
            },
          },
          required: ["question", "options"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_poll_option",
        description:
          "הוספת רעיון בודד לסקר הרעיונות הפתוח הקבוע של הקבוצה. רק כשמבקשים במפורש להוסיף לסקר הרעיונות — לשאלה חדשה עם אפשרויות השתמש ב-create_poll.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "שם האפשרות" },
            placeName: { type: "string", description: "שם מקום שמור לקישור (אם קיים ברשימה)" },
          },
          required: ["label"],
        },
      },
    },
    ...EDIT_TOOLS(range),
  ];
}

const REF = { type: "string", description: "The ref shown in brackets in the schedule list, e.g. e12" } as const;
const DAY = (what: string) => ({ type: "string", description: `${what} (YYYY-MM-DD)` }) as const;
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): OpenAI.Chat.ChatCompletionTool => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

/** Everything a person can do by hand in the app, plus re-planning a day. Names are resolved against the context lists. */
function EDIT_TOOLS(range: { startDate: string; endDate: string }): OpenAI.Chat.ChatCompletionTool[] {
  const inRange = `within the trip (${range.startDate} to ${range.endDate})`;
  return [
    fn(
      "update_event",
      "Change an existing schedule item: move it to another day or time, rename it, change its length, notes, icon, linked place or who is coming. Only pass the fields that change. Use this instead of deleting and re-creating.",
      {
        ref: REF,
        title: { type: "string" },
        emoji: { type: "string" },
        day: DAY(`New day ${inRange}`),
        startTime: { type: "string", description: "HH:mm (24h)" },
        durationMin: { type: "number" },
        placeName: { type: "string", description: "A saved place to link (from the places list)" },
        participants: { type: "array", items: { type: "string" }, description: "Names or families; empty list = everyone" },
        notes: { type: "string" },
      },
      ["ref"]
    ),
    fn("delete_event", "Remove one or more schedule items. Only when the user asks to remove/cancel them.", { refs: { type: "array", items: REF, description: "One or more refs" } }, ["refs"]),
    fn("clear_day", "Remove every item of a day (not bookings unless includeBookings is true).", { day: DAY(`The day ${inRange}`), includeBookings: { type: "boolean" } }, ["day"]),
    fn(
      "shift_days",
      "Move all items from one day (or a range of days) later or earlier by a number of days, e.g. 'push everything after Wednesday one day later'.",
      { fromDay: DAY("First day to move"), toDay: DAY("Last day to move (default: the end of the trip)"), byDays: { type: "number", description: "Positive = later, negative = earlier" } },
      ["fromDay", "byDays"]
    ),
    fn("swap_days", "Swap everything planned on two days of the same city/stop (not across different cities).", { dayA: DAY("First day"), dayB: DAY("Second day") }, ["dayA", "dayB"]),
    fn(
      "replan_day",
      "Re-plan one day from scratch with new real places, following the user's wish (more kid friendly, slower, food focused, rainy-day...). Replaces the day's items except booked tickets, flights and hotels.",
      { day: DAY(`The day to redo ${inRange}`), instruction: { type: "string", description: "What the user wants this day to be like" } },
      ["day", "instruction"]
    ),
    fn(
      "change_trip_dates",
      "Change the trip's dates. startDate moves the whole trip (every item keeps its place in the sequence); endDate only makes the trip longer or shorter. Organizers only.",
      { startDate: DAY("New first day"), endDate: DAY("New last day") }
    ),
    fn(
      "update_place",
      "Edit a saved place: rename, change category, address, notes/tips, opening hours, prices, website or mark it a favorite.",
      {
        placeName: { type: "string", description: "The saved place to edit" },
        name: { type: "string" },
        category: { type: "string", enum: CATEGORY_KEYS },
        address: { type: "string" },
        tips: { type: "string" },
        summary: { type: "string" },
        openingHours: { type: "string" },
        priceNotes: { type: "string" },
        website: { type: "string" },
        favorite: { type: "boolean" },
      },
      ["placeName"]
    ),
    fn("delete_place", "Delete a saved place (its schedule items stay but lose the link). Only when asked.", { placeName: { type: "string" } }, ["placeName"]),
    fn("set_home_base", "Make a saved place the trip's home base (where the group sleeps).", { placeName: { type: "string" } }, ["placeName"]),
    fn("vote_poll", "Cast the speaker's own vote in a poll.", { question: { type: "string", description: "The poll (words from its question)" }, option: { type: "string", description: "The option to vote for" } }, ["question", "option"]),
    fn("close_poll", "Close (or reopen) a poll.", { question: { type: "string" }, closed: { type: "boolean", description: "Default true" } }, ["question"]),
    fn("delete_poll", "Delete a poll and its votes. Only when asked.", { question: { type: "string" } }, ["question"]),
    fn(
      "add_expense",
      "Record a shared expense. The payer is a family/unit from the roster; split among everyone unless specific families are named.",
      {
        description: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string", description: "ISO code, e.g. EUR. Default: the trip's main currency" },
        payer: { type: "string", description: "Family/unit name from the roster (default: the speaker's)" },
        splitBetween: { type: "array", items: { type: "string" }, description: "Family names; empty = everyone" },
        date: DAY("Expense date (default today)"),
      },
      ["description", "amount"]
    ),
    fn("delete_expense", "Delete a recorded expense (ref from the expenses list).", { ref: { type: "string", description: "Expense ref, e.g. x3" } }, ["ref"]),
  ];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const ToolArgs = {
  add_place: z.object({
    query: z.string().optional(),
    url: z.string().optional(),
    name: z.string().min(1),
    category: z.enum(CATEGORY_KEYS),
    region: z.string().max(80).optional(),
  }),
  search_google_places: z.object({ query: z.string().min(2), minRating: z.number().optional(), region: z.string().max(80).optional() }),
  create_event: z.object({
    title: z.string().min(1),
    emoji: z.string().optional(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
    durationMin: z.number().positive().optional(),
    placeName: z.string().optional(),
    participants: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
  enrich_place: z.object({ placeName: z.string().min(1), url: z.string().optional() }),
  create_poll: z.object({
    question: z.string().min(1),
    options: z.array(z.object({ label: z.string().min(1), placeName: z.string().optional() })).min(2).max(6),
  }),
  add_poll_option: z.object({ label: z.string().min(1), placeName: z.string().optional() }),
  update_event: z.object({
    ref: z.string().min(1),
    title: z.string().min(1).optional(),
    emoji: z.string().optional(),
    day: z.string().regex(ISO).optional(),
    startTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
    durationMin: z.number().positive().optional(),
    placeName: z.string().optional(),
    participants: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
  delete_event: z.object({ refs: z.array(z.string()).min(1).max(40) }),
  clear_day: z.object({ day: z.string().regex(ISO), includeBookings: z.boolean().optional() }),
  shift_days: z.object({ fromDay: z.string().regex(ISO), toDay: z.string().regex(ISO).optional(), byDays: z.number().int().min(-60).max(60) }),
  swap_days: z.object({ dayA: z.string().regex(ISO), dayB: z.string().regex(ISO) }),
  replan_day: z.object({ day: z.string().regex(ISO), instruction: z.string().min(2).max(600) }),
  change_trip_dates: z.object({ startDate: z.string().regex(ISO).optional(), endDate: z.string().regex(ISO).optional() }),
  update_place: z.object({
    placeName: z.string().min(1),
    name: z.string().min(1).max(120).optional(),
    category: z.enum(CATEGORY_KEYS).optional(),
    address: z.string().max(300).optional(),
    tips: z.string().max(2000).optional(),
    summary: z.string().max(2000).optional(),
    openingHours: z.string().max(500).optional(),
    priceNotes: z.string().max(500).optional(),
    website: z.string().max(500).optional(),
    favorite: z.boolean().optional(),
  }),
  delete_place: z.object({ placeName: z.string().min(1) }),
  set_home_base: z.object({ placeName: z.string().min(1) }),
  vote_poll: z.object({ question: z.string().min(1), option: z.string().min(1) }),
  close_poll: z.object({ question: z.string().min(1), closed: z.boolean().optional() }),
  delete_poll: z.object({ question: z.string().min(1) }),
  add_expense: z.object({
    description: z.string().min(1).max(120),
    amount: z.number().positive(),
    currency: z.string().length(3).optional(),
    payer: z.string().optional(),
    splitBetween: z.array(z.string()).optional(),
    date: z.string().regex(ISO).optional(),
  }),
  delete_expense: z.object({ ref: z.string().min(1) }),
} as const;

export type ToolName = keyof typeof ToolArgs;
export type ToolInput<N extends ToolName> = z.infer<(typeof ToolArgs)[N]>;

// ── trip context ──────────────────────────────────────────────────────

export interface ChatPlace {
  id: string;
  name: string;
  category: string;
  area?: string;
}

export interface ChatFamily {
  id: string;
  name: string;
  members: { key: string; name: string }[];
}

export interface ChatContextInput {
  timezone: string;
  startDate: string;
  endDate: string;
  stops: { label: string; region: string; startDate: string; endDate: string }[];
  homeBase: { name: string; address: string } | null;
  /** "הוילה" for the original Sicily trip, "מקום הלינה" otherwise */
  homeBaseLabel: string;
  /** Heading for the roster: "המשפחות:" / "החברים:" / "<unit>:" */
  rosterLabel: string;
  aboutUs: string;
  families: ChatFamily[];
  places: ChatPlace[];
  events: { ref: string; day: string; startTime: string; title: string; place?: string; booked?: boolean }[];
  expenses?: { ref: string; description: string; amount: number; currency: string; payer: string; date: string }[];
  polls: { question: string; closed: boolean; options: { label: string; votes: number }[] }[];
}

export function tripNow(timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const todayIso = `${parts.year}-${parts.month}-${parts.day}`;
  const tomorrow = new Date(`${todayIso}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { iso: `${todayIso} ${parts.hour}:${parts.minute}`, todayIso, tomorrowIso: tomorrow.toISOString().slice(0, 10) };
}

export function buildContext(input: ChatContextInput, now = new Date()): string {
  const clock = tripNow(input.timezone, now);
  const events = [...input.events]
    .sort((a, b) => (a.day === b.day ? a.startTime.localeCompare(b.startTime) : a.day.localeCompare(b.day)))
    .map((e) => `- [${e.ref}] ${e.day} ${e.startTime}: ${e.title}${e.place ? ` @ ${e.place}` : ""}${e.booked ? " (booked)" : ""}`);
  const polls = input.polls.map((p) => {
    const options = p.options.map((o) => `${o.label} (${o.votes} קולות)`).join(", ");
    return `- ${p.question}${p.closed ? " [סגור]" : ""}: ${options || "(בלי אפשרויות עדיין)"}`;
  });
  return [
    `עכשיו ב${stopForDay(input.stops, clock.todayIso).label}: ${clock.iso}. היום = ${clock.todayIso}, מחר = ${clock.tomorrowIso}.`,
    ...(input.stops.length > 1
      ? [`מסלול: ${input.stops.map((s) => `${s.label} (${s.region}) ${s.startDate}–${s.endDate}`).join(" ← ")}.`]
      : []),
    `תאריכי הטיול: ${input.startDate} עד ${input.endDate}.${input.homeBase ? ` ${input.homeBaseLabel}: ${input.homeBase.name}, ${input.homeBase.address}.` : ""}`,
    ``,
    ...(input.aboutUs.trim() ? [`על החבורה (נכתב על ידי המשפחות):`, input.aboutUs.trim(), ``] : []),
    input.rosterLabel,
    ...input.families.map((f) => `- ${f.name}: ${f.members.map((m) => m.name).join(", ")}`),
    ``,
    `מקומות שמורים (${input.places.length}):`,
    ...input.places.map((p) => `- ${p.name} (${p.category}${p.area ? `, ${p.area}` : ""})`),
    ``,
    `הלו״ז:`,
    ...(events.length ? events : ["(ריק)"]),
    ``,
    `סקרים:`,
    ...(polls.length ? polls : ["(אין)"]),
    ...(input.expenses?.length
      ? [``, `הוצאות:`, ...input.expenses.map((x) => `- [${x.ref}] ${x.date} ${x.description}: ${x.amount} ${x.currency} (שילם/ה: ${x.payer})`)]
      : []),
  ].join("\n");
}

// ── name resolution (tool args → saved rows) ──────────────────────────

export function resolvePlace(placeName: string | undefined, places: ChatPlace[]): ChatPlace | null {
  if (!placeName) return null;
  const needle = placeName.trim().toLowerCase();
  return (
    places.find((p) => p.name.toLowerCase() === needle) ??
    places.find((p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())) ??
    null
  );
}

export function findSamePlace(name: string, places: ChatPlace[]): ChatPlace | null {
  return places.find((p) => samePlaceName(p.name, name)) ?? null;
}

export type ResolvedParticipants =
  | { type: "all" }
  | { type: "families"; familyIds: string[] }
  | { type: "members"; memberIds: string[] };

export function resolveParticipants(names: string[] | undefined, families: ChatFamily[]): ResolvedParticipants {
  if (!names?.length) return { type: "all" };
  const familyIds: string[] = [];
  const memberIds: string[] = [];
  for (const raw of names) {
    const name = raw.replace("משפחת", "").trim();
    const family = families.find((f) => f.name.replace("משפחת", "").trim() === name);
    if (family) {
      familyIds.push(family.id);
      continue;
    }
    for (const f of families) {
      const member = f.members.find((m) => m.name === name);
      if (member) memberIds.push(member.key);
    }
  }
  if (memberIds.length) return { type: "members", memberIds };
  if (familyIds.length) return { type: "families", familyIds };
  return { type: "all" };
}

// ── Google Places live search (search_google_places tool) ─────────────

export async function searchRatedPlaces(query: string, region: string, minRating?: number) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) return { ok: false as const, error: "search unavailable" };
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.primaryType,places.websiteUri,places.priceLevel",
    },
    body: JSON.stringify({ textQuery: `${query} ${region}`, pageSize: 10 }),
  });
  if (!response.ok) return { ok: false as const, error: "search failed" };
  const payload = (await response.json()) as {
    places?: {
      displayName?: { text?: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      types?: string[];
      primaryType?: string;
      websiteUri?: string;
      priceLevel?: string;
    }[];
  };
  const results = (payload.places ?? [])
    .map((p) => ({
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      type: p.primaryType ?? p.types?.[0] ?? "",
      website: p.websiteUri ?? "",
      priceLevel: p.priceLevel ?? "",
    }))
    .filter((p) => p.name && (!minRating || (p.rating ?? 0) >= minRating))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 8);
  return { ok: true as const, results };
}

// ── the loop ──────────────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

type ChatParams = Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "stream">;

/**
 * Same request as a normal completion, read as a stream: assembles the final message (text and
 * tool calls) and reports the partial JSON text as it grows.
 */
async function streamMessage(
  openai: OpenAI,
  params: ChatParams,
  onText: (json: string) => void
): Promise<{ message: OpenAI.Chat.ChatCompletionMessage; usage?: OpenAI.CompletionUsage | null }> {
  const stream = await openai.chat.completions.create({ ...params, stream: true, stream_options: { include_usage: true } });
  let content = "";
  let usage: OpenAI.CompletionUsage | null | undefined;
  const calls: { id: string; name: string; args: string }[] = [];
  for await (const chunk of stream) {
    if (chunk.usage) usage = chunk.usage;
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      content += delta.content;
      onText(content);
    }
    for (const call of delta.tool_calls ?? []) {
      const slot = (calls[call.index] ??= { id: "", name: "", args: "" });
      if (call.id) slot.id = call.id;
      if (call.function?.name) slot.name += call.function.name;
      if (call.function?.arguments) slot.args += call.function.arguments;
    }
  }
  const toolCalls = calls.filter(Boolean).map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.args } }));
  return {
    message: { role: "assistant", content: content || null, refusal: null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
    usage,
  };
}

export type ToolExecutor = (name: string, args: unknown) => Promise<Record<string, unknown>>;

const MAX_ROUNDS = 4;

/** What a reply cost: filled by runChat for the admin latency/cost dashboard. */
export interface ChatStats {
  firstEffort: "none" | "low" | "medium";
  rounds: number;
  llmMs: number;
  toolMs: number;
  tools: string[];
  promptTokens: number;
  completionTokens: number;
}

/** Tools that only read (safe to run side by side); everything else keeps the model's order. */
const READ_ONLY_TOOLS = new Set(["search_google_places"]);

const PLANNING_HINT = /תכנן|מסלול|לו"?ז|לוז|יום\s|\bplan\s+(a|an|my|our|the|this|each|every|\d)|itinerar|\broute\b|\bschedule\b|\bday\s|itinerario|ruta|horario|خطة|مسار|جدول/i;

/**
 * Rounds after the first only call tools or write the answer. Measured on the eval
 * (apps/web/scripts/ai-eval.mjs): "none" cuts the median from ~11 s to ~8 s with the same
 * results on simple requests; planning requests (first round medium) keep "low" so events
 * still get linked to saved places. AI_REASONING_TOOLS ("none" | "low" | "medium") overrides.
 */
function laterEffort(first: "none" | "low" | "medium"): "none" | "low" | "medium" {
  const value = process.env.AI_REASONING_TOOLS;
  if (value === "none" || value === "low" || value === "medium") return value;
  return first === "medium" ? "low" : "none";
}

/**
 * Deep reasoning only where it pays: planning requests, long messages and photos.
 * Everything else answers noticeably faster with low effort. AI_REASONING_FIRST
 * ("low" | "medium") overrides the heuristic.
 */
export function firstRoundEffort(turns: ChatTurn[]): "none" | "low" | "medium" {
  const forced = process.env.AI_REASONING_FIRST;
  if (forced === "none" || forced === "low" || forced === "medium") return forced;
  const last = [...turns].reverse().find((turn) => turn.role === "user");
  if (!last) return "low";
  if (last.imageUrl || last.content.length > 320 || PLANNING_HINT.test(last.content)) return "medium";
  // Short everyday questions ("plan B if it rains?", "what time is dinner?") need no hidden thinking
  return last.content.length <= 140 ? "none" : "low";
}

/**
 * Up to 4 rounds: tool calls are executed and fed back; the final answer
 * is structured JSON. Deep reasoning on the first pass, quick synthesis
 * after tools.
 */
export async function runChat(options: {
  openai: OpenAI;
  system: string;
  context: string;
  speaker?: string;
  turns: ChatTurn[];
  range: { startDate: string; endDate: string };
  execute: ToolExecutor;
  /** Optional: receives timings and token counts for this reply. */
  stats?: ChatStats;
  /** Optional: when set, the model is streamed and the reply text so far is reported as it is written. */
  onReply?: (text: string) => void;
}): Promise<AiResponse> {
  const stats: ChatStats = options.stats ?? { firstEffort: "low", rounds: 0, llmMs: 0, toolMs: 0, tools: [], promptTokens: 0, completionTokens: 0 };
  const firstEffort = firstRoundEffort(options.turns);
  stats.firstEffort = firstEffort;
  const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: options.system },
    { role: "system", content: `הקשר הטיול העדכני:\n${options.context}` },
    ...(options.speaker
      ? [{ role: "system" as const, content: `מי שמדבר/ת איתך בשיחה הזו: ${options.speaker}. פנה אליו/ה בשמו/ה בטבעיות.` }]
      : []),
    ...options.turns.map(
      (turn): OpenAI.Chat.ChatCompletionMessageParam =>
        turn.role === "user" && turn.imageUrl
          ? {
              role: "user",
              content: [
                { type: "text", text: turn.content },
                { type: "image_url", image_url: { url: turn.imageUrl } },
              ],
            }
          : { role: turn.role, content: turn.content }
    ),
  ];
  const tools = buildTools(options.range);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const started = Date.now();
    const params: ChatParams = {
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      reasoning_effort: round === 0 ? firstEffort : laterEffort(firstEffort),
      messages: conversation,
      tools,
      // The last allowed round must answer: summarise what was found/done instead of failing the reply
      ...(round === MAX_ROUNDS - 1 ? { tool_choice: "none" as const } : {}),
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
    };
    let message: OpenAI.Chat.ChatCompletionMessage | undefined;
    let usage: OpenAI.CompletionUsage | null | undefined;
    if (options.onReply) {
      const onReply = options.onReply;
      let shown = "";
      ({ message, usage } = await streamMessage(options.openai, params, (json) => {
        const reply = extractReply(json);
        if (reply.length > shown.length) {
          shown = reply;
          onReply(reply);
        }
      }));
    } else {
      const completion = await options.openai.chat.completions.create(params);
      message = completion.choices[0]?.message;
      usage = completion.usage;
    }
    stats.rounds = round + 1;
    stats.llmMs += Date.now() - started;
    stats.promptTokens += usage?.prompt_tokens ?? 0;
    stats.completionTokens += usage?.completion_tokens ?? 0;
    if (!message) throw new Error("empty_completion");

    if (message.tool_calls?.length) {
      conversation.push(message);
      const calls = message.tool_calls.filter((call) => call.type === "function");
      const runCall = async (call: (typeof calls)[number]): Promise<Record<string, unknown>> => {
        if (call.type !== "function") return { ok: false, error: "unknown_tool" };
        stats.tools.push(call.function.name);
        try {
          return await options.execute(call.function.name, JSON.parse(call.function.arguments || "{}"));
        } catch (error) {
          console.error("[chat] tool failed", call.function.name, error);
          return { ok: false, error: "הפעולה נכשלה" };
        }
      };
      const toolsStarted = Date.now();
      // Read-only lookups run side by side; writes keep the model's order (an event may need the place added just before it)
      const results = new Map<string, Record<string, unknown>>();
      await Promise.all(
        calls
          .filter((call) => call.type === "function" && READ_ONLY_TOOLS.has(call.function.name))
          .map(async (call) => results.set(call.id, await runCall(call)))
      );
      for (const call of calls) {
        if (!results.has(call.id)) results.set(call.id, await runCall(call));
      }
      stats.toolMs += Date.now() - toolsStarted;
      for (const call of calls) {
        conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(results.get(call.id)) });
      }
      continue;
    }
    if (!message.content) throw new Error("empty_completion");
    return parseAnswer(message.content);
  }
  throw new Error("tool_loop_exceeded");
}

/**
 * The model's final message as an answer. It occasionally trails the JSON with extra text (or a second object) after a
 * tool-heavy turn; take the first complete object.
 */
export function parseAnswer(content: string): AiResponse {
  const candidates = [content];
  const start = content.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < content.length; i++) {
      const ch = content[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        candidates.push(content.slice(start, i + 1));
        break;
      }
    }
  }
  for (const text of candidates) {
    try {
      const parsed = AiResponseSchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {
      // try the next candidate
    }
  }
  throw new Error("bad_completion");
}

/** Attaches a real Google photo, rating and coordinates to every candidate. */
export async function decorateCandidates(candidates: AiResponse["candidates"], region: string) {
  return Promise.all(
    candidates.map(async (c) => {
      const geo = await geocodePlace(`${c.name} ${c.area ?? ""}`.trim(), region).catch(() => null);
      return {
        name: c.name,
        category: c.category,
        description: c.description,
        why: c.why,
        ...(c.area ? { area: c.area } : {}),
        ...(c.address || geo?.address ? { address: c.address || geo?.address } : {}),
        lat: c.lat ?? geo?.lat ?? null,
        lng: c.lng ?? geo?.lng ?? null,
        ...(c.priceNotes ? { priceNotes: c.priceNotes } : {}),
        ...(c.website && /^https?:\/\//.test(c.website) ? { website: c.website } : {}),
        ...(geo?.photoUrl ? { imageUrl: geo.photoUrl } : {}),
        ...(geo?.rating !== undefined ? { rating: geo.rating } : {}),
        ...(geo?.ratingCount !== undefined ? { ratingCount: geo.ratingCount } : {}),
      };
    })
  );
}
