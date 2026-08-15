"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  ChevronRight,
  Clock,
  Compass,
  Euro,
  Globe,
  Heart,
  Hourglass,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  Pencil,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  UserRound,
  UtensilsCrossed,
  Vote,
} from "lucide-react";
import { SchedulePlaceSheet } from "@/components/events/SchedulePlaceSheet";
import { AddToPollSheet } from "@/components/polls/AddToPollSheet";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { isPersonalUser } from "@/lib/firebase/client";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { deletePlace, updatePlace } from "@/lib/db";
import { useEvents, usePlace } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { formatDayLabel } from "@/lib/trip";
import { PLACE_CATEGORIES } from "@/types";

export default function PlaceDetailPage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = use(params);
  const router = useRouter();
  const { user } = useFirebase();
  // Deleting places is a parents-only action (Google accounts) —
  // also enforced server-side in the security rules
  const canDelete = isPersonalUser(user);
  const { place, loading } = usePlace(placeId);
  const { events } = useEvents();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Arriving from "מקום חדש" with ?schedule=1 → jump straight to scheduling
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("schedule") === "1") {
      setScheduleOpen(true);
    }
  }, []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pollSheetOpen, setPollSheetOpen] = useState(false);
  const [pollAdded, setPollAdded] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState("");
  const [editing, setEditing] = useState<{
    field: string;
    value: string;
  } | null>(null);
  const [savingField, setSavingField] = useState(false);

  async function saveField() {
    if (!editing || savingField) return;
    setSavingField(true);
    try {
      await updatePlace(placeId, { [editing.field]: editing.value.trim() });
      setEditing(null);
    } finally {
      setSavingField(false);
    }
  }

  async function handleEnrich(url?: string) {
    if (enriching) return;
    setEnriching(true);
    setEnrichMessage("");
    try {
      const response = await fetch("/api/import/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(url ? { placeId, url } : { placeId }),
      });
      const result = await response.json();
      if (result.ok) {
        setEnrichMessage("✓ המקום הועשר — התוכן החדש כבר מופיע כאן");
        setShowUrlInput(false);
        setEnrichUrl("");
      } else {
        setEnrichMessage(result.message ?? "לא נמצא מידע נוסף");
        // Nothing found automatically — offer the manual link right here
        setShowUrlInput(true);
      }
    } catch {
      setEnrichMessage("ההעשרה נכשלה, נסו שוב");
    } finally {
      setEnriching(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    );
  }

  if (!place) {
    return (
      <EmptyState
        emoji="🤷"
        title="המקום לא נמצא"
        description="אולי הוא נמחק"
        action={
          <Link href="/places" className="btn-primary px-5 py-2.5 text-sm">
            לכל המקומות
          </Link>
        }
      />
    );
  }

  const category = PLACE_CATEGORIES[place.category] ?? PLACE_CATEGORIES.other;
  const placeEvents = (events ?? []).filter((e) => e.placeId === place.id);

  const detailRows = [
    place.address && {
      icon: MapPin,
      label: "כתובת",
      value: place.address,
      field: "address",
    },
    place.openingHours && {
      icon: Clock,
      label: "שעות פתיחה",
      value: place.openingHours,
      field: "openingHours",
    },
    place.priceNotes && {
      icon: Euro,
      label: "מחיר",
      value: place.priceNotes,
      field: "priceNotes",
    },
    place.recommendedDurationMin && {
      icon: Hourglass,
      label: "זמן מומלץ",
      value: `כ-${Math.round(place.recommendedDurationMin / 60)} שעות`,
      field: null,
    },
    place.tips && {
      icon: Lightbulb,
      label: "טיפים",
      value: place.tips,
      field: "tips",
    },
    place.popularDishes && {
      icon: UtensilsCrossed,
      label: "מנות מומלצות",
      value: place.popularDishes,
      field: "popularDishes",
    },
    place.reviewsSummary && {
      icon: Star,
      label: "מה אומרים בביקורות",
      value: place.reviewsSummary,
      field: "reviewsSummary",
    },
    place.createdByName && {
      icon: UserRound,
      label: "נוסף על ידי",
      value: place.createdByName,
      field: null,
    },
  ].filter(Boolean) as {
    icon: typeof MapPin;
    label: string;
    value: string;
    field: string | null;
  }[];

  async function handleDelete() {
    await deletePlace(placeId);
    router.replace("/places");
  }

  return (
    <div className="space-y-5">
      {/* ── Immersive hero ── */}
      <div className="relative -mx-4 -mt-4 h-72 overflow-hidden md:mx-0 md:mt-0 md:rounded-[2rem]">
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={place.name}
            fill
            sizes="(max-width: 768px) 100vw, 576px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-sea-500 to-sea-900">
            <span className="absolute inset-0 flex items-center justify-center text-8xl opacity-70">
              {category.emoji}
            </span>
          </div>
        )}
        <div className="hero-overlay absolute inset-0" />

        {/* Floating navigation */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="חזרה"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50/90 text-ink-700 shadow-sm backdrop-blur"
        >
          <ChevronRight size={22} />
        </button>
        <button
          type="button"
          onClick={() => updatePlace(placeId, { favorite: !place.favorite })}
          aria-label={place.favorite ? "הסר ממועדפים" : "הוסף למועדפים"}
          className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50/90 shadow-sm backdrop-blur"
        >
          <Heart
            size={19}
            className={
              place.favorite ? "fill-terra-500 text-terra-500" : "text-ink-500"
            }
          />
        </button>

        {/* Title over image */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <p className="kicker text-lemon-300">
            {category.label}
            {place.area ? ` · ${place.area}` : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-cream-50">
            {place.name}
          </h1>
        </div>
      </div>

      {/* ── Primary actions ── */}
      <div className="flex gap-2">
        <a
          href={wazeUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 py-3.5"
        >
          <Compass size={19} />
          נווט
        </a>
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="btn-accent flex-1 py-3.5"
        >
          <CalendarPlus size={19} />
          הוסף ללוח
        </button>
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Google Maps"
          className="btn-soft px-4 py-3.5"
        >
          <MapIcon size={19} />
        </a>
      </div>

      <button
        type="button"
        onClick={() => setPollSheetOpen(true)}
        className={`w-full py-3 ${
          pollAdded
            ? "btn border border-lemon-300 bg-lemon-100 font-medium text-ink-700"
            : "btn-outline"
        }`}
      >
        <Vote size={18} />
        {pollAdded ? "נוסף לסקר ✓ · להוסיף לעוד סקר?" : "הוסף לסקר…"}
      </button>

      {/* ── AI enrichment ── */}
      <div>
        <button
          type="button"
          onClick={() => handleEnrich()}
          disabled={enriching}
          className={`w-full ${
            !place.summary && detailRows.length < 2
              ? "btn-accent py-3.5"
              : "btn-outline py-3"
          }`}
        >
          <Sparkles size={18} />
          {enriching
            ? "המשרת קורא על המקום… עד דקה ☕"
            : !place.summary && detailRows.length < 2
              ? "הוסיפו תוכן עם AI — המשרת יחפש באינטרנט"
              : "רענון והרחבת התוכן עם AI"}
        </button>
        {enrichMessage && (
          <p className="mt-2 rounded-2xl bg-cream-100 px-4 py-2.5 text-sm font-medium text-ink-700">
            {enrichMessage}
          </p>
        )}
        {!showUrlInput ? (
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className="mt-2 block w-full text-center text-sm text-sea-600"
          >
            🔗 יש לכם קישור לאתר של המקום? הדביקו אותו כאן ›
          </button>
        ) : (
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              dir="ltr"
              value={enrichUrl}
              onChange={(event) => setEnrichUrl(event.target.value)}
              placeholder="https://…"
              className="field min-w-0 flex-1 py-2.5"
            />
            <button
              type="button"
              onClick={() => {
                const url = enrichUrl.trim();
                if (!/^https?:\/\//.test(url)) {
                  setEnrichMessage("הדביקו קישור מלא שמתחיל ב-https://");
                  return;
                }
                handleEnrich(url);
              }}
              disabled={enriching || !enrichUrl.trim()}
              className="btn-primary whitespace-nowrap px-4 py-2.5 text-sm"
            >
              {enriching ? "קורא…" : "קרא מהקישור"}
            </button>
          </div>
        )}
      </div>

      {/* ── Editorial summary ── */}
      {place.summary && (
        <div className="relative rounded-3xl bg-cream-100/80 px-5 py-4">
          {editing?.field === "summary" ? (
            <div>
              <textarea
                value={editing.value}
                onChange={(e) => setEditing({ field: "summary", value: e.target.value })}
                rows={5}
                autoFocus
                className="field leading-relaxed"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveField}
                  disabled={savingField}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {savingField ? "שומר…" : "שמירה"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="btn-soft px-4 py-2 text-sm"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-line border-s-2 border-lemon-400 ps-4 leading-relaxed text-ink-700">
                {place.summary}
              </p>
              <button
                type="button"
                onClick={() =>
                  setEditing({ field: "summary", value: place.summary ?? "" })
                }
                aria-label="עריכת התיאור"
                className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink-500"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Details ── */}
      {detailRows.length > 0 && (
        <div className="card divide-y divide-cream-100">
          {detailRows.map(({ icon: Icon, label, value, field }) => (
            <div key={label} className="flex gap-3.5 px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sea-100 text-sea-700">
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                  {label}
                </p>
                {editing && field && editing.field === field ? (
                  <div className="mt-1">
                    <textarea
                      value={editing.value}
                      onChange={(e) =>
                        setEditing({ field, value: e.target.value })
                      }
                      rows={3}
                      autoFocus
                      className="field leading-relaxed"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={saveField}
                        disabled={savingField}
                        className="btn-primary px-4 py-1.5 text-sm"
                      >
                        {savingField ? "שומר…" : "שמירה"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="btn-soft px-4 py-1.5 text-sm"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 whitespace-pre-line leading-relaxed text-ink-900">
                    {value}
                  </p>
                )}
              </div>
              {field && editing?.field !== field && (
                <button
                  type="button"
                  onClick={() => setEditing({ field, value })}
                  aria-label={`עריכת ${label}`}
                  className="self-start p-1 text-ink-300"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(place.website || place.bookingUrl) && (
        <div className="flex gap-2">
          {place.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline flex-1 py-3"
            >
              <Globe size={17} />
              אתר רשמי
            </a>
          )}
          {place.bookingUrl && (
            <a
              href={place.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline flex-1 py-3"
            >
              <Ticket size={17} />
              הזמנת כרטיסים
            </a>
          )}
        </div>
      )}

      {/* ── Scheduled ── */}
      {placeEvents.length > 0 && (
        <div>
          <h2 className="section-title mb-2 text-lg">בלוח שלנו</h2>
          <ul className="space-y-2">
            {placeEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between rounded-2xl bg-sea-100 px-4 py-3"
              >
                <span className="font-medium text-sea-700">
                  {formatDayLabel(event.day)}
                </span>
                <span dir="ltr" className="font-semibold tabular-nums text-sea-700">
                  {event.startTime}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Delete (parents only) ── */}
      {canDelete && (
      <div className="pt-2">
        {confirmDelete ? (
          <div className="card border-terra-400 p-4 text-center">
            <p className="mb-3 text-sm font-medium text-ink-700">
              להסיר את ״{place.name}״ מהמקומות של הקבוצה?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                className="btn bg-terra-600 px-6 py-2.5 text-sm text-cream-50"
              >
                כן, להסיר
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-soft px-6 py-2.5 text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn w-full border border-terra-100 py-3 font-medium text-terra-600"
          >
            <Trash2 size={17} />
            הסרת המקום מהרשימה
          </button>
        )}
      </div>
      )}

      <SchedulePlaceSheet
        place={place}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
      <AddToPollSheet
        open={pollSheetOpen}
        onClose={() => setPollSheetOpen(false)}
        label={place.name}
        placeId={place.id}
        onAdded={() => setPollAdded(true)}
      />
    </div>
  );
}
