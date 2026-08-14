"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { useFamilies } from "@/lib/hooks";
import { addEvent } from "@/lib/db";
import { tripDays, todayIso, formatDayLabel } from "@/lib/trip";
import { PLACE_CATEGORIES, type Participants, type Place } from "@/types";

const DURATIONS = [
  { minutes: null, label: "בלי הגבלה" },
  { minutes: 60, label: "שעה" },
  { minutes: 90, label: "שעה וחצי" },
  { minutes: 120, label: "שעתיים" },
  { minutes: 180, label: "3 שעות" },
  { minutes: 300, label: "5 שעות" },
] as const;

export function SchedulePlaceSheet({
  place,
  open,
  onClose,
}: {
  place: Place;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { families } = useFamilies();
  const days = tripDays();
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
        emoji: PLACE_CATEGORIES[place.category]?.emoji,
        placeId: place.id,
        day,
        startTime,
        durationMin,
        participants,
        notes: notes.trim() || undefined,
      });
      onClose();
      router.push("/calendar");
    } catch {
      setError("השמירה נכשלה, נסו שוב");
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`מתי הולכים ל${place.name}?`}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">באיזה יום?</p>
          <div className="-mx-5 overflow-x-auto px-5">
            <div className="flex w-max gap-2 pb-1">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                    day === d
                      ? "bg-sea-600 text-cream-50"
                      : "bg-cream-100 text-ink-700"
                  }`}
                >
                  {formatDayLabel(d)}
                  {d === today && " · היום"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-ink-700">
              שעה
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none focus:border-sea-500"
            />
          </label>
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-ink-700">
              כמה זמן?
            </span>
            <select
              value={durationMin ?? ""}
              onChange={(e) =>
                setDurationMin(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none focus:border-sea-500"
            >
              {DURATIONS.map(({ minutes, label }) => (
                <option key={label} value={minutes ?? ""}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">מי מגיע?</p>
          {families ? (
            <ParticipantsPicker
              value={participants}
              onChange={setParticipants}
              families={families}
            />
          ) : (
            <p className="text-sm text-ink-500">טוען משפחות…</p>
          )}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-700">
            הערות (לא חובה)
          </span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="למשל: להזמין כרטיסים מראש"
            className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
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
          className="w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "שומר…" : "הוסף ללוח 📅"}
        </button>
      </div>
    </BottomSheet>
  );
}
