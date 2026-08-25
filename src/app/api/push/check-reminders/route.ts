import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { wazeUrl } from "@/lib/nav";
import { sendPushToAll } from "@/lib/server/push";
import { resolveTrip } from "@/lib/server/trip-server";

const REMINDER_WINDOW_MIN = 50;
const REMINDER_MIN_LEAD_MIN = 10;

function tripNowParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return {
    dateIso: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * Sends "leaving soon" reminders for events starting within the next
 * ~10-50 minutes (trip-local time, both trips are Europe/Rome). Idempotent via reminderSentAt.
 * Called opportunistically by open clients every few minutes.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tripId = await request
    .json()
    .then((body) => (body as { tripId?: string })?.tripId)
    .catch(() => undefined);
  const trip = resolveTrip(tripId);

  const { dateIso, minutes } = tripNowParts();
  const snapshot = await adminDb()
    .collection(`${trip.path}/events`)
    .where("day", "==", dateIso)
    .get();

  let sent = 0;
  for (const doc of snapshot.docs) {
    const event = doc.data();
    if (event.reminderSentAt) continue;
    const [h, m] = String(event.startTime).split(":").map(Number);
    if (!Number.isFinite(h)) continue;
    const startMinutes = h * 60 + m;
    const lead = startMinutes - minutes;
    if (lead < REMINDER_MIN_LEAD_MIN || lead > REMINDER_WINDOW_MIN) continue;

    // Claim first so parallel checks never double-send
    await doc.ref.update({ reminderSentAt: Date.now() });

    // Waze link so the whole convoy can navigate straight from the push
    let navUrl: string | undefined;
    if (event.placeId) {
      const placeSnap = await adminDb()
        .doc(`${trip.path}/places/${event.placeId}`)
        .get();
      const place = placeSnap.data();
      if (place && (place.lat != null || place.address)) {
        navUrl = wazeUrl(
          {
            name: String(place.name ?? event.title),
            address: place.address ? String(place.address) : undefined,
            lat: place.lat ?? null,
            lng: place.lng ?? null,
          },
          trip.searchRegionHint
        );
      }
    }

    await sendPushToAll(trip.path, {
      title: `⏰ בעוד ${lead} דקות: ${event.title}`,
      body: `${event.startTime}${event.notes ? ` · ${event.notes}` : ""}`,
      url: trip.prefix || "/",
      tag: `reminder-${doc.id}`,
      navUrl,
    });
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
