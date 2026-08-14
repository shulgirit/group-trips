"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { addEvent } from "@/lib/db";
import { useFamilies, usePlaces } from "@/lib/hooks";
import { formatDayLabel, todayIso, tripDays } from "@/lib/trip";
import type { Participants } from "@/types";

const EMOJI_OPTIONS = ["🍝", "🏖️", "🏊", "⚽", "🛒", "🚗", "🏡", "🎉", "☕", "✈️"];

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = tripDays();
  const today = todayIso();
  const requestedDay = searchParams.get("day");

  const { families } = useFamilies();
  const { places } = usePlaces();

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [placeId, setPlaceId] = useState("");
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
      router.replace("/calendar");
    } catch {
      setError("השמירה נכשלה, נסו שוב");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink-900">
        אירוע חדש
      </h1>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          מה עושים? *
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="למשל: ארוחת ערב בעיר"
          required
          className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">אימוג׳י</p>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(emoji === option ? "" : option)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition ${
                emoji === option ? "bg-sea-600" : "bg-cream-100"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {(places?.length ?? 0) > 0 && (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-700">
            קשור למקום? (לא חובה)
          </span>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none focus:border-sea-500"
          >
            <option value="">בלי מקום</option>
            {places!.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">באיזה יום?</p>
        <div className="-mx-4 overflow-x-auto px-4">
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
            משך (דקות)
          </span>
          <input
            type="number"
            min={15}
            step={15}
            value={durationMin ?? ""}
            onChange={(e) =>
              setDurationMin(e.target.value ? Number(e.target.value) : null)
            }
            placeholder="פתוח"
            className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
          />
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
          className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none focus:border-sea-500"
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
        className="w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "שומר…" : "הוסף ללוח 📅"}
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
