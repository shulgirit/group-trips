import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  constantTimeEquals,
  createSessionToken,
  getTripPassword,
  verifySessionToken,
} from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { TRIP_PATH } from "@/lib/trip";

const RequestSchema = z.object({
  idToken: z.string().min(10),
  joinCode: z.string().optional(),
});

/**
 * Google-first login: verifies the Firebase ID token, checks trip
 * membership, and sets the session cookie. First-time visitors must
 * provide the one-time join code — after that their Google account IS
 * the membership.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(body.idToken);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const userRef = adminDb().doc(`${TRIP_PATH}/users/${decoded.uid}`);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    // An already-valid session cookie proves membership — legacy sessions
    // upgrade to a Google identity without re-entering the join code.
    const cookieStore = await cookies();
    const alreadyMember = verifySessionToken(
      cookieStore.get(SESSION_COOKIE)?.value
    );
    if (!alreadyMember) {
      const joinCode = body.joinCode?.trim();
      if (!joinCode) {
        return NextResponse.json({ error: "join_required" }, { status: 403 });
      }
      const tripPassword = getTripPassword();
      if (!tripPassword || !constantTimeEquals(joinCode, tripPassword)) {
        return NextResponse.json({ error: "wrong_code" }, { status: 401 });
      }
    }
    await userRef.set(
      {
        displayName: decoded.name ?? "",
        email: decoded.email ?? "",
        photoURL: decoded.picture ?? "",
        familyId: null,
        memberId: null,
        createdAt: Date.now(),
      },
      { merge: true }
    );
  }

  // Membership claim lets Storage rules verify without a Firestore lookup
  await adminAuth()
    .setCustomUserClaims(decoded.uid, { member: true })
    .catch(() => undefined);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
