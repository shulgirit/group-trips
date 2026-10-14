"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { EventGlyphPicker } from "@/components/events/EventGlyphPicker";
import { useDayLabel, useT } from "@/i18n";
import { addEvent } from "@/lib/db";
import { useFamilies, usePlaces } from "@/lib/hooks";
import { todayIso, tripDays } from "@/lib/trip";
import type { Participants } from "@/types";
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
      <h1 className="font-display text-2xl font-light text-ink-900">
        {t("trip.eventForm.newTitle")}
      </h1>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("trip.eventForm.what")}
        </span>
        <input
          type="text"
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
          {t("trip.schedule.notes")}
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
