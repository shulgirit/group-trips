"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX, ChevronLeft, Trash2 } from "lucide-react";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { EventGlyphPicker } from "@/components/events/EventGlyphPicker";
import { STROKE } from "@/components/ui/Icon";
import { useDayLabel, useT } from "@/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { deleteEvent, updateEvent } from "@/lib/db";
import { useDocData, useFamilies, usePlaces } from "@/lib/hooks";
import { useTrip } from "@/components/providers/TripProvider";
import { todayIso, tripDays } from "@/lib/trip";
import type { Participants, TripEvent } from "@/types";

export default function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { prefix } = useTrip();
  const t = useT();
  const formatDayLabel = useDayLabel();
  const { eventId } = use(params);
  const router = useRouter();
  const days = tripDays(useTrip());
  const today = todayIso();

  const { data: event, loading } = useDocData<TripEvent>(
    `${useTrip().path}/events/${eventId}`
  );
  const { families } = useFamilies();
  const { places } = usePlaces();

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [day, setDay] = useState(days[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participants>({
    type: "all",
  });
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  // Prefill once from the live document
  useEffect(() => {
    if (!event || loaded) return;
    setTitle(event.title);
    setEmoji(event.emoji ?? "");
    setPlaceId(event.placeId ?? "");
    setDay(event.day);
    setStartTime(event.startTime);
    setDurationMin(event.durationMin ?? null);
    setParticipants(event.participants);
    setNotes(event.notes ?? "");
    setLoaded(true);
  }, [event, loaded]);

  if (loading || (event && !loaded)) return <ListSkeleton rows={4} />;

  if (!event) {
    return (
      <EmptyState
        icon={CalendarX}
        title={t("trip.eventForm.notFoundTitle")}
        description={t("trip.eventForm.notFoundDescription")}
        action={
          <Link href={`${prefix}/calendar`} className="btn-primary px-5 py-2.5 text-sm">
            {t("trip.eventForm.toSchedule")}
          </Link>
        }
      />
    );
  }

  const participantsInvalid =
    (participants.type === "families" && !participants.familyIds.length) ||
    (participants.type === "members" && !participants.memberIds.length);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (saving || !title.trim() || participantsInvalid) return;
    setSaving(true);
    setError("");
    try {
      await updateEvent(eventId, {
        title,
        emoji: emoji || undefined,
        placeId: placeId || null,
        day,
        startTime,
        durationMin,
        participants,
        notes: notes.trim() || undefined,
      });
      router.push(`${prefix}/calendar`);
    } catch {
      setError(t("common.errors.saveFailed"));
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteEvent(eventId);
    router.replace(`${prefix}/calendar`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-200 text-ink-700"
        >
          <ChevronLeft size={20} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
        </button>
        <h1 className="font-display text-2xl font-light text-ink-900">
          {t("trip.eventForm.editTitle")}
        </h1>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("trip.eventForm.what")}
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="field py-3.5 text-lg"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.eventForm.icon")}</p>
        <EventGlyphPicker value={emoji} onChange={setEmoji} />
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("trip.eventForm.linkedPlace")}
        </span>
        <select
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          className="field"
        >
          <option value="">{t("trip.eventForm.noPlace")}</option>
          {places?.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.schedule.whichDay")}</p>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2 pb-1">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={`chip ${day === d ? "chip-active" : ""}`}
              >
                {formatDayLabel(d)}
                {d === today && ` · ${t("common.today")}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="mb-2 block text-sm font-medium text-ink-700">
            {t("trip.schedule.time")}
          </span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="field"
          />
        </label>
        <label className="flex-1">
          <span className="mb-2 block text-sm font-medium text-ink-700">
            {t("trip.eventForm.durationMinutes")}
          </span>
          <input
            type="number"
            min={15}
            step={15}
            value={durationMin ?? ""}
            onChange={(e) =>
              setDurationMin(e.target.value ? Number(e.target.value) : null)
            }
            placeholder={t("trip.eventForm.open")}
            className="field"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.schedule.whoComes")}</p>
        {families ? (
          <ParticipantsPicker
            value={participants}
            onChange={setParticipants}
            families={families}
          />
        ) : (
          <p className="text-sm text-ink-500">{t("common.loading")}</p>
        )}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("trip.eventForm.notes")}
        </span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-terra-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !title.trim() || participantsInvalid}
        className="btn-primary w-full py-3.5 text-base"
      >
        {saving ? t("common.saving") : t("trip.eventForm.saveChanges")}
      </button>

      <div className="pt-1 text-center">
        {confirmDelete ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="btn bg-terra-600 px-5 py-2.5 text-sm text-cream-50"
            >
              {t("trip.eventForm.confirmDelete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn-soft px-5 py-2.5 text-sm"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn inline-flex border border-cream-200 px-5 py-2.5 text-sm text-terra-600"
          >
            <Trash2 size={16} strokeWidth={STROKE} aria-hidden />
            {t("trip.eventForm.delete")}
          </button>
        )}
      </div>
    </form>
  );
}
