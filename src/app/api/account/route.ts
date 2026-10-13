import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/server/auth";
import { removeMember } from "@/lib/server/membership";

/**
 * Account deletion (App Store requirement). Leaves every self-serve trip,
 * archives trips the user owns (other members' content is kept for them
 * until the archive is purged), deletes the root profile and the auth user.
 */
export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const db = adminDb();

  const profile = await db.doc(`users/${user.uid}`).get();
  const tripIds = (profile.data()?.tripIds as string[] | undefined) ?? [];
  for (const tripId of tripIds) {
    const trip = await db.doc(`trips/${tripId}`).get();
    if (trip.data()?.ownerUid === user.uid) {
      await trip.ref.set(
        { status: "archived", ownerDeletedAt: Date.now() },
        { merge: true }
      );
      await db.doc(`trips/${tripId}/members/${user.uid}`).delete();
      await db.doc(`trips/${tripId}/users/${user.uid}`).delete();
    } else {
      await removeMember(tripId, user.uid).catch(() => undefined);
    }
  }
  await db.doc(`users/${user.uid}`).delete();
  await adminAuth().deleteUser(user.uid);
  return NextResponse.json({ ok: true });
}
