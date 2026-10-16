import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { BookingItemSchema } from "@together/shared/booking";
import { authorizeTrip } from "@/lib/server/auth";
import { requestLocale } from "@/i18n/server";
import { translate } from "@together/i18n/translate";
import { applyBookings } from "@/lib/server/booking-import";

export const maxDuration = 60;

const RequestSchema = z.object({
  tripId: z.string().min(1),
  importId: z.string().min(1).max(60),
  items: z.array(BookingItemSchema).max(30),
});

/** Writes the reviewed items into the trip (events, places, home base). */
export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = parsed.data;
  const access = await authorizeTrip(request, body.tripId);
  if (access instanceof NextResponse) return access;
  const { trip, doc, uid, member } = access;
  const locale = await requestLocale();
  if (!uid || access.role === "kid") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const importRef = adminDb().doc(`${trip.path}/imports/${body.importId}`);
  const snapshot = await importRef.get();
  const record = snapshot.data();
  if (!record || record.status === "applied") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await applyBookings(trip, body.items, {
    signer: member?.displayName || translate(locale, "server.booking.importer"),
    locale,
    setHomeBase: !doc?.homeBase && !trip.homeBase,
  });

  // Keep the original confirmation with the trip's shared documents
  if (record.storagePath) {
    await adminDb()
      .collection(`${trip.path}/documents`)
      .add({
        name: String(record.fileName),
        ownerUid: uid,
        ownerName: member?.displayName ?? "",
        visibility: "shared",
        storagePath: record.storagePath,
        contentType: record.contentType,
        size: record.size ?? 0,
        createdAt: Date.now(),
      });
  }
  await importRef.update({
    status: "applied",
    items: body.items,
    appliedAt: Date.now(),
    result,
  });
  return NextResponse.json({ ok: true, ...result });
}
