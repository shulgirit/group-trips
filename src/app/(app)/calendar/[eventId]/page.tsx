"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { deleteEvent, updateEvent } from "@/lib/db";
import { useDocData, useFamilies, usePlaces, TRIP_PATH } from "@/lib/hooks";
import { formatDayLabel, todayIso, tripDays } from "@/lib/trip";
import type { Participants, TripEvent } from "@/types";

const EMOJI_OPTIONS = ["🍝", "🏖️", "🏊", "⚽", "🛒", "🚗", "🏡", "🎉", "☕", "✈️"];

export default function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const days = tripDays();
  const today = todayIso();

  const { data: event, loading } = useDocData<TripEvent>(
    `${TRIP_PATH}/events/${eventId}`
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
        emoji="🤷"
        title="האירוע לא נמצא"
        description="אולי הוא נמחק"
        action={
          <Link href="/calendar" className="btn-primary px-5 py-2.5 text-sm">
            ללוח הטיול
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
      router.push("/calendar");
    } catch {
      setError("השמירה נכשלה, נסו שוב");
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteEvent(eventId);
    router.replace("/calendar");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="חזרה"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-100 text-ink-700"
        >
          <ChevronRight size={20} />
        </button>
        <h1 className="font-display text-2xl font-bold text-ink-900">
          עריכת אירוע
        </h1>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          מה עושים? *
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
        <p className="mb-2 text-sm font-medium text-ink-700">אימוג׳י</p>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(emoji === option ? "" : option)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition ${
                emoji === option ? "bg-sea-700" : "bg-cream-100"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          מקום מקושר (קובע גם את התמונה)
        </span>
        <select
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          className="field"
        >
          <option value="">בלי מקום</option>
          {places?.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">באיזה יום?</p>
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
            className="field"
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
            className="field"
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
          הערות
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
        className="btn-primary w-full py-3.5 text-lg"
      >
        {saving ? "שומר…" : "שמירת שינויים"}
      </button>

      <div className="pt-1 text-center">
        {confirmDelete ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="btn bg-terra-600 px-5 py-2.5 text-sm text-cream-50"
            >
              כן, למחוק את האירוע
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn-soft px-5 py-2.5 text-sm"
            >
              ביטול
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn inline-flex border border-terra-100 px-5 py-2.5 text-sm font-medium text-terra-600"
          >
            <Trash2 size={16} />
            מחיקת האירוע
          </button>
        )}
      </div>
    </form>
  );
}
