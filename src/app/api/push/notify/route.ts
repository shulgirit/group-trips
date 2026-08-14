import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { sendPushToAll } from "@/lib/server/push";

const RequestSchema = z.object({
  type: z.enum(["poll", "poll_option", "event"]),
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(160).optional(),
  actorUid: z.string().optional(),
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

  const payloads = {
    poll: {
      title: "🗳️ סקר חדש בקבוצה",
      body: body.title,
      url: "/polls",
      tag: "poll",
    },
    poll_option: {
      title: "🗳️ אפשרות חדשה בסקר הקבוצתי",
      body: `${body.title} — בואו להצביע`,
      url: "/polls",
      tag: "poll",
    },
    event: {
      title: "📅 נוסף ללוח הטיול",
      body: body.detail ? `${body.title} · ${body.detail}` : body.title,
      url: "/calendar",
      tag: "event",
    },
  } as const;

  const result = await sendPushToAll(payloads[body.type], {
    excludeUid: body.actorUid,
  });
  return NextResponse.json({ ok: true, ...result });
}
