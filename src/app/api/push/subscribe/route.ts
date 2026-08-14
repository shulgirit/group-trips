import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { sendPushTo, subscriptionDocId } from "@/lib/server/push";
import { TRIP_PATH } from "@/lib/trip";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const RequestSchema = z.object({
  subscription: SubscriptionSchema,
  uid: z.string().optional(),
  userName: z.string().optional(),
});

async function authorized(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function POST(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const id = subscriptionDocId(body.subscription.endpoint);
  await adminDb()
    .doc(`${TRIP_PATH}/pushSubscriptions/${id}`)
    .set(
      {
        endpoint: body.subscription.endpoint,
        keys: body.subscription.keys,
        uid: body.uid ?? null,
        userName: body.userName ?? null,
        createdAt: Date.now(),
      },
      { merge: true }
    );

  // Welcome ping so the user immediately sees it works
  await sendPushTo(body.subscription, {
    title: "ההתראות פועלות 🍋",
    body: "נעדכן אתכם על סקרים חדשים ותזכורות לפני כל פעילות",
    url: "/",
    tag: "welcome",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let endpoint: string;
  try {
    ({ endpoint } = z
      .object({ endpoint: z.string().url() })
      .parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  await adminDb()
    .doc(`${TRIP_PATH}/pushSubscriptions/${subscriptionDocId(endpoint)}`)
    .delete()
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
