import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { TRIP } from "@/lib/trip";
import { PLACE_CATEGORIES } from "@/types";

export const maxDuration = 60;

const CandidateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(Object.keys(PLACE_CATEGORIES) as [string, ...string[]]),
  area: z.string().optional(),
  description: z.string(),
  why: z.string(),
  address: z.string().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  priceNotes: z.string().optional(),
  website: z.string().optional(),
});

const AiResponseSchema = z.object({
  reply: z.string(),
  candidates: z.array(CandidateSchema),
});

export type AiCandidate = z.infer<typeof CandidateSchema>;

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .min(1)
    .max(30),
});

const JSON_SCHEMA = {
  name: "trip_ai_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: {
        type: "string",
        description: "תשובה שיחתית קצרה בעברית",
      },
      candidates: {
        type: "array",
        description:
          "מקומות מומלצים קונקרטיים (מסעדות/אטרקציות/חופים). ריק אם השאלה לא מבקשת המלצות על מקומות.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            category: {
              type: "string",
              enum: Object.keys(PLACE_CATEGORIES),
            },
            area: { type: "string" },
            description: { type: "string", description: "תיאור קצר בעברית" },
            why: {
              type: "string",
              description: "למה זה מתאים לקבוצה שלנו, בעברית",
            },
            address: { type: "string" },
            lat: { type: ["number", "null"] },
            lng: { type: ["number", "null"] },
            priceNotes: { type: "string" },
            website: { type: "string" },
          },
          required: [
            "name",
            "category",
            "area",
            "description",
            "why",
            "address",
            "lat",
            "lng",
            "priceNotes",
            "website",
          ],
        },
      },
    },
    required: ["reply", "candidates"],
  },
} as const;

async function buildTripContext(): Promise<string> {
  const tripRef = adminDb().collection("trips").doc(TRIP.id);
  const [placesSnap, eventsSnap, familiesSnap] = await Promise.all([
    tripRef.collection("places").get(),
    tripRef.collection("events").get(),
    tripRef.collection("families").get(),
  ]);

  const places = placesSnap.docs.map((d) => {
    const p = d.data();
    return `- ${p.name} (${p.category}${p.area ? `, ${p.area}` : ""})`;
  });

  const events = eventsSnap.docs
    .map((d) => d.data())
    .sort((a, b) =>
      a.day === b.day
        ? String(a.startTime).localeCompare(String(b.startTime))
        : String(a.day).localeCompare(String(b.day))
    )
    .map((e) => `- ${e.day} ${e.startTime}: ${e.title}`);

  const families = familiesSnap.docs.map((d) => {
    const f = d.data();
    return `- ${f.name}: ${(f.members ?? [])
      .map((m: { name: string }) => m.name)
      .join(", ")}`;
  });

  return [
    `תאריכי הטיול: ${TRIP.startDate} עד ${TRIP.endDate}.`,
    `המשפחות (${familiesSnap.size}):`,
    ...families,
    ``,
    `מקומות שכבר שמורים אצלנו (${placesSnap.size}):`,
    ...(places.length ? places : ["(אין עדיין)"]),
    ``,
    `הלו״ז הנוכחי:`,
    ...(events.length ? events : ["(ריק עדיין)"]),
  ].join("\n");
}

const SYSTEM_PROMPT = `אתה הקונסיירז׳ הפרטי של טיול משפחתי בסיציליה — ארבע משפחות ישראליות עם ילדים בגילאים שונים, נוסעות יחד ולנות בוילה משותפת.

כללים:
- ענה תמיד בעברית, בטון חם וקצר.
- כשמבקשים ממך המלצות על מקומות (מסעדות, אטרקציות, חופים, גלידה וכו') — החזר אותם כ-candidates מובנים (3-5 לרוב), עם שם אמיתי ומדויק של המקום, אזור, ולמה זה מתאים לקבוצה. אם אתה יודע כתובת/קואורדינטות במידה סבירה של ביטחון — כלול אותן, אחרת השאר ריק/null.
- כשאתה מחזיר candidates: אל תפרט את המקומות בתוך reply — כתוב שם רק משפט-שניים של הקדמה. הפרטים חיים בכרטיסים.
- המלץ רק על מקומות שאתה בטוח בקיומם ובשמם המדויק. עדיף 3 מקומות בטוחים מ-5 מפוקפקים.
- אל תמציא מקומות שאינם קיימים. המלץ רק על מקומות מוכרים בסיציליה.
- כשהשאלה כללית (לו״ז, טיפים, שאלות על הטיול) — ענה ב-reply בלבד עם candidates ריק.
- קח בחשבון את ההקשר: מה כבר שמור, מה כבר בלו״ז, והרכב הקבוצה.
- שדות טקסט שאין לך מידע עבורם — השאר מחרוזת ריקה.`;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const tripContext = await buildTripContext();
    const openai = new OpenAI();

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `הקשר הטיול העדכני:\n${tripContext}` },
        ...body.messages,
      ],
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("empty_completion");

    const parsed = AiResponseSchema.parse(JSON.parse(raw));
    // Drop empty-string optionals the schema forced into existence
    const candidates = parsed.candidates.map((c) => ({
      ...c,
      area: c.area || undefined,
      address: c.address || undefined,
      priceNotes: c.priceNotes || undefined,
      website: c.website && /^https?:\/\//.test(c.website) ? c.website : undefined,
    }));

    return NextResponse.json({ reply: parsed.reply, candidates });
  } catch (error) {
    console.error("[ai/chat]", error);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
