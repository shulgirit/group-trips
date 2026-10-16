import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { authorizeTrip, requirePersonalUser } from "@/lib/server/auth";
import { composePersona, type TripDoc } from "@together/shared/trip-doc";
import { AiInputSchema } from "@together/shared/trip-schemas";
import { requestLocale } from "@/i18n/server";

export const maxDuration = 60;

const DraftSchema = z.object({
  destination: z.string().max(80),
  startDate: z.string().max(10),
  endDate: z.string().max(10),
  groupKind: z.enum(["families", "friends", "couple", "other"]),
  groupName: z.string().max(40),
  aboutUs: z.string().max(4000).optional(),
  peopleCount: z.number().int().min(0).max(200).optional(),
  kidsCount: z.number().int().min(0).max(200).optional(),
});

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("names"), draft: DraftSchema }),
  z.object({
    action: z.literal("preview"),
    draft: DraftSchema,
    ai: AiInputSchema,
    question: z.string().trim().min(1).max(300),
  }),
  z.object({ action: z.literal("summary"), tripId: z.string().min(1) }),
]);

function model() {
  return process.env.OPENAI_MODEL ?? "gpt-5.1";
}

/** Small AI helpers for the trip creator. */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = parsed.data;
  const openai = new OpenAI();
  const locale = await requestLocale();
  const inLanguage =
    locale === "en"
      ? "Write in English. No emoji."
      : "כתוב בעברית. בלי אימוג׳י.";

  try {
    if (body.action === "names") {
      const user = await requirePersonalUser(request);
      if (user instanceof NextResponse) return user;
      const completion = await openai.chat.completions.create({
        model: model(),
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content:
              locale === "en"
                ? "You are a sharp copywriter. Suggest 4 short (2-4 words), catchy names in English for a group trip. For `emoji` return one of: plane, sun, waves, mountain, city, palm, sail, wine, castle, globe. No quotes."
                : "אתה קופירייטר ישראלי שנון. הצע 4 שמות קצרים (2-4 מילים) וקליטים בעברית לטיול קבוצתי. בשדה emoji החזר אחד מ: plane, sun, waves, mountain, city, palm, sail, wine, castle, globe. בלי מרכאות.",
          },
          {
            role: "user",
            content: `יעד: ${body.draft.destination}. תאריכים: ${body.draft.startDate} עד ${body.draft.endDate}. קבוצה: ${body.draft.groupName || body.draft.groupKind}.`,
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
                    properties: {
                      name: { type: "string" },
                      emoji: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const raw = completion.choices[0]?.message?.content ?? '{"names":[]}';
      return NextResponse.json(JSON.parse(raw));
    }

    if (body.action === "preview") {
      const user = await requirePersonalUser(request);
      if (user instanceof NextResponse) return user;
      const persona = composePersona({
        name: "",
        emoji: "",
        destination: { label: body.draft.destination, lat: 0, lng: 0, region: "" },
        startDate: body.draft.startDate,
        endDate: body.draft.endDate,
        groupKind: body.draft.groupKind,
        groupName: body.draft.groupName,
        ai: body.ai,
      } as unknown as TripDoc);
      const completion = await openai.chat.completions.create({
        model: model(),
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content: `${persona}\n\nזו תצוגה מקדימה: ענה בקצרה (עד 70 מילים), בסגנון שלך, בלי להמציא הזמנות קיימות. ${inLanguage}${body.draft.aboutUs ? `\nעל החבורה: ${body.draft.aboutUs}` : ""}`,
          },
          { role: "user", content: body.question },
        ],
      });
      return NextResponse.json({
        reply: completion.choices[0]?.message?.content?.trim() ?? "",
      });
    }

    // summary — the trip at a glance, saved on the trip doc
    const access = await authorizeTrip(request, body.tripId, {
      roles: ["owner", "admin"],
    });
    if (access instanceof NextResponse) return access;
    const tripRef = adminDb().doc(access.trip.path);
    const [events, families] = await Promise.all([
      tripRef.collection("events").get(),
      tripRef.collection("families").get(),
    ]);
    const lines = events.docs
      .map((d) => d.data())
      .sort((a, b) => `${a.day}${a.startTime}`.localeCompare(`${b.day}${b.startTime}`))
      .map((e) => `${e.day} ${e.startTime} ${e.title}`);
    const people = families.docs
      .map((d) => `${d.data().name}: ${(d.data().members ?? []).map((m: { name: string }) => m.name).join(", ")}`)
      .join("\n");
    const completion = await openai.chat.completions.create({
      model: model(),
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content: `${composePersona(access.doc as TripDoc)}\n\nכתוב סיכום טיול מרגש וקצר (3-5 משפטים) לכל החבורה: לאן, מתי, מי, מה כבר סגור, ומה כדאי עוד לתכנן. בלי כותרות ובלי רשימות. ${inLanguage}`,
        },
        {
          role: "user",
          content: `טיול: ${access.trip.name} ל${access.trip.shortName}, ${access.trip.startDate} עד ${access.trip.endDate}.\nהחבורה:\n${people || "—"}\nבלו״ז:\n${lines.join("\n") || "עוד ריק"}`,
        },
      ],
    });
    const summary = completion.choices[0]?.message?.content?.trim() ?? "";
    if (summary) await tripRef.set({ summary }, { merge: true });
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[ai/trip-assist]", error);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
