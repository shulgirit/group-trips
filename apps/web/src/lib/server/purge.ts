import "server-only";

import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { adminAuth, adminBucket, adminDb } from "@/lib/firebase/admin";
import { revokeTripClaim } from "@/lib/server/membership";
import { TRIPS } from "@/lib/trips";
import type { TripMember } from "@/lib/trip-doc";

/**
 * Permanent data deletion — the implementation behind "delete trip",
 * "leave and delete my data" and "delete my account". Nothing here is
 * soft: documents and files are removed from Firestore and Storage.
 */

async function deleteStoragePrefix(prefix: string): Promise<void> {
  await adminBucket()
    .deleteFiles({ prefix, force: true })
    .catch((error) => console.error("[purge] storage", prefix, error));
}

async function deleteWhere(collectionPath: string, field: string, value: string) {
  const db = adminDb();
  const snapshot = await db.collection(collectionPath).where(field, "==", value).get();
  const refs: DocumentReference[] = snapshot.docs.map((doc) => doc.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}

/** Strips authorship from shared items the user created (group keeps the item). */
async function anonymizeAuthored(tripPath: string, uid: string) {
  const db = adminDb();
  for (const collection of ["places", "events"]) {
    const snapshot = await db
      .collection(`${tripPath}/${collection}`)
      .where("createdByUid", "==", uid)
      .get();
    for (const doc of snapshot.docs) {
      await doc.ref.update({
        createdByUid: FieldValue.delete(),
        createdByName: FieldValue.delete(),
      });
    }
  }
}

/** Removes the user's votes from every poll in the trip. */
async function removeVotes(tripPath: string, uid: string) {
  const polls = await adminDb().collection(`${tripPath}/polls`).get();
  for (const poll of polls.docs) {
    const votes = (poll.data().votes ?? {}) as Record<string, unknown>;
    if (uid in votes) {
      await poll.ref.update({ [`votes.${uid}`]: FieldValue.delete() });
    }
  }
}

/**
 * Deletes everything one person has in one trip: profile, membership, AI
 * chats, uploaded documents and photos (files too), booking imports, push
 * devices, shared location and poll votes. Shared places/events they
 * created stay for the group, without their name on them.
 */
export async function purgeUserFromTrip(tripId: string, uid: string): Promise<void> {
  const db = adminDb();
  const tripPath = `trips/${tripId}`;

  await Promise.all([
    deleteWhere(`${tripPath}/chatSessions`, "ownerUid", uid),
    deleteWhere(`${tripPath}/documents`, "ownerUid", uid),
    deleteWhere(`${tripPath}/imports`, "createdBy", uid),
    deleteWhere(`${tripPath}/pushSubscriptions`, "uid", uid),
    removeVotes(tripPath, uid),
    anonymizeAuthored(tripPath, uid),
  ]);
  await Promise.all([
    deleteStoragePrefix(`${tripPath}/documents/shared/${uid}/`),
    deleteStoragePrefix(`${tripPath}/documents/private/${uid}/`),
    deleteStoragePrefix(`${tripPath}/imports/${uid}/`),
    deleteStoragePrefix(`${tripPath}/photos/chat/${uid}/`),
  ]);

  const batch = db.batch();
  batch.delete(db.doc(`${tripPath}/locations/${uid}`));
  batch.delete(db.doc(`${tripPath}/members/${uid}`));
  batch.delete(db.doc(`${tripPath}/users/${uid}`));
  batch.set(
    db.doc(`users/${uid}`),
    { tripIds: FieldValue.arrayRemove(tripId) },
    { merge: true }
  );
  await batch.commit();
  await revokeTripClaim(uid, tripId).catch(() => undefined);
}

/**
 * Deletes a whole trip: every subcollection, every uploaded file, its
 * invite links, and the trip from every member's "My trips".
 */
export async function purgeTrip(tripId: string): Promise<void> {
  const db = adminDb();
  const tripRef = db.doc(`trips/${tripId}`);
  const members = await tripRef.collection("members").get();

  await deleteWhere("invites", "tripId", tripId);
  await deleteStoragePrefix(`trips/${tripId}/`);
  await db.recursiveDelete(tripRef);

  for (const member of members.docs) {
    await db
      .doc(`users/${member.id}`)
      .set({ tripIds: FieldValue.arrayRemove(tripId) }, { merge: true })
      .catch(() => undefined);
    await revokeTripClaim(member.id, tripId).catch(() => undefined);
  }
}

/**
 * The next owner when the owner deletes their account: the earliest
 * admin, else the earliest adult member. Null → nobody left to inherit.
 */
async function successor(tripId: string, ownerUid: string): Promise<string | null> {
  const members = await adminDb().collection(`trips/${tripId}/members`).get();
  const candidates = members.docs
    .filter((doc) => doc.id !== ownerUid)
    .map((doc) => ({ uid: doc.id, ...(doc.data() as TripMember) }))
    .filter((member) => member.role !== "kid" && !member.guest)
    .sort((a, b) => {
      const rank = (role: string) => (role === "admin" ? 0 : 1);
      return rank(a.role) - rank(b.role) || a.joinedAt - b.joinedAt;
    });
  return candidates[0]?.uid ?? null;
}

export interface AccountPurgeResult {
  tripsLeft: number;
  tripsDeleted: number;
  tripsTransferred: number;
}

/**
 * Deletes a person completely. Trips they own pass to another adult
 * member, or are deleted when no one else is in them. Then their data in
 * every trip, their profile and their sign-in account are removed.
 */
export async function purgeAccount(uid: string): Promise<AccountPurgeResult> {
  const db = adminDb();
  const result: AccountPurgeResult = { tripsLeft: 0, tripsDeleted: 0, tripsTransferred: 0 };

  const profile = await db.doc(`users/${uid}`).get();
  const tripIds = new Set((profile.data()?.tripIds as string[] | undefined) ?? []);
  // Legacy trips track membership by profile doc only
  for (const legacy of Object.values(TRIPS)) {
    const legacyProfile = await db.doc(`${legacy.path}/users/${uid}`).get();
    if (legacyProfile.exists) tripIds.add(legacy.id);
  }

  for (const tripId of tripIds) {
    const trip = await db.doc(`trips/${tripId}`).get();
    if (trip.exists && trip.data()?.ownerUid === uid) {
      const next = await successor(tripId, uid);
      if (!next) {
        await purgeTrip(tripId);
        result.tripsDeleted++;
        continue;
      }
      await db.doc(`trips/${tripId}`).update({ ownerUid: next, updatedAt: Date.now() });
      await db.doc(`trips/${tripId}/members/${next}`).update({ role: "owner" });
      result.tripsTransferred++;
    }
    await purgeUserFromTrip(tripId, uid);
    result.tripsLeft++;
  }

  await db.doc(`users/${uid}`).delete();
  await adminAuth()
    .deleteUser(uid)
    .catch((error: { code?: string }) => {
      if (error.code !== "auth/user-not-found") throw error;
    });
  return result;
}

/** Shared locations whose sharing window ended (run by the reminders cron). */
export async function deleteExpiredLocations(tripPath: string): Promise<number> {
  const db = adminDb();
  const expired = await db
    .collection(`${tripPath}/locations`)
    .where("expiresAt", "<", Date.now())
    .get();
  for (const doc of expired.docs) await doc.ref.delete();
  return expired.size;
}
