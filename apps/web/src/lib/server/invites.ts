import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { TripDoc } from "@together/shared/trip-doc";

export interface InviteRecord {
  tripId: string;
  role: "admin" | "member" | "kid";
  familyId: string | null;
  createdBy: string;
  expiresAt: number;
  maxUses: number;
  uses: number;
  revoked: boolean;
}

export type InviteLookup =
  | { ok: true; invite: InviteRecord; trip: TripDoc }
  | { ok: false; error: "not_found" | "expired" | "used_up" | "revoked" | "trip_closed" };

export async function lookupInvite(code: string): Promise<InviteLookup> {
  if (!/^[a-z0-9]{6,16}$/.test(code)) return { ok: false, error: "not_found" };
  const snapshot = await adminDb().doc(`invites/${code}`).get();
  if (!snapshot.exists) return { ok: false, error: "not_found" };
  const invite = snapshot.data() as InviteRecord;
  if (invite.revoked) return { ok: false, error: "revoked" };
  if (invite.expiresAt < Date.now()) return { ok: false, error: "expired" };
  if (invite.uses >= invite.maxUses) return { ok: false, error: "used_up" };
  const tripSnap = await adminDb().doc(`trips/${invite.tripId}`).get();
  const trip = tripSnap.data() as TripDoc | undefined;
  if (!trip || trip.status === "archived") return { ok: false, error: "trip_closed" };
  return { ok: true, invite, trip };
}
