import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { lookupInvite } from "@/lib/server/invites";
import { itineraryName, stopsOf, type InvitePreview } from "@/lib/trip-doc";
import { avatarSrc } from "@/lib/avatars";
import { ensureTripCover } from "@/lib/server/photos";

/**
 * Public: what the invite landing page shows before sign-in. Holding the
 * link is the credential, so it may reveal the trip's name, dates and
 * the group's first names (to pick "who am I") — nothing else.
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const lookup = await lookupInvite(code);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error }, { status: 404 });
  }
  const { invite, trip } = lookup;
  const db = adminDb();
  const [familiesSnap, membersCount, owner] = await Promise.all([
    db.collection(`trips/${invite.tripId}/families`).orderBy("order").get(),
    db.collection(`trips/${invite.tripId}/members`).count().get(),
    db.doc(`trips/${invite.tripId}/members/${trip.ownerUid}`).get(),
  ]);
  const families = familiesSnap.docs.map((doc) => ({
    id: doc.id,
    name: String(doc.data().name ?? ""),
    color: String(doc.data().color ?? "sea"),
    members: ((doc.data().members ?? []) as { id: string; name: string; kid?: boolean }[]).map(
      (m) => ({ id: m.id, name: m.name, kid: Boolean(m.kid) })
    ),
  }));
  const family = families.find((f) => f.id === invite.familyId) ?? null;

  const preview: InvitePreview & {
    role: string;
    familyId: string | null;
    families: typeof families;
    aiName: string;
    aiEmoji: string;
    aiAvatar: string | null;
  } = {
    tripId: invite.tripId,
    name: trip.name,
    emoji: trip.emoji,
    destination: itineraryName(stopsOf(trip)),
    startDate: trip.startDate,
    endDate: trip.endDate,
    // the first visitor already sees the destination, even if the organizer never opened the trip
    coverImage: trip.coverImage ?? (await ensureTripCover(invite.tripId, stopsOf(trip)[0]?.label ?? trip.name).catch(() => null)),
    groupName: trip.groupName,
    familyName: family?.name ?? null,
    memberCount: membersCount.data().count,
    organizer: String(owner.data()?.displayName ?? ""),
    role: invite.role,
    familyId: invite.familyId,
    families,
    aiName: trip.ai.name,
    aiEmoji: trip.ai.emoji,
    aiAvatar: avatarSrc(trip.ai.avatar),
  };
  return NextResponse.json(preview);
}
