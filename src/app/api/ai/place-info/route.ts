import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export const maxDuration = 60;

const RequestSchema = z.object({
  name: z.string().min(1).max(120),
  area: z.string().max(120).optional(),
  description: z.string().max(600).optional(),
  why: z.string().max(600).optional(),
});

/** Fast, focused briefing about a single recommended place — used by the
 *  "ספרו לי עוד" modal, without touching the chat thread. */
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
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "אתה המשרת של חבורת מיחא — עוזר טיולים לארבע משפחות ישראליות עם ילדים בסיציליה (חלק מהילדים עם שתלים קוכלאריים; ציין שיקולי שמיעה רק אם באמת רלוונטי). ענה בעברית, חם, תמציתי ומעשי. בלי פתיחים מיותרים.",
        },
        {
          role: "user",
          content: `ספר לי על ${body.name}${body.area ? ` (${body.area})` : ""} בסיציליה: מה זה בעצם, למה שווה לקבוצה כמו שלנו, ו-2-3 טיפים מעשיים (עלות משוערת, משך, האם צריך להזמין מראש). עד 120 מילים.${
            body.description ? `\nמה שכבר ידוע: ${body.description}` : ""
          }${body.why ? `\n${body.why}` : ""}`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("empty");
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[ai/place-info]", error);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
