"use client";

import { RouteArt } from "@/components/journal/RouteArt";
import { usePlacePhoto } from "@/lib/place-photo";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Euro,
  Globe,
  Heart,
  Hourglass,
  Lightbulb,
  Link2,
  Map as MapIcon,
  MapPin,
  MapPinOff,
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
import { isPersonalUser, apiFetch } from "@/lib/firebase/client";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { deletePlace, updatePlace } from "@/lib/db";
import { useEvents, usePlace } from "@/lib/hooks";
import { googleMapsUrl, wazeUrl } from "@/lib/nav";
import { useTrip } from "@/components/providers/TripProvider";
import { STROKE } from "@/components/ui/Icon";
import { useDayLabel, useT } from "@/i18n";

export default function PlaceDetailPage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { prefix, id: tripId } = useTrip();
  const t = useT();
  const formatDayLabel = useDayLabel();
  const { placeId } = use(params);
  const router = useRouter();
  const { user } = useFirebase();
  // Deleting places is a parents-only action (Google accounts) —
  // also enforced server-side in the security rules
  const canDelete = isPersonalUser(user);
  const { place, loading } = usePlace(placeId);
  usePlacePhoto(tripId, place);
  const { events } = useEvents();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Arriving from "new place" with ?schedule=1 → jump straight to scheduling
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
      const response = await apiFetch("/api/import/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          url ? { placeId, url, tripId } : { placeId, tripId }
        ),
      });
      const result = await response.json();
      if (result.ok) {
        setEnrichMessage(t("trip.place.enrichDone"));
        setShowUrlInput(false);
        setEnrichUrl("");
      } else {
        setEnrichMessage(result.message ?? t("trip.place.enrichNothing"));
        // Nothing found automatically — offer the manual link right here
        setShowUrlInput(true);
      }
    } catch {
      setEnrichMessage(t("trip.place.enrichFailed"));
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
        icon={MapPinOff}
        title={t("trip.place.notFoundTitle")}
        description={t("trip.place.notFoundDescription")}
        action={
          <Link href={`${prefix}/places`} className="btn-primary px-5 py-2.5 text-sm">
            {t("trip.place.allPlaces")}
          </Link>
        }
      />
    );
  }

  const categoryLabel = t(`trip.categories.${place.category}`);
  const placeEvents = (events ?? []).filter((e) => e.placeId === place.id);

  const detailRows = [
    place.address && {
      icon: MapPin,
      label: t("trip.place.fields.address"),
      value: place.address,
      field: "address",
    },
    place.openingHours && {
      icon: Clock,
      label: t("trip.place.fields.openingHours"),
      value: place.openingHours,
      field: "openingHours",
    },
    place.priceNotes && {
      icon: Euro,
      label: t("trip.place.fields.price"),
      value: place.priceNotes,
      field: "priceNotes",
    },
    place.recommendedDurationMin && {
      icon: Hourglass,
      label: t("trip.place.fields.recommendedTime"),
      value: t("trip.place.aboutHours", { count: Math.round(place.recommendedDurationMin / 60) }),
      field: null,
    },
    place.tips && {
      icon: Lightbulb,
      label: t("trip.place.fields.tips"),
      value: place.tips,
      field: "tips",
    },
    place.popularDishes && {
      icon: UtensilsCrossed,
      label: t("trip.place.fields.dishes"),
      value: place.popularDishes,
      field: "popularDishes",
    },
    place.reviewsSummary && {
      icon: Star,
      label: t("trip.place.fields.reviews"),
      value: place.reviewsSummary,
      field: "reviewsSummary",
    },
    place.createdByName && {
      icon: UserRound,
      label: t("trip.place.fields.addedBy"),
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
    router.replace(`${prefix}/places`);
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
          <RouteArt seed={place.id} focus="top" />
        )}
        <div className="hero-overlay absolute inset-0" />

        {/* Floating navigation */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="absolute start-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50/90 text-ink-700 backdrop-blur"
        >
          <ChevronLeft size={22} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => updatePlace(placeId, { favorite: !place.favorite })}
          aria-label={place.favorite ? t("trip.place.unfavorite") : t("trip.place.favorite")}
          aria-pressed={Boolean(place.favorite)}
          className="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50/90 backdrop-blur"
        >
          <Heart
            size={19}
            strokeWidth={STROKE}
            aria-hidden
            className={
              place.favorite ? "fill-terra-500 text-terra-500" : "text-ink-500"
            }
          />
        </button>

        {/* Title over image */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <p className="kicker text-lemon-200">
            {categoryLabel}
            {place.area ? ` · ${place.area}` : ""}
          </p>
          <h1 className="mt-2 font-display text-3xl font-light leading-tight text-cream-50">
            <bdi>{place.name}</bdi>
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
          <Compass size={19} strokeWidth={STROKE} aria-hidden />
          {t("trip.home.navigate")}
        </a>
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="btn-accent flex-1 py-3.5"
        >
          <CalendarPlus size={19} strokeWidth={STROKE} aria-hidden />
          {t("trip.place.addToSchedule")}
        </button>
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Google Maps"
          className="btn-outline px-4 py-3.5"
        >
          <MapIcon size={19} strokeWidth={STROKE} aria-hidden />
        </a>
      </div>

      <button
        type="button"
        onClick={() => setPollSheetOpen(true)}
        className={`w-full py-3 ${
          pollAdded
            ? "btn border border-lemon-300 bg-white text-ink-700"
            : "btn-outline"
        }`}
      >
        {pollAdded ? (
          <Check size={18} strokeWidth={STROKE} aria-hidden />
        ) : (
          <Vote size={18} strokeWidth={STROKE} aria-hidden />
        )}
        {pollAdded ? t("trip.place.pollAdded") : t("trip.place.addToPoll")}
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
          <Sparkles size={18} strokeWidth={STROKE} aria-hidden />
          {enriching
            ? t("trip.place.enriching")
            : !place.summary && detailRows.length < 2
              ? t("trip.place.enrichAdd")
              : t("trip.place.enrichRefresh")}
        </button>
        {enrichMessage && (
          <p className="mt-2 rounded-xl border border-cream-200 px-4 py-2.5 text-sm text-ink-700">
            {enrichMessage}
          </p>
        )}
        {!showUrlInput ? (
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm text-sea-700"
          >
            <Link2 size={15} strokeWidth={STROKE} aria-hidden />
            {t("trip.place.pasteLink")}
            <ChevronRight size={15} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
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
                  setEnrichMessage(t("trip.place.fullLinkNeeded"));
                  return;
                }
                handleEnrich(url);
              }}
              disabled={enriching || !enrichUrl.trim()}
              className="btn-primary whitespace-nowrap px-4 py-2.5 text-sm"
            >
              {enriching ? t("trip.place.reading") : t("trip.place.readLink")}
            </button>
          </div>
        )}
      </div>

      {/* ── Editorial summary ── */}
      {place.summary && (
        <div className="relative rounded-2xl border border-cream-200 bg-white px-5 py-5">
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
                  {savingField ? t("common.saving") : t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="btn-soft px-4 py-2 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-line border-s border-lemon-400 pe-6 ps-4 leading-relaxed text-ink-700">
                {place.summary}
              </p>
              <button
                type="button"
                onClick={() =>
                  setEditing({ field: "summary", value: place.summary ?? "" })
                }
                aria-label={t("trip.place.editSummary")}
                className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-300"
              >
                <Pencil size={14} strokeWidth={STROKE} aria-hidden />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Details ── */}
      {detailRows.length > 0 && (
        <div className="card divide-y divide-cream-200">
          {detailRows.map(({ icon: Icon, label, value, field }) => (
            <div key={label} className="flex gap-3.5 px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-sea-700">
                <Icon size={17} strokeWidth={STROKE} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs tracking-wide text-ink-500">
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
                        {savingField ? t("common.saving") : t("common.save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="btn-soft px-4 py-1.5 text-sm"
                      >
                        {t("common.cancel")}
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
                  aria-label={t("trip.place.editField", { label })}
                  className="self-start p-1 text-ink-300"
                >
                  <Pencil size={14} strokeWidth={STROKE} aria-hidden />
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
              <Globe size={17} strokeWidth={STROKE} aria-hidden />
              {t("trip.place.website")}
            </a>
          )}
          {place.bookingUrl && (
            <a
              href={place.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline flex-1 py-3"
            >
              <Ticket size={17} strokeWidth={STROKE} aria-hidden />
              {t("trip.place.tickets")}
            </a>
          )}
        </div>
      )}

      {/* ── Scheduled ── */}
      {placeEvents.length > 0 && (
        <div>
          <h2 className="section-title mb-3 text-lg">{t("trip.place.onSchedule")}</h2>
          <ul className="space-y-2">
            {placeEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between rounded-xl border border-cream-200 bg-white px-4 py-3"
              >
                <span className="text-ink-900">
                  {formatDayLabel(event.day)}
                </span>
                <span dir="ltr" className="numerals text-sea-700">
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
              {t("trip.place.confirmDelete", { name: place.name })}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                className="btn bg-terra-600 px-6 py-2.5 text-sm text-cream-50"
              >
                {t("trip.place.confirmDeleteYes")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-soft px-6 py-2.5 text-sm"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn w-full border border-cream-200 py-3 text-terra-600"
          >
            <Trash2 size={17} strokeWidth={STROKE} aria-hidden />
            {t("trip.place.delete")}
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
