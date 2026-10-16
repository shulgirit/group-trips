import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { sendFcmTo, sendPushTo, subscriptionDocId } from "@/lib/server/push";
import { authorizeTrip } from "@/lib/server/auth";
import { requestLocale } from "@/i18n/server";
import { translate } from "@/i18n/translate";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const RequestSchema = z.object({
  subscription: SubscriptionSchema.optional(),
  /** Native app (Capacitor) FCM registration token */
  fcmToken: z.string().min(20).max(4096).optional(),
  uid: z.string().optional(),
  userName: z.string().optional(),
  tripId: z.string().optional(),
});

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
  const locale = await requestLocale();
  const welcome = {
    title: translate(locale, "server.push.welcomeTitle"),
    body: translate(locale, "server.push.welcomeBody"),
    url: trip.prefix || "/",
    tag: "welcome",
  };
  // Self-serve trips: the verified caller, never a client claim
  const owner = {
    uid: access.uid ?? body.uid ?? null,
    userName: body.userName ?? null,
    locale,
    createdAt: Date.now(),
  };

  if (body.fcmToken) {
    await adminDb()
      .doc(`${trip.path}/pushSubscriptions/${subscriptionDocId(body.fcmToken)}`)
      .set({ kind: "fcm", token: body.fcmToken, ...owner }, { merge: true });
    await sendFcmTo(body.fcmToken, welcome);
    return NextResponse.json({ ok: true });
  }
  if (!body.subscription) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const id = subscriptionDocId(body.subscription.endpoint);
  await adminDb()
    .doc(`${trip.path}/pushSubscriptions/${id}`)
    .set(
      {
        endpoint: body.subscription.endpoint,
        keys: body.subscription.keys,
        ...owner,
      },
      { merge: true }
    );

  // Welcome ping so the user immediately sees it works
  await sendPushTo(body.subscription, welcome);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let endpoint: string;
  let tripId: string | undefined;
  try {
    const parsed = z
      .object({
        endpoint: z.string().url().optional(),
        fcmToken: z.string().min(20).optional(),
        tripId: z.string().optional(),
      })
      .refine((b) => Boolean(b.endpoint || b.fcmToken))
      .parse(await request.json());
    endpoint = (parsed.endpoint ?? parsed.fcmToken)!;
    tripId = parsed.tripId;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  const trip = access.trip;
  await adminDb()
    .doc(`${trip.path}/pushSubscriptions/${subscriptionDocId(endpoint)}`)
    .delete()
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
