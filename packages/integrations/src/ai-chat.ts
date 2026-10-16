import { samePlaceName } from "@together/shared/place-name";
import { stopForDay } from "@together/shared/trip-doc";
import { PLACE_CATEGORIES } from "@together/shared/types";
import type OpenAI from "openai";
import { z } from "zod";
import { geocodePlace } from "./import-place";

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
      reply: { type: "string", description: "תשובה שיחתית קצרה בעברית" },
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
            name: { type: "string", description: "שם עברי/ידידותי למקום, למשל: 'חניון פיאצה אונגריה'" },
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
            title: { type: "string", description: "שם הפעילות בעברית" },
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
            question: { type: "string", description: "שאלת הסקר בעברית" },
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
  ];
}

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
  events: { day: string; startTime: string; title: string }[];
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
    .map((e) => `- ${e.day} ${e.startTime}: ${e.title}`);
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

export type ToolExecutor = (name: string, args: unknown) => Promise<Record<string, unknown>>;

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
}): Promise<AiResponse> {
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

  for (let round = 0; round < 4; round++) {
    const completion = await options.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      reasoning_effort: round === 0 ? "medium" : "low",
      messages: conversation,
      tools,
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
    });
    const message = completion.choices[0]?.message;
    if (!message) throw new Error("empty_completion");

    if (message.tool_calls?.length) {
      conversation.push(message);
      for (const call of message.tool_calls) {
        if (call.type !== "function") continue;
        let result: Record<string, unknown>;
        try {
          result = await options.execute(call.function.name, JSON.parse(call.function.arguments || "{}"));
        } catch (error) {
          console.error("[chat] tool failed", call.function.name, error);
          result = { ok: false, error: "הפעולה נכשלה" };
        }
        conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }
    if (!message.content) throw new Error("empty_completion");
    return AiResponseSchema.parse(JSON.parse(message.content));
  }
  throw new Error("tool_loop_exceeded");
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
