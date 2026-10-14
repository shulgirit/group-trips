import Link from "next/link";
import type { TripSummary } from "@/lib/my-trips";

function daysUntil(dateIso: string, todayIso: string): number {
  return Math.round(
    (Date.parse(`${dateIso}T12:00:00`) - Date.parse(`${todayIso}T12:00:00`)) /
      86_400_000
  );
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

export function TripCard({
  trip,
  today,
}: {
  trip: TripSummary;
  today: string;
}) {
  const isDraft = trip.status === "draft";
  const days = daysUntil(trip.startDate, today);
  const badge = isDraft
    ? { label: "טיוטה — להמשיך", className: "bg-lemon-100 text-ink-700" }
    : trip.phase === "live"
      ? { label: "● עכשיו בטיול", className: "bg-terra-500 text-cream-50" }
      : trip.phase === "upcoming"
        ? {
            label: days === 1 ? "מחר!" : `בעוד ${days} ימים`,
            className: "bg-sea-100 text-sea-700",
          }
        : { label: "זיכרונות", className: "bg-cream-100 text-ink-500" };

  return (
    <Link
      href={isDraft ? `/new?trip=${trip.id}` : trip.href}
      className={`card group block overflow-hidden transition active:scale-[0.99] ${trip.phase === "live" && !isDraft ? "ring-2 ring-terra-400" : ""}`}
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-sea-900 via-sea-700 to-sea-500">
        {trip.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trip.coverImage}
            alt=""
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${trip.phase === "past" ? "grayscale-[35%]" : ""}`}
          />
        )}
        {!trip.coverImage && (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-6xl opacity-80"
          >
            {trip.emoji}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-sea-950/75 via-sea-950/10 to-transparent" />
        <span
          className={`absolute start-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
        <div className="absolute inset-x-4 bottom-3">
          <p className="font-display text-2xl font-normal text-cream-50 drop-shadow">
            {trip.emoji} {trip.name}
          </p>
          <p className="text-sm text-cream-50/85">
            {trip.destination} · {shortDate(trip.startDate)}–{shortDate(trip.endDate)}
          </p>
        </div>
      </div>
    </Link>
  );
}
