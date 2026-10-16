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
import { googleMapsUrl, wazeUrl } from "@together/shared/nav";
import { useTrip } from "@/components/providers/TripProvider";
import { stopForDay } from "@together/shared/trip-doc";
import { STROKE } from "@/components/ui/Icon";
import { useDayLabel, useT } from "@/i18n";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]";

/** One quiet icon-over-label action in the tertiary row. */
function QuietAction({
  icon: Icon,
  label,
  onClick,
  href,
  pressed,
  tone = "default",
  iconClassName = "",
}: {
  icon: typeof Heart;
  label: string;
  onClick?: () => void;
  href?: string;
  pressed?: boolean;
  tone?: "default" | "danger";
  iconClassName?: string;
}) {
  const className = `flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-xs transition active:bg-cream-100 ${
    tone === "danger" ? "text-terra-600" : pressed ? "text-ink-900" : "text-ink-500"
  }`;
  const content = (
    <>
      <Icon size={19} strokeWidth={STROKE} aria-hidden className={iconClassName} />
      <span className="max-w-full truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={className}>
      {content}
    </button>
  );
}

export default function PlaceDetailPage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const trip = useTrip();
  const { prefix, id: tripId } = trip;
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
  const [enrichPanel, setEnrichPanel] = useState(false);
  const [editMode, setEditMode] = useState(false);
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
    setEnrichPanel(true);
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
  const placeEvents = (events ?? [])
    .filter((e) => e.placeId === place.id)
    .sort((a, b) => (a.day + a.startTime).localeCompare(b.day + b.startTime));
  // Ambiguous addresses resolve inside the stop where we'll actually be
  const region = placeEvents.length
    ? stopForDay(trip.stops, placeEvents[0].day).region
    : trip.searchRegionHint;

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

  const sparse = !place.summary && detailRows.length < 2;

  async function handleDelete() {
    await deletePlace(placeId);
    router.replace(`${prefix}/places`);
  }

  const editor = (field: string, rows: number) =>
    editing && editing.field === field ? (
      <div className="mt-1">
        <textarea
          value={editing.value}
          dir="auto"
          onChange={(e) => setEditing({ field, value: e.target.value })}
          rows={rows}
          autoFocus
          className="field leading-relaxed"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={saveField}
            disabled={savingField}
            className="btn-primary min-h-11 px-4 py-2 text-sm"
          >
            {savingField ? t("common.saving") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="btn-soft min-h-11 px-4 py-2 text-sm"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    ) : null;

  const urlForm = !showUrlInput ? (
    <button
      type="button"
      onClick={() => setShowUrlInput(true)}
      className="flex min-h-11 w-full items-center gap-1.5 py-2 text-start text-sm text-ink-700"
    >
      <Link2 size={15} strokeWidth={STROKE} aria-hidden className="shrink-0" />
      <span className="min-w-0">{t("trip.place.pasteLink")}</span>
      <ChevronRight size={15} strokeWidth={STROKE} aria-hidden className="shrink-0 rtl:rotate-180" />
    </button>
  ) : (
    <div className="flex gap-2">
      <input
        type="url"
        dir="ltr"
        value={enrichUrl}
        onChange={(event) => setEnrichUrl(event.target.value)}
        placeholder="https://…"
        aria-label={t("trip.place.pasteLink")}
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
        className="btn-primary min-h-11 whitespace-nowrap px-4 py-2.5 text-sm"
      >
        {enriching ? t("trip.place.reading") : t("trip.place.readLink")}
      </button>
    </div>
  );

  const enrichStatus = (enriching || enrichMessage) && (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl bg-cream-100 px-4 py-2.5 text-sm text-ink-700"
    >
      <Sparkles size={15} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-brass-500" />
      {enriching ? t("trip.place.enriching") : enrichMessage}
    </p>
  );

  return (
    <div className="space-y-5">
      {/* ── Immersive hero ── */}
      <div className="relative -mx-4 -mt-4 h-72 overflow-hidden md:mx-0 md:mt-0 md:h-80 md:rounded-[2rem]">
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={place.name}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        ) : (
          <RouteArt seed={place.id} focus="top" />
        )}
        <div className="hero-overlay absolute inset-0" />

        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="absolute start-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50/90 text-ink-700 backdrop-blur"
        >
          <ChevronLeft size={22} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
        </button>
        {place.favorite && (
          <span className="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-50/90 backdrop-blur">
            <Heart size={18} strokeWidth={STROKE} aria-hidden className="fill-terra-500 text-terra-500" />
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <p className="kicker text-cream-100/85">
            {categoryLabel}
            {place.area ? (
              <>
                {" · "}
                <bdi>{place.area}</bdi>
              </>
            ) : null}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-light leading-tight text-cream-50">
            <bdi>{place.name}</bdi>
          </h1>
        </div>
      </div>

      {/* ── Primary + secondary actions ── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr]">
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <a
            href={wazeUrl(place, region)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary min-h-12 flex-1 py-3.5 text-base"
          >
            <Compass size={19} strokeWidth={STROKE} aria-hidden />
            {t("trip.home.navigate")}
          </a>
          <a
            href={googleMapsUrl(place, region)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Google Maps"
            className="btn-outline min-h-12 w-12 shrink-0"
          >
            <MapIcon size={19} strokeWidth={STROKE} aria-hidden />
          </a>
        </div>
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="btn-outline min-h-12 px-3 py-3 text-sm"
        >
          <CalendarPlus size={17} strokeWidth={STROKE} aria-hidden className="shrink-0" />
          <span className="truncate">{t("trip.place.addToSchedule")}</span>
        </button>
        <button
          type="button"
          onClick={() => setPollSheetOpen(true)}
          className={`btn-outline min-h-12 px-3 py-3 text-sm ${pollAdded ? "border-route-300" : ""}`}
        >
          {pollAdded ? (
            <Check size={17} strokeWidth={STROKE} aria-hidden className="shrink-0 text-route-700" />
          ) : (
            <Vote size={17} strokeWidth={STROKE} aria-hidden className="shrink-0" />
          )}
          <span className="truncate">
            {pollAdded ? t("trip.place.pollAdded") : t("trip.place.addToPoll")}
          </span>
        </button>
      </div>

      {/* ── Tertiary, quiet row ── */}
      <div className="flex items-stretch justify-between gap-1 border-y border-cream-200 py-1">
        <QuietAction
          icon={Heart}
          label={t("trip.place.actions.favorite")}
          onClick={() => updatePlace(placeId, { favorite: !place.favorite })}
          pressed={Boolean(place.favorite)}
          iconClassName={place.favorite ? "fill-terra-500 text-terra-500" : ""}
        />
        {place.website && (
          <QuietAction icon={Globe} label={t("trip.place.actions.website")} href={place.website} />
        )}
        {place.bookingUrl && (
          <QuietAction icon={Ticket} label={t("trip.place.actions.tickets")} href={place.bookingUrl} />
        )}
        <QuietAction
          icon={Sparkles}
          label={t("trip.place.actions.enrich")}
          onClick={() => handleEnrich()}
          pressed={enrichPanel}
          iconClassName="text-brass-500"
        />
        <QuietAction
          icon={editMode ? Check : Pencil}
          label={editMode ? t("trip.place.actions.done") : t("trip.place.actions.edit")}
          onClick={() => {
            setEditMode((on) => !on);
            setEditing(null);
          }}
          pressed={editMode}
        />
        {canDelete && (
          <QuietAction
            icon={Trash2}
            label={t("trip.place.actions.remove")}
            onClick={() => setConfirmDelete(true)}
            tone="danger"
          />
        )}
      </div>

      {/* ── Delete confirmation (parents only) ── */}
      {canDelete && confirmDelete && (
        <div className="rounded-2xl border border-terra-200 bg-terra-100 p-4">
          <p className="mb-3 text-sm font-medium text-ink-700">
            {t("trip.place.confirmDelete", { name: place.name })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="btn-danger min-h-11 px-5 py-2.5 text-sm"
            >
              {t("trip.place.confirmDeleteYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn-outline min-h-11 px-5 py-2.5 text-sm"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* ── AI enrichment feedback (from the quiet row) ── */}
      {enrichPanel && !sparse && (
        <div className="space-y-1">
          {enrichStatus}
          {urlForm}
        </div>
      )}

      {/* ── Nothing known yet: invite the AI ── */}
      {sparse && (
        <div className={`rounded-2xl bg-white p-5 ${CARD_SHADOW}`}>
          <h2 className="font-display text-lg text-ink-900">{t("trip.place.emptyDetailsTitle")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            {t("trip.place.emptyDetailsBody")}
          </p>
          <button
            type="button"
            onClick={() => handleEnrich()}
            disabled={enriching}
            className="btn-accent mt-4 min-h-11 w-full py-3 text-sm"
          >
            <Sparkles size={16} strokeWidth={STROKE} aria-hidden />
            {enriching ? t("trip.place.enriching") : t("trip.place.enrichCta")}
          </button>
          <div className="mt-2 space-y-1">
            {!enriching && enrichMessage && enrichStatus}
            {urlForm}
          </div>
        </div>
      )}

      {editMode && (
        <p className="text-sm text-ink-500">{t("trip.place.editHint")}</p>
      )}

      {/* ── Editorial summary ── */}
      {place.summary && (
        <section>
          <h2 className="sr-only">{t("trip.place.about")}</h2>
          {editing?.field === "summary" ? (
            editor("summary", 6)
          ) : editMode ? (
            <button
              type="button"
              onClick={() => setEditing({ field: "summary", value: place.summary ?? "" })}
              aria-label={t("trip.place.editSummary")}
              className="block w-full rounded-2xl border border-dashed border-cream-300 bg-white px-4 py-3 text-start"
            >
              <p dir="auto" className="whitespace-pre-line text-[17px] leading-relaxed text-ink-700">
                {place.summary}
              </p>
            </button>
          ) : (
            <p
              dir="auto"
              className="whitespace-pre-line border-s-2 border-cream-300 ps-4 text-[17px] leading-relaxed text-ink-700"
            >
              {place.summary}
            </p>
          )}
        </section>
      )}

      {/* ── Details ── */}
      {detailRows.length > 0 && (
        <div className={`divide-y divide-cream-100 overflow-hidden rounded-2xl bg-white ${CARD_SHADOW}`}>
          {detailRows.map(({ icon: Icon, label, value, field }) => {
            const isEditing = Boolean(editing && field && editing.field === field);
            const tappable = editMode && field && !isEditing;
            const body = (
              <>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-route-700">
                  <Icon size={17} strokeWidth={STROKE} aria-hidden />
                </span>
                <span className="block min-w-0 flex-1">
                  <span className="block text-xs text-ink-500">{label}</span>
                  {isEditing && field ? (
                    editor(field, 3)
                  ) : (
                    <span dir="auto" className="mt-0.5 block whitespace-pre-line leading-relaxed text-ink-900">
                      {value}
                    </span>
                  )}
                </span>
                {tappable && (
                  <Pencil size={14} strokeWidth={STROKE} aria-hidden className="mt-1 shrink-0 text-ink-300" />
                )}
              </>
            );
            return tappable ? (
              <button
                key={label}
                type="button"
                onClick={() => setEditing({ field: field!, value })}
                aria-label={t("trip.place.editField", { label })}
                className="flex w-full gap-3.5 px-5 py-3.5 text-start transition active:bg-cream-100/60"
              >
                {body}
              </button>
            ) : (
              <div key={label} className="flex gap-3.5 px-5 py-3.5">
                {body}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scheduled ── */}
      {placeEvents.length > 0 && (
        <section>
          <h2 className="section-title mb-3">{t("trip.place.onSchedule")}</h2>
          <ul className={`divide-y divide-cream-100 overflow-hidden rounded-2xl bg-white ${CARD_SHADOW}`}>
            {placeEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`${prefix}/calendar?day=${event.day}`}
                  className="flex min-h-12 items-center gap-3 px-4 py-3 transition active:bg-cream-100/60"
                >
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-route-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink-900">{formatDayLabel(event.day)}</span>
                    {event.title && (
                      <span dir="auto" className="block truncate text-sm text-ink-500">
                        {event.title}
                      </span>
                    )}
                  </span>
                  <span dir="ltr" className="font-display text-lg text-ink-900 tabular-nums">
                    {event.startTime}
                  </span>
                  <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
