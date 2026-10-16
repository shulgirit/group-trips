import { BookingItemSchema, type BookingItem } from "@together/shared/booking";
import OpenAI from "openai";
import { z } from "zod";

/**
 * Booking confirmations → structured items (OpenAI vision on PDFs/images,
 * or pasted email text), and the pure plan of what applying them creates.
 * Same prompt and rules as the Firebase version (lib/server/booking-import).
 */

export const SUPPORTED_BOOKING_TYPES = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif|gif))$/;
export const MAX_BOOKING_BYTES = 15 * 1024 * 1024;

const ExtractionSchema = z.object({ items: z.array(BookingItemSchema) });

const JSON_SCHEMA = {
  name: "booking_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "kind", "title", "startDate", "startTime", "endDate", "endTime",
            "location", "city", "confirmationCode", "flightNumber", "from",
            "to", "travelers", "notes",
          ],
          properties: {
            kind: { type: "string", enum: ["flight", "lodging", "car", "activity", "restaurant", "other"] },
            title: { type: "string" },
            startDate: { type: "string", description: "YYYY-MM-DD or empty" },
            startTime: { type: "string", description: "HH:mm 24h local time or empty" },
            endDate: { type: "string" },
            endTime: { type: "string" },
            location: { type: "string" },
            city: { type: "string" },
            confirmationCode: { type: "string" },
            flightNumber: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
            travelers: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `אתה מחלץ פרטי הזמנות מאישורי הזמנה (טיסות, מלונות, דירות, השכרת רכב, כרטיסים לאטרקציות, מסעדות).
החזר רשימת items — פריט אחד לכל הזמנה נפרדת. טיסה הלוך-חזור = שני פריטים (כל מקטע טיסה בנפרד; עם עצירת ביניים — כל מקטע בנפרד).
- title: שם קצר, למשל "טיסה לרומא", "מלון Villa Maria", "השכרת רכב — Hertz", "כרטיסים למוזיאון הוותיקן".
- startDate/startTime: לטיסה — זמן ההמראה המקומי; ללינה — צ'ק-אין; לרכב — איסוף. endDate/endTime: נחיתה / צ'ק-אאוט / החזרה.
- location: שם המקום או הכתובת המלאה כפי שמופיעה (למלון/דירה — הכתובת). city: עיר.
- from/to: לטיסות — שם העיר וקוד שדה התעופה, למשל "תל אביב (TLV)".
- travelers: שמות הנוסעים/האורחים כפי שמופיעים.
- notes: פרטים שימושיים קצרים (טרמינל, מושבים, כבודה, שעת צ'ק-אין, מה כלול). בלי מספרי כרטיס אשראי.
- שדה שאין עליו מידע — מחרוזת ריקה. אל תמציא.
- אם המסמך אינו אישור הזמנה — החזר items ריק.`;

export async function extractBookings(input: {
  english: boolean;
  text?: string;
  file?: { base64: string; contentType: string; fileName: string };
  tripHint: string;
}): Promise<BookingItem[]> {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `הטיול: ${input.tripHint}. ${input.english ? "Write title and notes in English (not Hebrew)." : "כתוב title ו-notes בעברית."} חלץ את ההזמנות:`,
    },
  ];
  if (input.text) content.push({ type: "text", text: input.text.slice(0, 30_000) });
  if (input.file) {
    const dataUrl = `data:${input.file.contentType};base64,${input.file.base64}`;
    if (input.file.contentType === "application/pdf") {
      content.push({ type: "file", file: { filename: input.file.fileName, file_data: dataUrl } });
    } else {
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }
  }
  const completion = await new OpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.1",
    reasoning_effort: "low",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content },
    ],
    response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("empty_completion");
  return ExtractionSchema.parse(JSON.parse(raw)).items;
}

// ── the plan of an apply (pure) ───────────────────────────────────────

const TIME = /^\d{1,2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (time: string) => (time.length === 4 ? `0${time}` : time);

function minutesBetween(a: string, b: string, dayA: string, dayB: string) {
  const diff = Math.round((Date.parse(`${dayB}T${pad(b)}:00Z`) - Date.parse(`${dayA}T${pad(a)}:00Z`)) / 60_000);
  return diff > 0 && diff < 24 * 60 ? diff : null;
}

const stayName = (title: string) => title.replace(/^(מלון|דירה|לינה|Hotel|Apartment|Stay)\s*[—:-]?\s*/i, "");

export interface PlannedVenue {
  name: string;
  category: "accommodation" | "restaurant" | "attraction";
  /** Geocoding query */
  query: string;
  area?: string;
  address?: string;
  tips?: string;
  stayFrom?: string;
  stayTo?: string;
  lodging: boolean;
}

export interface PlannedEvent {
  title: string;
  emoji: string;
  day: string;
  startTime: string;
  durationMin: number | null;
  notes: string;
}

export interface PlannedItem {
  venue: PlannedVenue | null;
  events: PlannedEvent[];
}

const EMOJI = { flight: "plane", lodging: "hotel", car: "car", activity: "ticket", restaurant: "dining", other: "pin" } as const;

/** What applying one reviewed item creates (venue place + timed events). */
export function planBooking(item: BookingItem, labels: { checkIn: string; checkOut: string }): PlannedItem {
  const venueText = item.kind === "lodging" || item.kind === "activity" || item.kind === "restaurant" ? item.location || item.title : "";
  const venueName = item.kind === "lodging" ? item.title.replace(/^(מלון|דירה|לינה)\s*[—-]?\s*/, "") || venueText : item.title;
  const venue: PlannedVenue | null = venueText
    ? {
        name: venueName,
        category: item.kind === "lodging" ? "accommodation" : item.kind === "restaurant" ? "restaurant" : "attraction",
        query: `${item.location || venueName} ${item.city}`.trim(),
        ...(item.city ? { area: item.city } : {}),
        ...(item.location ? { address: item.location } : {}),
        ...(item.notes ? { tips: item.notes } : {}),
        ...(item.kind === "lodging" && DATE.test(item.startDate) ? { stayFrom: item.startDate } : {}),
        ...(item.kind === "lodging" && DATE.test(item.endDate) ? { stayTo: item.endDate } : {}),
        lodging: item.kind === "lodging",
      }
    : null;

  if (!DATE.test(item.startDate)) return { venue, events: [] };
  const durationMin =
    TIME.test(item.startTime) && TIME.test(item.endTime) && DATE.test(item.endDate)
      ? minutesBetween(item.startTime, item.endTime, item.startDate, item.endDate)
      : null;
  const events: PlannedEvent[] = [
    {
      title:
        item.kind === "flight" && item.flightNumber
          ? `${item.title} · ${item.flightNumber}`
          : item.kind === "lodging"
            ? `${labels.checkIn} · ${stayName(item.title)}`
            : item.title,
      emoji: EMOJI[item.kind],
      day: item.startDate,
      startTime: TIME.test(item.startTime) ? pad(item.startTime) : item.kind === "lodging" ? "15:00" : "09:00",
      durationMin: item.kind === "lodging" ? null : durationMin,
      notes: [item.kind === "flight" && item.from && item.to ? `${item.from} ← ${item.to}` : "", item.notes].filter(Boolean).join(" · "),
    },
  ];
  // A lodging stay also gets a check-out reminder
  if (item.kind === "lodging" && DATE.test(item.endDate)) {
    events.push({
      title: `${labels.checkOut} · ${stayName(item.title)}`,
      emoji: "luggage",
      day: item.endDate,
      startTime: TIME.test(item.endTime) ? pad(item.endTime) : "11:00",
      durationMin: null,
      notes: "",
    });
  }
  return { venue, events };
}
