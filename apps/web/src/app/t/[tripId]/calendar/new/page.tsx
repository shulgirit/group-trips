"use client";

import { STROKE } from "@/components/ui/Icon";

import { ChevronLeft } from "lucide-react";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { EventGlyphPicker } from "@/components/events/EventGlyphPicker";
import { DurationChips } from "@/components/events/DurationChips";
import { useDayLabel, useT } from "@/i18n";
import { addEvent } from "@/lib/db";
import { useFamilies, usePlaces } from "@/lib/hooks";
import { todayIso, tripDays } from "@together/shared/trip";
import type { Participants } from "@together/shared/types";
import { useTrip } from "@/components/providers/TripProvider";

function NewEventForm() {
  const { prefix } = useTrip();
  const t = useT();
  const formatDayLabel = useDayLabel();
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = tripDays(useTrip());
  const today = todayIso();
  const requestedDay = searchParams.get("day");

  const { families } = useFamilies();
  const { places } = usePlaces();

  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [emoji, setEmoji] = useState("");
  const [placeId, setPlaceId] = useState(searchParams.get("placeId") ?? "");
  const [day, setDay] = useState(
    requestedDay && days.includes(requestedDay)
      ? requestedDay
      : days.includes(today)
        ? today
        : days[0]
  );
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participants>({
    type: "all",
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const participantsInvalid =
    (participants.type === "families" && !participants.familyIds.length) ||
    (participants.type === "members" && !participants.memberIds.length);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !title.trim() || participantsInvalid) return;
    setSaving(true);
    setError("");
    try {
      await addEvent({
        title,
        emoji: emoji || undefined,
        placeId: placeId || null,
        day,
        startTime,
        durationMin,
        participants,
        notes: notes.trim() || undefined,
      });
      router.replace(`${prefix}/calendar`);
    } catch {
      setError(t("common.errors.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-cream-200 bg-white text-ink-700"
        >
          <ChevronLeft size={20} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
        </button>
        <h1 className="font-display text-2xl font-medium text-ink-900">
          {t("trip.eventForm.newTitle")}
        </h1>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("trip.eventForm.what")}
        </span>
        <input
          type="text"
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("trip.eventForm.whatPlaceholder")}
          required
          className="field py-3.5 text-lg"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.eventForm.icon")}</p>
        <EventGlyphPicker value={emoji} onChange={setEmoji} />
      </div>

      {(places?.length ?? 0) > 0 && (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-700">
            {t("trip.eventForm.placeOptional")}
          </span>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className="field"
          >
            <option value="">{t("trip.eventForm.noPlace")}</option>
            {places!.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
      )}

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

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("trip.schedule.time")}
        </span>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="field max-w-[12rem] text-lg tabular-nums"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.eventForm.duration")}</p>
        <DurationChips value={durationMin} onChange={setDurationMin} />
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
          {t("trip.schedule.notes")}
        </span>
        <input
          type="text"
          dir="auto"
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
        className="btn-primary sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 w-full py-3.5 text-base shadow-[var(--shadow-float)] lg:bottom-6 disabled:bg-cream-300 disabled:text-ink-500 disabled:opacity-100"
      >
        {saving ? t("common.saving") : t("trip.schedule.submit")}
      </button>
    </form>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={null}>
      <NewEventForm />
    </Suspense>
  );
}
