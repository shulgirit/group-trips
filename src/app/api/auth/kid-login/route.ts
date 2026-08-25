import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  constantTimeEquals,
  createSessionToken,
} from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getJoinCode, resolveTrip } from "@/lib/server/trip-server";

const RequestSchema = z.object({
  joinCode: z.string().min(1),
  familyId: z.string().optional(),
  memberId: z.string().optional(),
  tripId: z.string().optional(),
});

/**
 * Name-based sign-in for kids without an email address.
 * Phase 1 (code only): validates the join code, returns the family roster.
 * Phase 2 (code + member): mints a personal custom-token identity
 * (uid member-<memberId>), registers the profile, sets the session cookie.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const trip = resolveTrip(body.tripId);
  const tripPassword = await getJoinCode(trip);
  if (!tripPassword || !constantTimeEquals(body.joinCode.trim(), tripPassword)) {
    return NextResponse.json({ error: "wrong_code" }, { status: 401 });
  }

  const familiesSnap = await adminDb()
    .collection(`${trip.path}/families`)
    .get();
  const families = familiesSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: String(data.name ?? doc.id),
        order: Number(data.order ?? 0),
        members: (data.members ?? []) as { id: string; name: string }[],
      };
    })
    .sort((a, b) => a.order - b.order);

  // Phase 1: just the roster for the picker
  if (!body.familyId || !body.memberId) {
    return NextResponse.json({ families });
  }

  const family = families.find((f) => f.id === body.familyId);
  const member = family?.members.find((m) => m.id === body.memberId);
  if (!family || !member) {
    return NextResponse.json({ error: "member_not_found" }, { status: 400 });
  }

  const uid = `member-${member.id}`;
  await adminDb()
    .doc(`${trip.path}/users/${uid}`)
    .set(
      {
        displayName: member.name,
        email: "",
        photoURL: "",
        familyId: family.id,
        memberId: member.id,
        kid: true,
        createdAt: Date.now(),
      },
      { merge: true }
    );

  const token = await adminAuth().createCustomToken(uid, { member: true });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ token, displayName: member.name });
}
