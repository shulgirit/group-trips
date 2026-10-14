import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { adminBucket, adminDb } from "@/lib/firebase/admin";
import { BookingItemSchema, type BookingItem } from "@/lib/booking";
import { samePlaceName } from "@/lib/place-name";
import { geocodePlace } from "@/lib/server/import-place";
import type { TripConfig } from "@/lib/trips";
import type { Locale } from "@/i18n/config";
import { translate } from "@/i18n/translate";

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
            kind: {
              type: "string",
              enum: ["flight", "lodging", "car", "activity", "restaurant", "other"],
            },
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

/** Runs the model over a file (PDF/image) or pasted text. */
export async function extractBookings(input: {
  locale?: Locale;
  text?: string;
  file?: { base64: string; contentType: string; fileName: string };
  tripHint: string;
}): Promise<BookingItem[]> {
  const openai = new OpenAI();
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `הטיול: ${input.tripHint}. ${
        input.locale === "en"
          ? "Write title and notes in English (not Hebrew)."
          : "כתוב title ו-notes בעברית."
      } חלץ את ההזמנות:`,
    },
  ];
  if (input.text) content.push({ type: "text", text: input.text.slice(0, 30_000) });
  if (input.file) {
    const dataUrl = `data:${input.file.contentType};base64,${input.file.base64}`;
    if (input.file.contentType === "application/pdf") {
      content.push({
        type: "file",
        file: { filename: input.file.fileName, file_data: dataUrl },
      });
    } else {
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }
  }
  const completion = await openai.chat.completions.create({
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

export async function downloadImportFile(storagePath: string) {
  const file = adminBucket().file(storagePath);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size ?? 0) > 15 * 1024 * 1024) throw new Error("too_large");
  const [buffer] = await file.download();
  return {
    base64: buffer.toString("base64"),
    contentType: String(metadata.contentType ?? "application/octet-stream"),
    size: Number(metadata.size ?? buffer.length),
  };
}

const TIME = /^\d{1,2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function pad(time: string) {
  return time.length === 4 ? `0${time}` : time;
}

function minutesBetween(a: string, b: string, dayA: string, dayB: string) {
  const start = Date.parse(`${dayA}T${pad(a)}:00Z`);
  const end = Date.parse(`${dayB}T${pad(b)}:00Z`);
  const diff = Math.round((end - start) / 60_000);
  return diff > 0 && diff < 24 * 60 ? diff : null;
}

/**
 * Writes confirmed items into the trip: events for timed items, places
 * for venues (deduped), and the first lodging becomes the home base.
 * Returns a short Hebrew summary.
 */
export async function applyBookings(
  trip: TripConfig,
  items: BookingItem[],
  options: { signer: string; setHomeBase: boolean; locale?: Locale }
): Promise<{ events: number; places: number; homeBase: boolean }> {
  const db = adminDb();
  const tripRef = db.doc(trip.path);
  const existingPlaces = (await tripRef.collection("places").get()).docs.map(
    (d) => ({ id: d.id, name: String(d.data().name ?? "") })
  );
  const locale = options.locale ?? "he";
  const checkIn = translate(locale, "server.booking.checkIn");
  const checkOut = translate(locale, "server.booking.checkOut");
  const stayName = (title: string) =>
    title.replace(/^(מלון|דירה|לינה|Hotel|Apartment|Stay)\s*[—:-]?\s*/i, "");
  let events = 0;
  let places = 0;
  let homeBase = false;

  for (const item of items) {
    let placeId: string | null = null;
    const venue =
      item.kind === "lodging" || item.kind === "activity" || item.kind === "restaurant"
        ? item.location || item.title
        : "";
    if (venue) {
      const name =
        item.kind === "lodging"
          ? item.title.replace(/^(מלון|דירה|לינה)\s*[—-]?\s*/, "") || venue
          : item.title;
      const existing = existingPlaces.find((p) => samePlaceName(p.name, name));
      if (existing) {
        placeId = existing.id;
      } else {
        const geo = await geocodePlace(
          `${item.location || name} ${item.city}`.trim(),
          trip.searchRegionHint
        ).catch(() => null);
        const ref = await tripRef.collection("places").add({
          name,
          category:
            item.kind === "lodging"
              ? "accommodation"
              : item.kind === "restaurant"
                ? "restaurant"
                : "attraction",
          ...(item.city ? { area: item.city } : {}),
          ...(geo?.address || item.location ? { address: geo?.address ?? item.location } : {}),
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          ...(geo?.photoUrl ? { imageUrl: geo.photoUrl } : {}),
          ...(item.notes ? { tips: item.notes } : {}),
          ...(item.kind === "lodging" && DATE.test(item.startDate) ? { stayFrom: item.startDate } : {}),
          ...(item.kind === "lodging" && DATE.test(item.endDate) ? { stayTo: item.endDate } : {}),
          createdAt: Date.now(),
          createdByName: options.signer,
        });
        placeId = ref.id;
        places++;
        existingPlaces.push({ id: ref.id, name });

        if (item.kind === "lodging" && options.setHomeBase && !homeBase) {
          await tripRef.set(
            {
              homeBase: {
                name,
                address: geo?.address ?? item.location,
                lat: geo?.lat ?? null,
                lng: geo?.lng ?? null,
              },
            },
            { merge: true }
          );
          homeBase = true;
        }
      }
    }

    if (!DATE.test(item.startDate)) continue;
    // Stored icon keys (rendered with <Glyph>)
    const emoji = {
      flight: "plane",
      lodging: "hotel",
      car: "car",
      activity: "ticket",
      restaurant: "dining",
      other: "pin",
    }[item.kind];
    const startTime = TIME.test(item.startTime)
      ? pad(item.startTime)
      : item.kind === "lodging"
        ? "15:00"
        : "09:00";
    const durationMin =
      TIME.test(item.startTime) && TIME.test(item.endTime) && DATE.test(item.endDate)
        ? minutesBetween(item.startTime, item.endTime, item.startDate, item.endDate)
        : null;
    const title =
      item.kind === "flight" && item.flightNumber
        ? `${item.title} · ${item.flightNumber}`
        : item.kind === "lodging"
          ? `${checkIn} · ${stayName(item.title)}`
          : item.title;
    const notes = [
      item.kind === "flight" && item.from && item.to ? `${item.from} ← ${item.to}` : "",
      item.notes,
    ]
      .filter(Boolean)
      .join(" · ");
    await tripRef.collection("events").add({
      title,
      emoji,
      placeId,
      day: item.startDate,
      startTime,
      durationMin: item.kind === "lodging" ? null : durationMin,
      participants: { type: "all" },
      notes,
      createdAt: Date.now(),
      createdByName: options.signer,
    });
    events++;

    // A lodging stay also gets a check-out reminder
    if (item.kind === "lodging" && DATE.test(item.endDate)) {
      await tripRef.collection("events").add({
        title: `${checkOut} · ${stayName(item.title)}`,
        emoji: "luggage",
        placeId,
        day: item.endDate,
        startTime: TIME.test(item.endTime) ? pad(item.endTime) : "11:00",
        durationMin: null,
        participants: { type: "all" },
        notes: "",
        createdAt: Date.now(),
        createdByName: options.signer,
      });
      events++;
    }
  }
  return { events, places, homeBase };
}
