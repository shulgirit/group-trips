import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { loadTrip } from "@/lib/server/trip-server";
import type { TripDoc, TripMember, TripRole } from "@/lib/trip-doc";
import { legacyTripById, type TripConfig } from "@/lib/trips";

/**
 * Per-request authorization for API routes.
 *
 * - Legacy trips (sicily/sardinia) keep their original model: the shared
 *   trip_session cookie, or a Google user with a profile in that trip.
 * - Self-serve trips require a Firebase ID token (Authorization: Bearer)
 *   whose uid has a members/{uid} doc in that exact trip.
 *
 * The proxy lets any Bearer-carrying /api request through, so EVERY API
 * route must call one of these before touching data.
 */

export interface TripAccess {
  trip: TripConfig;
  doc: TripDoc | null;
  uid: string | null;
  role: TripRole | "legacy";
  member: TripMember | null;
}

function deny(status: 401 | 403 | 404, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function bearerUser(
  request: Request
): Promise<DecodedIdToken | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  try {
    return await adminAuth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

async function hasLegacyCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

/** Signed-in user (any provider) or a 401 response. */
export async function requireUser(
  request: Request
): Promise<DecodedIdToken | NextResponse> {
  return (await bearerUser(request)) ?? deny(401, "unauthorized");
}

/** A signed-in personal (Google/Apple) account — required to create trips. */
export async function requirePersonalUser(
  request: Request
): Promise<DecodedIdToken | NextResponse> {
  const user = await bearerUser(request);
  if (!user) return deny(401, "unauthorized");
  const provider = user.firebase?.sign_in_provider;
  if (provider !== "google.com" && provider !== "apple.com") {
    return deny(403, "personal_account_required");
  }
  return user;
}

/** Any authenticated caller — for trip-agnostic routes like /api/rates. */
export async function requireAnyAccess(
  request: Request
): Promise<true | NextResponse> {
  if (await hasLegacyCookie()) return true;
  if (await bearerUser(request)) return true;
  return deny(401, "unauthorized");
}

/** Authorizes the caller for one trip; returns the trip or an error response. */
export async function authorizeTrip(
  request: Request,
  tripId: string | null | undefined,
  options: { roles?: TripRole[] } = {}
): Promise<TripAccess | NextResponse> {
  const user = await bearerUser(request);
  // Self-serve trips: authenticate before revealing whether a trip exists
  if (tripId && !legacyTripById(tripId) && !user) return deny(401, "unauthorized");

  const loaded = await loadTrip(tripId);
  if (!loaded) return deny(404, "trip_not_found");
  const { config, doc } = loaded;

  if (config.legacy) {
    if (await hasLegacyCookie()) {
      return { trip: config, doc, uid: user?.uid ?? null, role: "legacy", member: null };
    }
    if (user) {
      const profile = await adminDb()
        .doc(`${config.path}/users/${user.uid}`)
        .get();
      if (profile.exists) {
        return { trip: config, doc, uid: user.uid, role: "legacy", member: null };
      }
    }
    return deny(401, "unauthorized");
  }

  if (!user) return deny(401, "unauthorized");
  const memberSnap = await adminDb()
    .doc(`${config.path}/members/${user.uid}`)
    .get();
  if (!memberSnap.exists) return deny(403, "not_a_member");
  const member = memberSnap.data() as TripMember;
  if (options.roles && !options.roles.includes(member.role)) {
    return deny(403, "forbidden");
  }
  return { trip: config, doc, uid: user.uid, role: member.role, member };
}
