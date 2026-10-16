import { NextResponse } from "next/server";
import { authorizeTrip } from "@/lib/server/auth";
import { grantTripClaim } from "@/lib/server/membership";

type Params = { params: Promise<{ tripId: string }> };

/**
 * Re-grants the `t` storage claim for a trip the caller is already a member
 * of. Uploads call this once after Storage refuses them, then refresh the
 * ID token and retry (an older session route used to overwrite the claims).
 */
export async function POST(request: Request, { params }: Params) {
  const { tripId } = await params;
  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  if (!access.uid || access.trip.legacy) return NextResponse.json({ ok: true });
  await grantTripClaim(access.uid, tripId);
  return NextResponse.json({ ok: true });
}
