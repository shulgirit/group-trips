import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPushToAll, type PushPayload } from "@/lib/server/push";
import type { Locale } from "@together/i18n/config";
import { translate, type TKey } from "@together/i18n/translate";
import { authorizeTrip } from "@/lib/server/auth";

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
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const access = await authorizeTrip(request, body.tripId);
  if (access instanceof NextResponse) return access;
  const trip = access.trip;
  const payloadFor = (locale: Locale): PushPayload => {
    const t = (key: TKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars);
    switch (body.type) {
      case "poll":
        return {
          title: t("server.push.pollTitle"),
          body: body.title,
          url: `${trip.prefix}/polls`,
          tag: "poll",
        };
      case "poll_option":
        return {
          title: t("server.push.pollOptionTitle"),
          body: t("server.push.pollOptionBody", { title: body.title }),
          url: `${trip.prefix}/polls`,
          tag: "poll",
        };
      case "event":
        return {
          title: t("server.push.eventTitle"),
          body: body.detail ? `${body.title} · ${body.detail}` : body.title,
          url: body.day
            ? `${trip.prefix}/calendar?day=${body.day}`
            : `${trip.prefix}/calendar`,
          tag: "event",
          navUrl: body.navUrl,
        };
    }
  };

  const result = await sendPushToAll(trip.path, payloadFor, {
    excludeUid: body.actorUid,
  });
  return NextResponse.json({ ok: true, ...result });
}
