import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { enrichSavedPlace } from "@/lib/server/enrich";
import { geocodePlace } from "@/lib/server/import-place";
import { sendPushToAll } from "@/lib/server/push";
import { TRIP, TRIP_PATH } from "@/lib/trip";
import { PLACE_CATEGORIES } from "@/types";

export const maxDuration = 120;

const GLOBAL_POLL_ID = "global";
const GLOBAL_POLL_QUESTION = "🗳️ סקר הרעיונות של הקבוצה";

/* ---------- response schema ---------- */

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
  /** Who is talking, e.g. "מיקה ממשפחת טל" */
  speaker: z.string().max(80).optional(),
});

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
        description:
          "מקומות מומלצים קונקרטיים. ריק אם השאלה לא מבקשת המלצות על מקומות.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: Object.keys(PLACE_CATEGORIES) },
            area: { type: "string" },
            description: { type: "string" },
            why: { type: "string" },
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

/* ---------- tools ---------- */

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
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
          emoji: { type: "string", description: "אימוג׳י אחד מתאים" },
          day: {
            type: "string",
            description: `תאריך YYYY-MM-DD בטווח הטיול (${TRIP.startDate} עד ${TRIP.endDate})`,
          },
          startTime: { type: "string", description: "שעה HH:mm (24h)" },
          durationMin: { type: "number", description: "משך בדקות (אופציונלי)" },
          placeName: {
            type: "string",
            description:
              "שם של מקום שמור (מהרשימה בהקשר) כדי לקשר את האירוע אליו — לניווט",
          },
          participants: {
            type: "array",
            items: { type: "string" },
            description:
              "שמות משתתפים (חברי משפחה) או שמות משפחות. רשימה ריקה = כל הקבוצה",
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
          placeName: {
            type: "string",
            description: "שם המקום השמור לעדכון (מהרשימה בהקשר)",
          },
          url: {
            type: "string",
            description:
              "כתובת האתר לקריאה. אופציונלי — אם לא סופק, נשתמש באתר השמור של המקום",
          },
        },
        required: ["placeName"],
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
                placeName: {
                  type: "string",
                  description: "שם מקום שמור לקישור (אם קיים ברשימה)",
                },
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
          placeName: {
            type: "string",
            description: "שם מקום שמור לקישור (אם קיים ברשימה)",
          },
        },
        required: ["label"],
      },
    },
  },
];

/* ---------- trip context ---------- */

function sicilyNow(): { iso: string; pretty: string; todayIso: string; tomorrowIso: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  const todayIso = `${parts.year}-${parts.month}-${parts.day}`;
  const tomorrow = new Date(`${todayIso}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  return {
    iso: `${todayIso} ${parts.hour}:${parts.minute}`,
    pretty: `${parts.day}.${parts.month} ${parts.hour}:${parts.minute}`,
    todayIso,
    tomorrowIso,
  };
}

interface FamilyData {
  id: string;
  name: string;
  members: { id: string; name: string }[];
}

interface TripData {
  places: { id: string; name: string; category: string; area?: string }[];
  families: FamilyData[];
}

async function buildTripContext(): Promise<{ context: string; data: TripData }> {
  const tripRef = adminDb().collection("trips").doc(TRIP.id);
  const [tripSnap, placesSnap, eventsSnap, familiesSnap, pollsSnap] =
    await Promise.all([
      tripRef.get(),
      tripRef.collection("places").get(),
      tripRef.collection("events").get(),
      tripRef.collection("families").get(),
      tripRef.collection("polls").get(),
    ]);
  const aboutUs = String(tripSnap.data()?.aboutUs ?? "").trim();

  const places = placesSnap.docs.map((d) => {
    const p = d.data();
    return {
      id: d.id,
      name: String(p.name),
      category: String(p.category),
      area: p.area ? String(p.area) : undefined,
    };
  });

  const families: FamilyData[] = familiesSnap.docs.map((d) => {
    const f = d.data();
    return { id: d.id, name: f.name, members: f.members ?? [] };
  });

  const events = eventsSnap.docs
    .map((d) => d.data())
    .sort((a, b) =>
      a.day === b.day
        ? String(a.startTime).localeCompare(String(b.startTime))
        : String(a.day).localeCompare(String(b.day))
    )
    .map((e) => `- ${e.day} ${e.startTime}: ${e.title}`);

  const polls = pollsSnap.docs.map((d) => {
    const p = d.data();
    const votes = (p.votes ?? {}) as Record<
      string,
      string | { optionId: string }
    >;
    const counts = new Map<string, number>();
    for (const vote of Object.values(votes)) {
      const optionId = typeof vote === "string" ? vote : vote.optionId;
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    }
    const options = (p.options ?? [])
      .map(
        (o: { id: string; label: string }) =>
          `${o.label} (${counts.get(o.id) ?? 0} קולות)`
      )
      .join(", ");
    return `- ${p.question}${p.closed ? " [סגור]" : ""}: ${options || "(בלי אפשרויות עדיין)"}`;
  });

  const now = sicilyNow();

  const context = [
    `עכשיו בסיציליה: ${now.iso}. היום = ${now.todayIso}, מחר = ${now.tomorrowIso}.`,
    `תאריכי הטיול: ${TRIP.startDate} עד ${TRIP.endDate}. הוילה: ${TRIP.villa.name}, ${TRIP.villa.address}.`,
    ``,
    ...(aboutUs ? [`על החבורה (נכתב על ידי המשפחות):`, aboutUs, ``] : []),
    `המשפחות:`,
    ...families.map(
      (f) => `- ${f.name}: ${f.members.map((m) => m.name).join(", ")}`
    ),
    ``,
    `מקומות שמורים (${places.length}):`,
    ...places.map(
      (p) => `- ${p.name} (${p.category}${p.area ? `, ${p.area}` : ""})`
    ),
    ``,
    `הלו״ז:`,
    ...(events.length ? events : ["(ריק)"]),
    ``,
    `סקרים:`,
    ...(polls.length ? polls : ["(אין)"]),
  ].join("\n");

  return { context, data: { places, families } };
}

/* ---------- tool execution ---------- */

function resolvePlace(placeName: string | undefined, data: TripData) {
  if (!placeName) return null;
  const needle = placeName.trim().toLowerCase();
  return (
    data.places.find((p) => p.name.toLowerCase() === needle) ??
    data.places.find(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        needle.includes(p.name.toLowerCase())
    ) ??
    null
  );
}

function resolveParticipants(names: string[] | undefined, data: TripData) {
  if (!names?.length) return { type: "all" as const };
  const familyIds: string[] = [];
  const memberIds: string[] = [];
  for (const raw of names) {
    const name = raw.replace("משפחת", "").trim();
    const family = data.families.find((f) =>
      f.name.replace("משפחת", "").trim() === name
    );
    if (family) {
      familyIds.push(family.id);
      continue;
    }
    for (const f of data.families) {
      const member = f.members.find((m) => m.name === name);
      if (member) memberIds.push(member.id);
    }
  }
  if (memberIds.length) return { type: "members" as const, memberIds };
  if (familyIds.length) return { type: "families" as const, familyIds };
  return { type: "all" as const };
}

const CreateEventArgs = z.object({
  title: z.string().min(1),
  emoji: z.string().optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  durationMin: z.number().positive().optional(),
  placeName: z.string().optional(),
  participants: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const AddPollOptionArgs = z.object({
  label: z.string().min(1),
  placeName: z.string().optional(),
});

const CreatePollArgs = z.object({
  question: z.string().min(1),
  options: z
    .array(z.object({ label: z.string().min(1), placeName: z.string().optional() }))
    .min(2)
    .max(6),
});

/** Poll-option additions are collected and pushed as ONE notification. */
interface PendingNotifications {
  pollOptionLabels: string[];
}

async function executeTool(
  name: string,
  rawArgs: unknown,
  data: TripData,
  pending: PendingNotifications
): Promise<Record<string, unknown>> {
  const tripRef = adminDb().collection("trips").doc(TRIP.id);

  if (name === "create_event") {
    const args = CreateEventArgs.parse(rawArgs);
    if (args.day < TRIP.startDate || args.day > TRIP.endDate) {
      return { ok: false, error: `התאריך ${args.day} מחוץ לטווח הטיול` };
    }
    const place = resolvePlace(args.placeName, data);
    const startTime =
      args.startTime.length === 4 ? `0${args.startTime}` : args.startTime;
    const eventRef = await tripRef.collection("events").add({
      title: args.title,
      emoji: args.emoji ?? null,
      placeId: place?.id ?? null,
      day: args.day,
      startTime,
      durationMin: args.durationMin ?? null,
      participants: resolveParticipants(args.participants, data),
      notes: args.notes ?? "",
      createdAt: Date.now(),
      createdByName: "🦻✨ המשרת של החבורה",
    });
    sendPushToAll({
      title: "📅 המשרת של החבורה הוסיף ללוח",
      body: `${args.title} · ${args.day.slice(8, 10)}.${args.day.slice(5, 7)} · ${startTime}`,
      url: "/calendar",
      tag: "event",
    }).catch(() => undefined);
    return {
      ok: true,
      eventId: eventRef.id,
      summary: `נוצר אירוע "${args.title}" ב-${args.day} בשעה ${startTime}${
        place ? ` (מקושר ל-${place.name})` : ""
      }`,
    };
  }

  if (name === "enrich_place") {
    const args = z
      .object({ placeName: z.string().min(1), url: z.string().optional() })
      .parse(rawArgs);
    const place = resolvePlace(args.placeName, data);
    if (!place) {
      return { ok: false, error: `לא נמצא מקום שמור בשם "${args.placeName}"` };
    }
    const result = await enrichSavedPlace(place.id, args.url);
    return { ok: result.ok, summary: result.message };
  }

  if (name === "create_poll") {
    const args = CreatePollArgs.parse(rawArgs);
    const options = args.options.map((option) => {
      const place = resolvePlace(option.placeName ?? option.label, data);
      return {
        id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: option.label,
        placeId: place?.id ?? null,
      };
    });
    const pollRef = await tripRef.collection("polls").add({
      question: args.question,
      options,
      votes: {},
      closed: false,
      createdAt: Date.now(),
    });
    // Exactly one notification, led by the question
    sendPushToAll({
      title: "🗳️ סקר חדש בקבוצה",
      body: args.question,
      url: "/polls",
      tag: "poll",
    }).catch(() => undefined);
    return {
      ok: true,
      pollId: pollRef.id,
      summary: `נוצר סקר "${args.question}" עם ${options.length} אפשרויות וכולם קיבלו התראה`,
    };
  }

  if (name === "add_poll_option") {
    const args = AddPollOptionArgs.parse(rawArgs);
    const place = resolvePlace(args.placeName ?? args.label, data);
    const pollRef = tripRef.collection("polls").doc(GLOBAL_POLL_ID);
    const snapshot = await pollRef.get();
    const existing = (snapshot.data()?.options ?? []) as {
      label: string;
      placeId?: string | null;
    }[];
    if (
      existing.some(
        (o) =>
          o.label === args.label || (place && o.placeId === place.id)
      )
    ) {
      return { ok: true, summary: `"${args.label}" כבר נמצא בסקר הקבוצתי` };
    }
    const option = {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: args.label,
      placeId: place?.id ?? null,
    };
    if (snapshot.exists) {
      await pollRef.update({ options: FieldValue.arrayUnion(option) });
    } else {
      await pollRef.set({
        question: GLOBAL_POLL_QUESTION,
        options: [option],
        votes: {},
        closed: false,
        pinned: true,
        createdAt: Date.now(),
      });
    }
    pending.pollOptionLabels.push(args.label);
    return { ok: true, summary: `"${args.label}" נוסף לסקר הרעיונות` };
  }

  return { ok: false, error: "unknown_tool" };
}

/* ---------- system prompt ---------- */

const SYSTEM_PROMPT = `אתה ״המשרת של חבורת מיחא״ 🦻✨ — העוזר האישי של טיול משפחתי בסיציליה: ארבע משפחות ישראליות, הורים וילדים, וילה משותפת בקסטלמארה דל גולפו. חלק מהילדים המקסימים שלנו הם חירשים ומשתמשים בשתלים קוכלאריים (החבורה נקראת על שם ארגון מיח״א).

רגישות שמיעה — בטבעיות ורק כשזה רלוונטי (לא בכל תשובה):
- העדף חוויות ויזואליות ומוחשיות; שים לב לסביבות רועשות מאוד.
- בפעילויות מים, הוסף תזכורת קצרה לגבי מעבדי השתלים (הסרה/הגנה עמידה למים).
- בסיורים מודרכים, ציין אם החוויה מסתמכת בעיקר על הסבר קולי.

כללים:
- ענה תמיד בעברית, בטון חם וקצר.
- כשמבקשים המלצות על מקומות — החזר אותם כ-candidates מובנים (3-5), שמות אמיתיים בלבד. כשאתה מחזיר candidates אל תפרט אותם בתוך reply — משפט הקדמה בלבד.
- כשמבקשים ממך לשבץ משהו בלוח ("תוסיף למחר ב-14:00...") — השתמש בכלי create_event. חשב את התאריך לפי "היום"/"מחר" מההקשר. אחרי הפעולה, אשר ב-reply מה בדיוק נוצר.
- כשמבקשים סקר חדש עם שאלה ("תעשה סקר מה עושים מחר", "תשלח סקר לכולם") — השתמש ב-create_poll ליצירת סקר נפרד. add_poll_option מיועד רק להוספת רעיון בודד לסקר הרעיונות הקבוע.
- כשמבקשים לעדכן/להעשיר מקום מהאתר שלו — השתמש בכלי enrich_place, ואז סכם ב-reply מה התעדכן.
- אל תבצע פעולות כתיבה בלי בקשה מפורשת של המשתמש.
- קח בחשבון את הלו״ז הקיים (התנגשויות, מרחקים) והרכב הקבוצה.
- שדות טקסט שאין לך מידע עבורם — מחרוזת ריקה.`;

/* ---------- handler ---------- */

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
    const { context, data } = await buildTripContext();
    const openai = new OpenAI();

    const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `הקשר הטיול העדכני:\n${context}` },
      ...(body.speaker
        ? [
            {
              role: "system" as const,
              content: `מי שמדבר/ת איתך בשיחה הזו: ${body.speaker}. פנה אליו/ה בשמו/ה בטבעיות.`,
            },
          ]
        : []),
      ...body.messages,
    ];
    const pending: PendingNotifications = { pollOptionLabels: [] };

    const flushPendingNotifications = () => {
      const labels = pending.pollOptionLabels;
      if (!labels.length) return;
      sendPushToAll({
        title: "🗳️ סקר הרעיונות של הקבוצה התעדכן",
        body:
          labels.slice(0, 3).join(" · ") +
          (labels.length > 3 ? ` ועוד ${labels.length - 3}` : ""),
        url: "/polls",
        tag: "poll",
      }).catch(() => undefined);
    };

    for (let round = 0; round < 4; round++) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-5.1",
        messages: conversation,
        tools: TOOLS,
        response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
      });

      const message = completion.choices[0]?.message;
      if (!message) throw new Error("empty_completion");

      if (message.tool_calls?.length) {
        conversation.push(message);
        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== "function") continue;
          let result: Record<string, unknown>;
          try {
            result = await executeTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments || "{}"),
              data,
              pending
            );
          } catch (error) {
            console.error("[ai/chat] tool failed", error);
            result = { ok: false, error: "הפעולה נכשלה" };
          }
          conversation.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const raw = message.content;
      if (!raw) throw new Error("empty_completion");
      const parsed = AiResponseSchema.parse(JSON.parse(raw));

      // Attach a real Google Maps photo + coordinates to every candidate
      const candidates = await Promise.all(
        parsed.candidates.map(async (c) => {
          const geo = await geocodePlace(
            `${c.name} ${c.area ?? ""}`.trim()
          ).catch(() => null);
          return {
            ...c,
            area: c.area || undefined,
            address: c.address || geo?.address || undefined,
            lat: c.lat ?? geo?.lat ?? null,
            lng: c.lng ?? geo?.lng ?? null,
            priceNotes: c.priceNotes || undefined,
            website:
              c.website && /^https?:\/\//.test(c.website)
                ? c.website
                : undefined,
            imageUrl: geo?.photoUrl,
            rating: geo?.rating,
            ratingCount: geo?.ratingCount,
          };
        })
      );
      flushPendingNotifications();
      return NextResponse.json({ reply: parsed.reply, candidates });
    }

    throw new Error("tool_loop_exceeded");
  } catch (error) {
    console.error("[ai/chat]", error);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
