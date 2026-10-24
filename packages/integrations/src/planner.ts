import { daysBetween, type DateWindow } from "@together/shared/holidays";
import OpenAI from "openai";
import { z } from "zod";

/**
 * The AI trip planner: free text ("Vietnam in the summer, two couples, we love food") → an outline (route, nights,
 * approximate dates, who is coming) and then the day-by-day items. Two steps keep each model response small and let the
 * days be written in parallel. Storage and place lookups happen in the caller (Convex).
 */

const model = () => process.env.OPENAI_MODEL ?? "gpt-5.1";

export const ITEM_KINDS = ["attraction", "restaurant", "stay", "transport", "activity"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

const GROUP_KINDS = ["families", "friends", "couple", "other"] as const;

/** Model text is trimmed to our limits instead of rejected: a slightly long sentence must not lose a whole plan. */
const text = (max: number, min = 0) => z.string().transform((value) => value.trim().slice(0, max)).pipe(z.string().min(min));

// ── step 1: the outline ───────────────────────────────────────────────

export const OutlineSchema = z.object({
  title: text(60, 1),
  emoji: z.enum(["plane", "sun", "waves", "mountain", "city", "palm", "sail", "wine", "castle", "globe"]),
  summary: text(600),
  stops: z
    .array(
      z.object({
        /** Searchable place name, e.g. "Hanoi" or "Ha Long Bay" */
        label: text(80, 1),
        country: text(60),
        nights: z.number().int().transform((n) => Math.min(21, Math.max(1, n))),
      })
    )
    .min(1)
    .transform((stops) => stops.slice(0, 8)),
  /** ISO dates; the caller replaces them when the text names a holiday/season */
  startDate: z.string(),
  endDate: z.string(),
  datesReason: text(300),
  group: z.object({
    kind: z.enum(GROUP_KINDS).catch("other"),
    adults: z.number().int().transform((n) => Math.min(40, Math.max(1, n))),
    kidAges: z.array(z.number().int()).transform((ages) => ages.slice(0, 20).map((a) => Math.min(17, Math.max(0, a)))),
    name: text(40),
  }),
  tips: z.array(text(240)).transform((tips) => tips.slice(0, 6)),
});
export type Outline = z.infer<typeof OutlineSchema>;

const OUTLINE_JSON = {
  name: "trip_outline",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      emoji: { type: "string", enum: ["plane", "sun", "waves", "mountain", "city", "palm", "sail", "wine", "castle", "globe"] },
      summary: { type: "string" },
      stops: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { label: { type: "string" }, country: { type: "string" }, nights: { type: "integer" } },
          required: ["label", "country", "nights"],
        },
      },
      startDate: { type: "string" },
      endDate: { type: "string" },
      datesReason: { type: "string" },
      group: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: [...GROUP_KINDS] },
          adults: { type: "integer" },
          kidAges: { type: "array", items: { type: "integer" } },
          name: { type: "string" },
        },
        required: ["kind", "adults", "kidAges", "name"],
      },
      tips: { type: "array", items: { type: "string" } },
    },
    required: ["title", "emoji", "summary", "stops", "startDate", "endDate", "datesReason", "group", "tips"],
  },
} as const;

const LANGUAGE: Record<string, string> = { he: "Hebrew", en: "English", ar: "Arabic", es: "Spanish" };

const OUTLINE_SYSTEM = `You are an expert travel planner building a first, tentative plan from a few free-text lines.
Return ONLY the JSON outline.
- Choose a realistic route: stops in a sensible geographic order, no zig-zagging, travel time between stops that fits the number of days. A first-time visitor should not see more than 1 stop per 3 nights.
- If the person gave no length, choose a good one for the destination (usually 7-10 nights; 4-5 for a city break).
- "stops[].label" must be a real searchable place (city, island or region). "nights" are the nights spent there.
- Dates: use the supplied date window when there is one. Otherwise, if the text names ANY holiday, festival, school break or event anywhere in the world (Christmas, Thanksgiving, Diwali, Carnival, Holi, Songkran, Semana Santa, Festa de São João, Golden Week, Oktoberfest, a national day, a sports final...), find its NEXT occurrence after today and center the trip on it, naming it in "datesReason". Seasons ("summer", "winter") mean the season at the DESTINATION, not the traveller's home (summer in Australia is December to February). With no date hint, pick the best time for the destination within the next 12 months and say why (weather, crowds, price). If a date is moveable and you are not sure of it, pick the most likely dates and say they must be checked. Dates are only approximate.
- "group": infer who is coming (adults, kids' ages, kind) from the text. If unknown assume 2 adults, kind "couple".
- "title": a short, catchy trip name. "summary": 2-3 sentences describing the trip's character.
- "tips": up to 5 practical tips (visas or entry rules to check, weather, safety, getting around).
- Never suggest anything illegal or unsafe, and avoid regions with active conflict or serious travel warnings: pick a nearby alternative instead and mention it in "datesReason" or "tips".`;

export interface PlanRequest {
  text: string;
  locale: string;
  /** ISO "today" */
  today: string;
  /** From the deterministic resolver, when the text names a holiday/season/month */
  window: DateWindow | null;
  /** Optional chips from the form */
  hints?: { groupKind?: string; adults?: number; kidAges?: number[]; budget?: string; pace?: string };
}

export async function planOutline(req: PlanRequest): Promise<Outline> {
  const hints = req.hints
    ? Object.entries(req.hints)
        .filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(",") : v}`)
        .join("; ")
    : "";
  const completion = await new OpenAI().chat.completions.create({
    model: model(),
    reasoning_effort: "low",
    messages: [
      { role: "system", content: `${OUTLINE_SYSTEM}\nWrite title, summary, datesReason and tips in ${LANGUAGE[req.locale] ?? "English"}. Keep place labels in their common Latin/English spelling.` },
      {
        role: "user",
        content: `Today is ${req.today}.\n${
          req.window ? `The text mentions "${req.window.label}": use ${req.window.start} to ${req.window.end} as the date window (fit the trip inside it).\n` : ""
        }${hints ? `Form hints: ${hints}\n` : ""}The person wrote:\n"""${req.text.slice(0, 1500)}"""`,
      },
    ],
    response_format: { type: "json_schema", json_schema: OUTLINE_JSON },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("empty_outline");
  const outline = OutlineSchema.parse(JSON.parse(raw));
  return fitDates(outline, req.window);
}

/** Keeps the stops' nights and the date range consistent (the model's arithmetic is not trusted). */
export function fitDates(outline: Outline, window: DateWindow | null): Outline {
  const nights = outline.stops.reduce((sum, stop) => sum + stop.nights, 0);
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  let start = ok.test(outline.startDate) ? outline.startDate : window?.start ?? outline.startDate;
  if (window && (start < window.start || start > window.end)) start = window.start;
  const end = shift(start, nights);
  return { ...outline, startDate: start, endDate: end };
}

function shift(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

// ── step 2: the days ──────────────────────────────────────────────────

export const DayItemSchema = z.object({
  /** "HH:MM" local start */
  time: z.string().regex(/^\d{1,2}:\d{2}$/),
  title: text(100, 1),
  kind: z.enum(ITEM_KINDS).catch("activity"),
  /** What to type into Google Maps to find it, with the city */
  query: z.string().min(2).max(140),
  durationMin: z.number().int().transform((n) => Math.min(600, Math.max(15, n))),
  why: text(240),
});
export type DayItem = z.infer<typeof DayItemSchema>;

export const DaysSchema = z.object({
  days: z.array(
    z.object({
      dayNumber: z.number().int().min(1).max(60),
      stopLabel: z.string(),
      theme: text(80),
      items: z.array(DayItemSchema).min(1).transform((items) => items.slice(0, 7)),
    })
  ),
});
export type PlannedDay = z.infer<typeof DaysSchema>["days"][number];

const DAYS_JSON = {
  name: "trip_days",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      days: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            dayNumber: { type: "integer" },
            stopLabel: { type: "string" },
            theme: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  time: { type: "string" },
                  title: { type: "string" },
                  kind: { type: "string", enum: [...ITEM_KINDS] },
                  query: { type: "string" },
                  durationMin: { type: "integer" },
                  why: { type: "string" },
                },
                required: ["time", "title", "kind", "query", "durationMin", "why"],
              },
            },
          },
          required: ["dayNumber", "stopLabel", "theme", "items"],
        },
      },
    },
    required: ["days"],
  },
} as const;

const DAYS_SYSTEM = `You write the day-by-day part of a tentative trip plan, for the days you are asked for only.
- 3-5 items per day: the main sights/activities, plus lunch and/or dinner at well-known, well-reviewed local places (name the real restaurant when you know one, otherwise a specific dish or market).
- Realistic timing: start 09:00-10:00 unless travelling, leave room for transport and rest, no more than ~8 hours of activities, closing times respected. Leave the first and last day lighter.
- On the first day of each stop (and the first day of the trip) add ONE item of kind "stay" at 15:00 with the lodging area or a suitable, well-reviewed hotel type and name if you know one (query it with the city). Do not repeat the stay on following days.
- A day that changes city includes one "transport" item (flight, train, bus or car) with a realistic duration.
- "query" must be something Google Maps can find: the place name plus the city. "why" is one short sentence.
- Match the group: with young kids avoid long walks and late nights; adults-only groups can have nightlife.
- Never invent places you are unsure exist; prefer fewer, famous ones. Nothing illegal or unsafe.`;

export async function planDays(
  outline: Outline,
  req: Pick<PlanRequest, "text" | "locale">,
  dayNumbers: number[],
  stopForDay: (day: number) => string
): Promise<PlannedDay[]> {
  const completion = await new OpenAI().chat.completions.create({
    model: model(),
    reasoning_effort: "low",
    messages: [
      { role: "system", content: `${DAYS_SYSTEM}\nWrite titles, themes and "why" in ${LANGUAGE[req.locale] ?? "English"}; keep proper names as they are commonly written.` },
      {
        role: "user",
        content: [
          `Trip: ${outline.title}. ${outline.summary}`,
          `Group: ${outline.group.adults} adults${outline.group.kidAges.length ? `, kids aged ${outline.group.kidAges.join(", ")}` : ""} (${outline.group.kind}).`,
          `Route: ${outline.stops.map((s) => `${s.label} (${s.nights} nights)`).join(" → ")}. Trip length: ${daysBetween(outline.startDate, outline.endDate)} days.`,
          `What the person asked: """${req.text.slice(0, 800)}"""`,
          `Write days ${dayNumbers.join(", ")}. Day → stop: ${dayNumbers.map((d) => `${d}: ${stopForDay(d)}`).join("; ")}.`,
        ].join("\n"),
      },
    ],
    response_format: { type: "json_schema", json_schema: DAYS_JSON },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("empty_days");
  return DaysSchema.parse(JSON.parse(raw)).days.filter((day) => dayNumbers.includes(day.dayNumber));
}

/** Which stop a trip day belongs to (day 1 is the first night's morning). */
export function stopForTripDay(outline: Outline, day: number): string {
  let left = day;
  for (const stop of outline.stops) {
    if (left <= stop.nights) return stop.label;
    left -= stop.nights;
  }
  return outline.stops[outline.stops.length - 1].label;
}

/** Whole plan: outline, then the days in parallel chunks of four. */
export async function generatePlan(req: PlanRequest, onProgress?: (phase: "outline" | "days", detail?: string) => Promise<void> | void) {
  await onProgress?.("outline");
  const outline = await planOutline(req);
  const total = daysBetween(outline.startDate, outline.endDate);
  await onProgress?.("days", `0/${total}`);
  const numbers = Array.from({ length: total }, (_, i) => i + 1);
  const chunks: number[][] = [];
  for (let i = 0; i < numbers.length; i += 4) chunks.push(numbers.slice(i, i + 4));
  const parts = await Promise.all(chunks.map((chunk) => planDays(outline, req, chunk, (d) => stopForTripDay(outline, d))));
  const days = parts.flat().sort((a, b) => a.dayNumber - b.dayNumber);
  return { outline, days };
}
