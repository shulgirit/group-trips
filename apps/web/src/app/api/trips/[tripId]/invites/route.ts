import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authorizeTrip } from "@/lib/server/auth";
import { createInvite } from "@/lib/server/trips";
import { InviteCreateSchema } from "@together/shared/trip-schemas";

type Params = { params: Promise<{ tripId: string }> };

/** Lists the trip's live invites (owner/admin). */
export async function GET(request: Request, { params }: Params) {
  const { tripId } = await params;
  const access = await authorizeTrip(request, tripId, {
    roles: ["owner", "admin"],
  });
  if (access instanceof NextResponse) return access;

  const snapshot = await adminDb()
    .collection("invites")
    .where("tripId", "==", tripId)
    .get();
  const now = Date.now();
  const invites = snapshot.docs
    .map((doc) => ({ code: doc.id, ...doc.data() }) as Record<string, unknown> & { code: string })
    .filter(
      (invite) =>
        !invite.revoked &&
        Number(invite.expiresAt) > now &&
        Number(invite.uses) < Number(invite.maxUses)
    )
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  return NextResponse.json({ invites });
}

/** Creates a new invite link (owner/admin; kid-device links by any adult). */
export async function POST(request: Request, { params }: Params) {
  const { tripId } = await params;
  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  if (!access.uid || !access.doc) {
    return NextResponse.json({ error: "legacy_trip" }, { status: 400 });
  }
  const parsed = InviteCreateSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const input = parsed.data;
  const isAdmin = access.role === "owner" || access.role === "admin";
  // Any adult may pair their own kid's device; everything else is admin-only
  if (!isAdmin && !(input.role === "kid" && access.role === "member")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const code = await createInvite(tripId, access.uid, {
    role: input.role,
    familyId: input.familyId ?? (input.role === "kid" ? access.member?.familyId ?? null : null),
    days: input.role === "kid" ? 1 : input.days,
    maxUses: input.role === "kid" ? 3 : input.maxUses,
  });
  return NextResponse.json({ code });
}

/** Revokes an invite: DELETE ?code= */
export async function DELETE(request: Request, { params }: Params) {
  const { tripId } = await params;
  const access = await authorizeTrip(request, tripId, {
    roles: ["owner", "admin"],
  });
  if (access instanceof NextResponse) return access;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const ref = adminDb().doc(`invites/${code}`);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.tripId !== tripId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await ref.update({ revoked: true });
  return NextResponse.json({ ok: true });
}
