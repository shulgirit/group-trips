import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requirePersonalUser, requireUser } from "@/lib/server/auth";
import { purgeAccount } from "@/lib/server/purge";

/**
 * Permanent account deletion (App Store / GDPR). Owned trips pass to
 * another adult member or are deleted when nobody else is in them; every
 * trace of the user (profile, chats, files, votes, devices, location) is
 * removed, then the sign-in account itself.
 */
export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const result = await purgeAccount(user.uid);
  return NextResponse.json({ ok: true, ...result });
}

/**
 * A guest just attached Google/Apple to their identity (same uid): drop the
 * guest flag everywhere and pick up their real name/photo.
 */
export async function POST(request: Request) {
  const user = await requirePersonalUser(request);
  if (user instanceof NextResponse) return user;
  const db = adminDb();
  const profile = await db.doc(`users/${user.uid}`).get();
  const tripIds = (profile.data()?.tripIds as string[] | undefined) ?? [];
  for (const tripId of tripIds) {
    const memberRef = db.doc(`trips/${tripId}/members/${user.uid}`);
    const member = await memberRef.get();
    if (!member.exists) continue;
    await memberRef.update({
      guest: FieldValue.delete(),
      ...(user.picture ? { photoURL: user.picture } : {}),
    });
    await db
      .doc(`trips/${tripId}/users/${user.uid}`)
      .set({ email: user.email ?? "", ...(user.picture ? { photoURL: user.picture } : {}) }, { merge: true });
  }
  return NextResponse.json({ ok: true, trips: tripIds.length });
}
