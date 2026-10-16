"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { useFamilies } from "@/lib/hooks";
import { addEvent } from "@/lib/db";
import { tripDays, todayIso } from "@/lib/trip";
import type { Participants, Place } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { useDayLabel, useT, type TKey } from "@/i18n";

const DURATIONS: { minutes: number | null; labelKey: TKey }[] = [
  { minutes: null, labelKey: "trip.durations.none" },
  { minutes: 60, labelKey: "trip.durations.60" },
  { minutes: 90, labelKey: "trip.durations.90" },
  { minutes: 120, labelKey: "trip.durations.120" },
  { minutes: 180, labelKey: "trip.durations.180" },
  { minutes: 300, labelKey: "trip.durations.300" },
];

export function SchedulePlaceSheet({
  place,
  open,
  onClose,
}: {
  place: Place;
  open: boolean;
  onClose: () => void;
}) {
  const { prefix } = useTrip();
  const t = useT();
  const formatDayLabel = useDayLabel();
  const router = useRouter();
  const { families } = useFamilies();
  const days = tripDays(useTrip());
  const today = todayIso();

  const [day, setDay] = useState(days.includes(today) ? today : days[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState<number | null>(120);
  const [participants, setParticipants] = useState<Participants>({
    type: "all",
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const participantsInvalid =
    (participants.type === "families" && !participants.familyIds.length) ||
    (participants.type === "members" && !participants.memberIds.length);

  async function handleSave() {
    if (saving || participantsInvalid) return;
    setSaving(true);
    setError("");
    try {
      await addEvent({
        title: place.name,
        placeId: place.id,
        day,
        startTime,
        durationMin,
        participants,
        notes: notes.trim() || undefined,
      });
      onClose();
      router.push(`${prefix}/calendar`);
    } catch {
      setError(t("common.errors.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("trip.schedule.title", { name: place.name })}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.schedule.whichDay")}</p>
          <div className="-mx-5 overflow-x-auto px-5">
            <div className="flex w-max gap-2 pb-1">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm transition ${
                    day === d
                      ? "border-sea-900 bg-sea-900 text-cream-50"
                      : "border-cream-200 bg-white text-ink-700"
                  }`}
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
              {t("trip.schedule.howLong")}
            </span>
            <select
              value={durationMin ?? ""}
              onChange={(e) =>
                setDurationMin(e.target.value ? Number(e.target.value) : null)
              }
              className="field"
            >
              {DURATIONS.map(({ minutes, labelKey }) => (
                <option key={labelKey} value={minutes ?? ""}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
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
            placeholder={t("trip.schedule.notesPlaceholder")}
            className="field"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-terra-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || participantsInvalid}
          className="btn-primary w-full py-3.5 text-base"
        >
          {saving ? t("common.saving") : t("trip.schedule.submit")}
        </button>
      </div>
    </BottomSheet>
  );
}
