import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { TripMember, TripRole } from "@together/shared/trip-doc";

/** Storage rules read trip membership from the `t` claim map. */
const MAX_TRIP_CLAIMS = 40;

export async function grantTripClaim(uid: string, tripId: string) {
  const user = await adminAuth().getUser(uid);
  const claims = { ...(user.customClaims ?? {}) } as Record<string, unknown>;
  const trips = { ...((claims.t as Record<string, number>) ?? {}) };
  trips[tripId] = 1;
  // Keep the token small (1000-byte claim limit) — drop the oldest entries
  const ids = Object.keys(trips);
  while (ids.length > MAX_TRIP_CLAIMS) delete trips[ids.shift()!];
  claims.t = trips;
  await adminAuth().setCustomUserClaims(uid, claims);
}

export async function revokeTripClaim(uid: string, tripId: string) {
  const user = await adminAuth().getUser(uid);
  const claims = { ...(user.customClaims ?? {}) } as Record<string, unknown>;
  const trips = { ...((claims.t as Record<string, number>) ?? {}) };
  delete trips[tripId];
  claims.t = trips;
  await adminAuth().setCustomUserClaims(uid, claims);
}

/**
 * Makes uid a member of tripId. Writes:
 * - trips/{id}/members/{uid}   — the source of truth for rules
 * - trips/{id}/users/{uid}     — the profile every existing page reads
 * - users/{uid}.tripIds        — powers "My trips"
 * - the `t` storage claim
 */
export async function addMember(
  tripId: string,
  uid: string,
  input: {
    role: TripRole;
    displayName: string;
    email?: string;
    photoURL?: string;
    familyId?: string | null;
    memberId?: string | null;
    /** No account (anonymous) — access lives on one device until upgraded */
    guest?: boolean;
  }
): Promise<void> {
  const db = adminDb();
  const now = Date.now();
  const memberRef = db.doc(`trips/${tripId}/members/${uid}`);
  const userRef = db.doc(`users/${uid}`);
  const [existing, rootUser] = await Promise.all([
    memberRef.get(),
    userRef.get(),
  ]);
  const previous = existing.data() as TripMember | undefined;

  const member: TripMember = {
    // Never downgrade an existing owner/admin through a fresh invite
    role:
      previous && ["owner", "admin"].includes(previous.role)
        ? previous.role
        : input.role,
    displayName: input.displayName || previous?.displayName || "",
    photoURL: input.photoURL ?? previous?.photoURL ?? "",
    familyId: input.familyId ?? previous?.familyId ?? null,
    memberId: input.memberId ?? previous?.memberId ?? null,
    joinedAt: previous?.joinedAt ?? now,
    ...(input.guest ? { guest: true } : {}),
  };

  const batch = db.batch();
  batch.set(memberRef, member);
  batch.set(
    db.doc(`trips/${tripId}/users/${uid}`),
    {
      displayName: member.displayName,
      email: input.email ?? "",
      photoURL: member.photoURL ?? "",
      familyId: member.familyId,
      memberId: member.memberId,
      ...(member.role === "kid" ? { kid: true } : {}),
      createdAt: previous?.joinedAt ?? now,
    },
    { merge: true }
  );
  batch.set(
    userRef,
    {
      displayName: member.displayName,
      photoURL: member.photoURL ?? "",
      tripIds: FieldValue.arrayUnion(tripId),
      lastTripId: tripId,
      updatedAt: now,
      ...(rootUser.exists ? {} : { createdAt: now }),
    },
    { merge: true }
  );
  await batch.commit();
  await grantTripClaim(uid, tripId);
}

export async function removeMember(tripId: string, uid: string) {
  const db = adminDb();
  const batch = db.batch();
  batch.delete(db.doc(`trips/${tripId}/members/${uid}`));
  batch.delete(db.doc(`trips/${tripId}/users/${uid}`));
  batch.set(
    db.doc(`users/${uid}`),
    { tripIds: FieldValue.arrayRemove(tripId) },
    { merge: true }
  );
  await batch.commit();
  await revokeTripClaim(uid, tripId).catch(() => undefined);
}

export async function memberCount(tripId: string): Promise<number> {
  const snapshot = await adminDb()
    .collection(`trips/${tripId}/members`)
    .count()
    .get();
  return snapshot.data().count;
}
