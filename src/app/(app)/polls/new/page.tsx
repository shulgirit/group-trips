"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPoll } from "@/lib/db";
import { usePlaces } from "@/lib/hooks";
import { PLACE_CATEGORIES } from "@/types";

let optionCounter = 0;

interface DraftOption {
  id: string;
  label: string;
  placeId: string | null;
}

export default function NewPollPage() {
  const router = useRouter();
  const { places } = usePlaces();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<DraftOption[]>([]);
  const [freeText, setFreeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedPlaceIds = new Set(
    options.map((o) => o.placeId).filter(Boolean)
  );

  function togglePlace(placeId: string, name: string) {
    setOptions((current) =>
      selectedPlaceIds.has(placeId)
        ? current.filter((o) => o.placeId !== placeId)
        : [...current, { id: `opt-${optionCounter++}`, label: name, placeId }]
    );
  }

  function addFreeOption() {
    const label = freeText.trim();
    if (!label) return;
    setOptions((current) => [
      ...current,
      { id: `opt-${optionCounter++}`, label, placeId: null },
    ]);
    setFreeText("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !question.trim() || options.length < 2) return;
    setSaving(true);
    setError("");
    try {
      await addPoll({ question, options });
      router.replace("/polls");
    } catch {
      setError("השמירה נכשלה, נסו שוב");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink-900">סקר חדש</h1>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          מה השאלה? *
        </span>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="למשל: מה עושים ביום שני?"
          required
          className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
        />
      </label>

      {(places?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">
            בחרו מקומות כאפשרויות
          </p>
          <div className="flex flex-wrap gap-2">
            {places!.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => togglePlace(place.id, place.name)}
                className={`rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                  selectedPlaceIds.has(place.id)
                    ? "bg-sea-600 text-cream-50"
                    : "bg-cream-100 text-ink-700"
                }`}
              >
                {PLACE_CATEGORIES[place.category]?.emoji} {place.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">
          או אפשרות חופשית
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFreeOption();
              }
            }}
            placeholder="למשל: יום בריכה בוילה"
            className="flex-1 rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
          />
          <button
            type="button"
            onClick={addFreeOption}
            disabled={!freeText.trim()}
            className="rounded-2xl bg-cream-100 px-4 font-semibold text-ink-700 disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>

      {options.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">
            האפשרויות בסקר ({options.length})
          </p>
          <ul className="space-y-1.5">
            {options.map((option) => (
              <li
                key={option.id}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-2.5 border border-cream-200"
              >
                <span className="text-ink-900">{option.label}</span>
                <button
                  type="button"
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((o) => o.id !== option.id)
                    )
                  }
                  aria-label={`הסרת ${option.label}`}
                  className="text-ink-300"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-terra-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !question.trim() || options.length < 2}
        className="w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "יוצר…" : "פתח סקר 🗳️"}
      </button>
      {options.length < 2 && (
        <p className="text-center text-sm text-ink-500">
          צריך לפחות שתי אפשרויות
        </p>
      )}
    </form>
  );
}
