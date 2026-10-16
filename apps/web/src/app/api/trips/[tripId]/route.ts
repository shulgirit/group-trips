import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authorizeTrip } from "@/lib/server/auth";
import { addMember } from "@/lib/server/membership";
import { purgeTrip, purgeUserFromTrip } from "@/lib/server/purge";
import {
  createDefaultInvites,
  tripFieldsFromInput,
  writeFamilies,
} from "@/lib/server/trips";
import { TripInputSchema } from "@together/shared/trip-schemas";

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
 * DELETE ?member=<uid>  — an admin removes a member (their data in the
 *                         trip is deleted too).
 * DELETE ?member=self   — leave the trip and delete my data in it.
 * DELETE ?purge=1       — owner deletes the whole trip permanently.
 * DELETE (no params)    — owner archives the trip.
 */
export async function DELETE(request: Request, { params }: Params) {
  const { tripId } = await params;
  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  if (!access.doc || !access.uid) {
    return NextResponse.json({ error: "legacy_trip" }, { status: 400 });
  }
  const search = new URL(request.url).searchParams;
  const target = search.get("member");

  if (target) {
    const self = target === "self" || target === access.uid;
    const uid = self ? access.uid : target;
    if (!self && !["owner", "admin"].includes(String(access.role))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (uid === access.doc.ownerUid) {
      return NextResponse.json({ error: "owner_cannot_leave" }, { status: 400 });
    }
    const member = await adminDb().doc(`trips/${tripId}/members/${uid}`).get();
    if (!member.exists) {
      return NextResponse.json({ error: "not_member" }, { status: 404 });
    }
    await purgeUserFromTrip(tripId, uid);
    return NextResponse.json({ ok: true });
  }

  if (access.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (search.get("purge") === "1") {
    await purgeTrip(tripId);
    return NextResponse.json({ ok: true, deleted: true });
  }
  await adminDb()
    .doc(`trips/${tripId}`)
    .set({ status: "archived", updatedAt: Date.now() }, { merge: true });
  return NextResponse.json({ ok: true });
}
