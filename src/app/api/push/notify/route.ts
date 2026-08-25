import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { sendPushToAll } from "@/lib/server/push";
import { resolveTrip } from "@/lib/server/trip-server";

const RequestSchema = z.object({
  type: z.enum(["poll", "poll_option", "event"]),
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(160).optional(),
  actorUid: z.string().optional(),
  /** Event day (YYYY-MM-DD) — deep-links the push to that calendar day */
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Waze deep link for a נווט notification action */
  navUrl: z.string().url().optional(),
  tripId: z.string().optional(),
});

/** Client-triggered group notifications (new poll / option / event). */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const trip = resolveTrip(body.tripId);
  const payloads = {
    poll: {
      title: "🗳️ סקר חדש בקבוצה",
      body: body.title,
      url: `${trip.prefix}/polls`,
      tag: "poll",
    },
    poll_option: {
      title: "🗳️ אפשרות חדשה בסקר הקבוצתי",
      body: `${body.title} — בואו להצביע`,
      url: `${trip.prefix}/polls`,
      tag: "poll",
    },
    event: {
      title: "📅 נוסף ללוח הטיול",
      body: body.detail ? `${body.title} · ${body.detail}` : body.title,
      url: body.day
        ? `${trip.prefix}/calendar?day=${body.day}`
        : `${trip.prefix}/calendar`,
      tag: "event",
      navUrl: body.navUrl,
    },
  } as const;

  const result = await sendPushToAll(trip.path, payloads[body.type], {
    excludeUid: body.actorUid,
  });
  return NextResponse.json({ ok: true, ...result });
}
