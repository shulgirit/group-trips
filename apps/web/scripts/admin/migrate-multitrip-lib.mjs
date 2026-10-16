// Multi-trip migration (idempotent). Prepares the legacy trips for the
// self-serve model WITHOUT changing how they work today:
//  - trips/<legacy>/members/{uid}  for every Google profile (role member;
//    OWNER_EMAIL becomes owner) — legacy rules ignore these docs, so this
//    is invisible until a trip is switched to the new access model
//  - users/{uid}.tripIds           so "My trips" lists them natively
//  - the `t` storage claim         for those uids
// Kid name-logins (uid member-*) and the shared "trip-member" identity are
// skipped — they re-join through kid-device invites after the switch.
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const LEGACY_TRIPS = ["sicily-2026", "sardinia-2026"];
const OWNER_EMAIL = "omer@wiply.com";

export async function migrate({ apply }) {
  const app = initializeApp({ credential: applicationDefault() });
  const db = getFirestore(app);
  const auth = getAuth(app);
  console.log(apply ? "== APPLY ==" : "== DRY RUN (nothing is written) ==");

  for (const tripId of LEGACY_TRIPS) {
    const profiles = await db.collection(`trips/${tripId}/users`).get();
    let planned = 0;
    for (const profile of profiles.docs) {
      const uid = profile.id;
      const data = profile.data();
      if (uid === "trip-member" || uid.startsWith("member-") || data.kid) continue;
      const role = data.email === OWNER_EMAIL ? "owner" : "member";
      planned++;
      console.log(`${tripId}: ${uid} ${data.displayName ?? ""} → ${role}`);
      if (!apply) continue;
      const memberRef = db.doc(`trips/${tripId}/members/${uid}`);
      const existing = await memberRef.get();
      if (!existing.exists) {
        await memberRef.set({
          role,
          displayName: data.displayName ?? "",
          photoURL: data.photoURL ?? "",
          familyId: data.familyId ?? null,
          memberId: data.memberId ?? null,
          joinedAt: data.createdAt ?? Date.now(),
        });
      }
      await db.doc(`users/${uid}`).set(
        {
          displayName: data.displayName ?? "",
          photoURL: data.photoURL ?? "",
          tripIds: FieldValue.arrayUnion(tripId),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      try {
        const user = await auth.getUser(uid);
        const claims = { ...(user.customClaims ?? {}) };
        claims.t = { ...(claims.t ?? {}), [tripId]: 1 };
        await auth.setCustomUserClaims(uid, claims);
      } catch (error) {
        console.warn(`  claim skipped for ${uid}: ${error.message}`);
      }
    }
    console.log(`${tripId}: ${planned} members ${apply ? "written" : "planned"}`);
  }
}
