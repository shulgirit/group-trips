import { NextResponse } from "next/server";
import { constantTimeEquals } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { wazeUrl } from "@/lib/nav";
import { sendPushToAll } from "@/lib/server/push";
import { translate } from "@/i18n/translate";
import { authorizeTrip } from "@/lib/server/auth";
import { loadTrip } from "@/lib/server/trip-server";
import { TRIPS, type TripConfig } from "@/lib/trips";

const REMINDER_WINDOW_MIN = 50;
const REMINDER_MIN_LEAD_MIN = 10;

function tripNowParts(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

/** Every trip that could have an event today (cron fan-out). */
async function tripsInProgress(): Promise<TripConfig[]> {
  const today = new Date().toISOString().slice(0, 10);
  const trips: TripConfig[] = Object.values(TRIPS).filter(
    (trip) => trip.endDate >= today
  );
  const snapshot = await adminDb()
    .collection("trips")
    .where("status", "==", "active")
    .get();
  for (const doc of snapshot.docs) {
    // Filter in memory — avoids a composite index for status+endDate
    const { startDate, endDate } = doc.data();
    if (startDate > today || endDate < today) continue;
    const loaded = await loadTrip(doc.id);
    if (loaded && !loaded.config.legacy) trips.push(loaded.config);
  }
  return trips;
}

/**
 * Sends "leaving soon" reminders for events starting within the next
 * ~10-50 minutes (trip-local time). Idempotent via reminderSentAt.
 * Called by open clients every few minutes, and by the scheduled
 * reminders workflow (x-cron-secret) for every trip in progress.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const presented = request.headers.get("x-cron-secret");
  if (cronSecret && presented && constantTimeEquals(presented, cronSecret)) {
    let sent = 0;
    for (const trip of await tripsInProgress()) {
      sent += await sendDueReminders(trip);
    }
    return NextResponse.json({ ok: true, sent });
  }

  const tripId = await request
    .json()
    .then((body) => (body as { tripId?: string })?.tripId)
    .catch(() => undefined);
  const access = await authorizeTrip(request, tripId);
  if (access instanceof NextResponse) return access;
  const sent = await sendDueReminders(access.trip);
  return NextResponse.json({ ok: true, sent });
}

async function sendDueReminders(trip: TripConfig): Promise<number> {
  const { dateIso, minutes } = tripNowParts(trip.timezone);
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

    await sendPushToAll(trip.path, (locale) => ({
      title: translate(locale, "server.push.reminderTitle", {
        minutes: lead,
        title: String(event.title),
      }),
      body: `${event.startTime}${event.notes ? ` · ${event.notes}` : ""}`,
      url: trip.prefix || "/",
      tag: `reminder-${doc.id}`,
      navUrl,
    }));
    sent++;
  }

  return sent;
}
