import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authorizeTrip } from "@/lib/server/auth";
import { addMember, removeMember } from "@/lib/server/membership";
import {
  createDefaultInvites,
  tripFieldsFromInput,
  writeFamilies,
} from "@/lib/server/trips";
import { TripInputSchema } from "@/lib/trip-schemas";

type Params = { params: Promise<{ tripId: string }> };

/** Organizer edits (wizard autosave, settings). Owner/admin only. */
export async function PATCH(request: Request, { params }: Params) {
  const { tripId } = await params;
  const access = await authorizeTrip(request, tripId, {
    roles: ["owner", "admin"],
  });
  if (access instanceof NextResponse) return access;
  if (!access.doc) {
    return NextResponse.json({ error: "legacy_trip" }, { status: 400 });
  }

  const parsed = TripInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const wasDraft = access.doc.status === "draft";
  // A live trip never goes back to draft
  const status = wasDraft ? input.status : access.doc.status;

  await adminDb()
    .doc(`trips/${tripId}`)
    .set(
      { ...tripFieldsFromInput(input), status, updatedAt: Date.now() },
      { merge: true }
    );
  await writeFamilies(tripId, input.families, { allowDelete: wasDraft });

  if (input.me && access.uid) {
    await addMember(tripId, access.uid, {
      role: access.member?.role ?? "owner",
      displayName: access.member?.displayName ?? "",
      familyId: input.me.familyId,
      memberId: input.me.memberId,
    });
  }
  if (wasDraft && status === "active" && access.uid) {
    await createDefaultInvites(tripId, access.uid, input.families);
  }
  return NextResponse.json({ ok: true, status });
}

/**
 * DELETE ?member=<uid> removes a member (admins), or the caller leaves
 * (member=self). DELETE without a member archives the trip (owner).
 */
export async function DELETE(request: Request, { params }: Params) {
  const { tripId } = await params;
  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  if (!access.doc || !access.uid) {
    return NextResponse.json({ error: "legacy_trip" }, { status: 400 });
  }
  const target = new URL(request.url).searchParams.get("member");

  if (target) {
    const self = target === "self" || target === access.uid;
    const uid = self ? access.uid : target;
    if (!self && !["owner", "admin"].includes(String(access.role))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (uid === access.doc.ownerUid) {
      return NextResponse.json({ error: "owner_cannot_leave" }, { status: 400 });
    }
    await removeMember(tripId, uid);
    return NextResponse.json({ ok: true });
  }

  if (access.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await adminDb()
    .doc(`trips/${tripId}`)
    .set({ status: "archived", updatedAt: Date.now() }, { merge: true });
  return NextResponse.json({ ok: true });
}
