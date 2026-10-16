import { composePersona, type TripShape } from "@together/shared/trip-doc";
import OpenAI from "openai";

/**
 * Small AI helpers (trip creator ideas, guide preview, trip summary, place
 * briefing). Prompts are the Firebase versions (api/ai/trip-assist and
 * api/ai/place-info).
 */

const model = () => process.env.OPENAI_MODEL ?? "gpt-5.1";
const inLanguage = (english: boolean) => (english ? "Write in English. No emoji." : "כתוב בעברית. בלי אימוג׳י.");

export interface TripDraft {
  destination: string;
  startDate: string;
  endDate: string;
  groupKind: "families" | "friends" | "couple" | "other";
  groupName: string;
  aboutUs?: string;
}

export async function suggestTripNames(draft: TripDraft, english: boolean): Promise<{ name: string; emoji: string }[]> {
  const completion = await new OpenAI().chat.completions.create({
    model: model(),
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: english
          ? "You are a sharp copywriter. Suggest 4 short (2-4 words), catchy names in English for a group trip. For `emoji` return one of: plane, sun, waves, mountain, city, palm, sail, wine, castle, globe. No quotes."
          : "אתה קופירייטר ישראלי שנון. הצע 4 שמות קצרים (2-4 מילים) וקליטים בעברית לטיול קבוצתי. בשדה emoji החזר אחד מ: plane, sun, waves, mountain, city, palm, sail, wine, castle, globe. בלי מרכאות.",
      },
      {
        role: "user",
        content: `יעד: ${draft.destination}. תאריכים: ${draft.startDate} עד ${draft.endDate}. קבוצה: ${draft.groupName || draft.groupKind}.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "names",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["names"],
          properties: {
            names: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "emoji"],
                properties: { name: { type: "string" }, emoji: { type: "string" } },
              },
            },
          },
        },
      },
    },
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{"names":[]}') as { names?: { name: string; emoji: string }[] };
  return parsed.names ?? [];
}

/** How the guide would answer, before the trip exists. */
export async function previewGuide(
  draft: TripDraft,
  ai: TripShape["ai"],
  question: string,
  english: boolean
): Promise<string> {
  const persona = composePersona({
    destination: { label: draft.destination, lat: 0, lng: 0, region: "" },
    stops: undefined,
    timezone: "UTC",
    currency: "EUR",
    coverImage: null,
    startDate: draft.startDate,
    endDate: draft.endDate,
    groupKind: draft.groupKind,
    groupName: draft.groupName,
    ai,
  });
  const completion = await new OpenAI().chat.completions.create({
    model: model(),
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: `${persona}\n\nזו תצוגה מקדימה: ענה בקצרה (עד 70 מילים), בסגנון שלך, בלי להמציא הזמנות קיימות. ${inLanguage(english)}${draft.aboutUs ? `\nעל החבורה: ${draft.aboutUs}` : ""}`,
      },
      { role: "user", content: question },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

/** The trip at a glance, in the guide's voice. */
export async function summarizeTrip(
  trip: TripShape & { name: string; shortName: string },
  roster: string,
  schedule: string[],
  english: boolean
): Promise<string> {
  const completion = await new OpenAI().chat.completions.create({
    model: model(),
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: `${composePersona(trip)}\n\nכתוב סיכום טיול מרגש וקצר (3-5 משפטים) לכל החבורה: לאן, מתי, מי, מה כבר סגור, ומה כדאי עוד לתכנן. בלי כותרות ובלי רשימות. ${inLanguage(english)}`,
      },
      {
        role: "user",
        content: `טיול: ${trip.name} ל${trip.shortName}, ${trip.startDate} עד ${trip.endDate}.\nהחבורה:\n${roster || "—"}\nבלו״ז:\n${schedule.join("\n") || "עוד ריק"}`,
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

/** "Tell me more" about one recommended place, without touching the chat. */
export async function placeBriefing(options: {
  /** The guide's one-line identity for this trip */
  identity: string;
  shortName: string;
  name: string;
  area?: string;
  description?: string;
  why?: string;
  english: boolean;
}): Promise<string> {
  const completion = await new OpenAI().chat.completions.create({
    model: model(),
    messages: [
      { role: "system", content: options.identity },
      {
        role: "user",
        content: `${options.english ? "Answer in English, no emoji. " : "בלי אימוג׳י. "}ספר לי על ${options.name}${options.area ? ` (${options.area})` : ""} ב${options.shortName}: מה זה בעצם, למה שווה לקבוצה כמו שלנו, ו-2-3 טיפים מעשיים (עלות משוערת, משך, האם צריך להזמין מראש). עד 120 מילים.${
          options.description ? `\nמה שכבר ידוע: ${options.description}` : ""
        }${options.why ? `\n${options.why}` : ""}`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("empty");
  return text;
}
