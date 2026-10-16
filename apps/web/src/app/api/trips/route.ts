import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requirePersonalUser } from "@/lib/server/auth";
import { addMember } from "@/lib/server/membership";
import {
  activeTripCount,
  createDefaultInvites,
  tripFieldsFromInput,
  writeFamilies,
} from "@/lib/server/trips";
import { FREE_LIMITS } from "@/lib/server/usage";
import { randomId, type TripDoc } from "@together/shared/trip-doc";
import { TripInputSchema } from "@together/shared/trip-schemas";

/** Creates a self-serve trip (draft or active); the caller becomes owner. */
export async function POST(request: Request) {
  const user = await requirePersonalUser(request);
  if (user instanceof NextResponse) return user;

  const parsed = TripInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if ((await activeTripCount(user.uid)) >= FREE_LIMITS.activeTripsPerUser) {
    return NextResponse.json({ error: "trip_limit" }, { status: 403 });
  }

  const tripId = randomId(10);
  const now = Date.now();
  const doc: TripDoc = {
    ...tripFieldsFromInput(input),
    status: input.status,
    ownerUid: user.uid,
    plan: "free",
    createdAt: now,
    updatedAt: now,
  };
  await adminDb().doc(`trips/${tripId}`).set(doc);
  await writeFamilies(tripId, input.families, { allowDelete: false });
  await addMember(tripId, user.uid, {
    role: "owner",
    displayName: user.name ?? "",
    email: user.email ?? "",
    photoURL: user.picture ?? "",
    familyId: input.me?.familyId ?? null,
    memberId: input.me?.memberId ?? null,
  });
  if (input.status === "active") {
    await createDefaultInvites(tripId, user.uid, input.families);
  }

  return NextResponse.json({ tripId });
}
