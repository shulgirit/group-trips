import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/server/auth";
import { lookupInvite } from "@/lib/server/invites";
import { addMember, memberCount } from "@/lib/server/membership";
import { FREE_LIMITS } from "@/lib/server/usage";
import { RedeemSchema } from "@/lib/trip-schemas";

/** Joins the caller to the invite's trip, optionally as a chosen member. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;

  const parsed = RedeemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = parsed.data;
  const lookup = await lookupInvite(body.code);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error }, { status: 404 });
  }
  const { invite } = lookup;
  const tripId = invite.tripId;

  const provider = user.firebase?.sign_in_provider;
  const anonymous = provider === "anonymous";
  // Anonymous identities are only for kids' devices
  // Guests (no account) join as members; organizer links need a real account
  if (anonymous && invite.role === "admin") {
    return NextResponse.json({ error: "sign_in_required" }, { status: 403 });
  }

  const already = await adminDb().doc(`trips/${tripId}/members/${user.uid}`).get();
  if (!already.exists && (await memberCount(tripId)) >= FREE_LIMITS.membersPerTrip) {
    return NextResponse.json({ error: "trip_full" }, { status: 403 });
  }

  // Validate the picked identity against the roster
  let familyId = body.familyId ?? invite.familyId ?? null;
  let memberId = body.memberId ?? null;
  let memberName = "";
  if (familyId) {
    const family = await adminDb().doc(`trips/${tripId}/families/${familyId}`).get();
    const members = (family.data()?.members ?? []) as { id: string; name: string }[];
    if (!family.exists) {
      familyId = null;
      memberId = null;
    } else if (memberId) {
      const member = members.find((m) => m.id === memberId);
      if (!member) memberId = null;
      else memberName = member.name;
    }
  }

  await addMember(tripId, user.uid, {
    guest: anonymous,
    // A parent opening a kid-device link on their own account stays an adult
    role: invite.role === "kid" && !anonymous ? "member" : invite.role,
    displayName: memberName || user.name || (anonymous ? "אורח" : ""),
    email: user.email ?? "",
    photoURL: user.picture ?? "",
    familyId,
    memberId,
  });
  if (!already.exists) {
    await adminDb()
      .doc(`invites/${body.code}`)
      .update({ uses: FieldValue.increment(1) });
  }
  return NextResponse.json({ tripId });
}
