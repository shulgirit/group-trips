import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { FAMILY_COLORS, randomId, type TripDoc } from "@/lib/trip-doc";
import type { TripInput, FamilyInput } from "@/lib/trip-schemas";

/** Trip-doc fields an organizer controls (everything but ownership/meta). */
export function tripFieldsFromInput(
  input: TripInput
): Omit<TripDoc, "ownerUid" | "plan" | "createdAt" | "updatedAt" | "status"> {
  const stops = input.stops;
  const first = stops[0];
  return {
    name: input.name,
    emoji: input.emoji,
    stops,
    destination: {
      label: first.label,
      ...(first.placeId ? { placeId: first.placeId } : {}),
      lat: first.lat,
      lng: first.lng,
      region: first.region,
      ...(first.country ? { country: first.country } : {}),
    },
    startDate: first.startDate,
    endDate: stops[stops.length - 1].endDate,
    timezone: first.timezone,
    currency: first.currency,
    coverImage: first.coverImage,
    departureAt: input.departureAt ?? null,
    departureNote: input.departureNote ?? "",
    homeBase: input.homeBase,
    groupKind: input.groupKind,
    groupName: input.groupName,
    aboutUs: input.aboutUs ?? "",
    ai: { ...input.ai },
    settings: { membersCanDeletePlaces: true },
  };
}

/**
 * Upserts the group's families. Removing a family is only allowed while
 * the trip is a draft — once live, expenses/events may reference it.
 */
export async function writeFamilies(
  tripId: string,
  families: FamilyInput[],
  { allowDelete }: { allowDelete: boolean }
) {
  const db = adminDb();
  const collection = db.collection(`trips/${tripId}/families`);
  const batch = db.batch();
  families.forEach((family, index) => {
    batch.set(collection.doc(family.id), {
      name: family.name,
      color: FAMILY_COLORS[index % FAMILY_COLORS.length],
      members: family.members.map((m) => ({
        id: m.id,
        name: m.name,
        ...(m.kid ? { kid: true } : {}),
        ...(m.age != null ? { age: m.age } : {}),
      })),
      order: index,
    });
  });
  if (allowDelete) {
    const keep = new Set(families.map((f) => f.id));
    const existing = await collection.get();
    for (const doc of existing.docs) {
      if (!keep.has(doc.id)) batch.delete(doc.ref);
    }
  }
  await batch.commit();
}

/** Creates an invite and its global code index entry. */
export async function createInvite(
  tripId: string,
  createdBy: string,
  options: {
    role: "admin" | "member" | "kid";
    familyId: string | null;
    days: number;
    maxUses: number;
  }
): Promise<string> {
  const db = adminDb();
  const code = randomId(8);
  const now = Date.now();
  await db.doc(`invites/${code}`).set({
    tripId,
    role: options.role,
    familyId: options.familyId,
    createdBy,
    createdAt: now,
    expiresAt: now + options.days * 86_400_000,
    maxUses: options.maxUses,
    uses: 0,
    revoked: false,
  });
  return code;
}

/** The ready-made invite links shown after creating a trip. */
export async function createDefaultInvites(
  tripId: string,
  ownerUid: string,
  families: FamilyInput[]
) {
  await createInvite(tripId, ownerUid, {
    role: "member",
    familyId: null,
    days: 60,
    maxUses: 60,
  });
  for (const family of families) {
    await createInvite(tripId, ownerUid, {
      role: "member",
      familyId: family.id,
      days: 60,
      maxUses: Math.max(4, family.members.length + 2),
    });
  }
}

/** Trips a user organizes that haven't ended yet (free-plan limit). */
export async function activeTripCount(uid: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const snapshot = await adminDb()
    .collection("trips")
    .where("ownerUid", "==", uid)
    .get();
  return snapshot.docs.filter((doc) => {
    const data = doc.data();
    return (
      (data.status === "draft" || data.status === "active") &&
      String(data.endDate ?? "") >= today
    );
  }).length;
}
