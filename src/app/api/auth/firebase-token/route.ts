import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Mints a Firebase custom token for holders of a valid trip session cookie.
 * This is the only path into Firebase Auth — no sign-in providers are
 * enabled, so Firestore/Storage rules requiring auth are effectively
 * "password holders only".
 */
export async function POST() {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await adminAuth().createCustomToken("trip-member", {
    member: true,
  });
  return NextResponse.json({ token });
}
