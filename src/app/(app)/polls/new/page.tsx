"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPoll } from "@/lib/db";
import { usePlaces } from "@/lib/hooks";
import { Plus, Vote, X } from "lucide-react";
import { useTrip } from "@/components/providers/TripProvider";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

let optionCounter = 0;

interface DraftOption {
  id: string;
  label: string;
  placeId: string | null;
}

export default function NewPollPage() {
  const { prefix } = useTrip();
  const t = useT();
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
      router.replace(`${prefix}/polls`);
    } catch {
      setError(t("common.errors.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="font-display text-3xl font-light tracking-tight text-ink-900">
        {t("polls.new.title")}
      </h1>

      <label className="block">
        <span className="mb-2 block text-sm text-ink-700">
          {t("polls.new.questionLabel")}
        </span>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("polls.new.questionPlaceholder")}
          required
          className="field py-3.5 text-lg"
        />
      </label>

      {(places?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-sm text-ink-700">
            {t("polls.new.pickPlaces")}
          </p>
          <div className="flex flex-wrap gap-2">
            {places!.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => togglePlace(place.id, place.name)}
                className={`inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-sm transition ${
                  selectedPlaceIds.has(place.id)
                    ? "border-sea-700 bg-sea-700 text-cream-50"
                    : "border-cream-200 bg-white text-ink-700"
                }`}
              >
                <CategoryIcon category={place.category} size={15} />
                <bdi>{place.name}</bdi>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm text-ink-700">
          {t("polls.new.freeOption")}
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
            placeholder={t("polls.new.freePlaceholder")}
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={addFreeOption}
            disabled={!freeText.trim()}
            aria-label={t("polls.new.addOption")}
            className="btn-soft px-4 disabled:opacity-50"
          >
            <Plus size={18} strokeWidth={STROKE} aria-hidden />
          </button>
        </div>
      </div>

      {options.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-ink-700">
            {t("polls.new.optionsCount", { count: options.length })}
          </p>
          <ul className="divide-y divide-cream-200 overflow-hidden rounded-2xl border border-cream-200 bg-white">
            {options.map((option) => (
              <li
                key={option.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-ink-900"><bdi>{option.label}</bdi></span>
                <button
                  type="button"
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((o) => o.id !== option.id)
                    )
                  }
                  aria-label={t("polls.new.removeOption", { label: option.label })}
                  className="p-1 text-ink-300"
                >
                  <X size={15} strokeWidth={STROKE} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-terra-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !question.trim() || options.length < 2}
        className="btn-primary w-full gap-2 py-3.5 text-base disabled:opacity-50"
      >
        {saving ? (
          t("polls.new.creating")
        ) : (
          <>
            <Vote size={18} strokeWidth={STROKE} aria-hidden />
            {t("polls.new.submit")}
          </>
        )}
      </button>
      {options.length < 2 && (
        <p className="text-center text-sm text-ink-500">
          {t("polls.new.minOptions")}
        </p>
      )}
    </form>
  );
}
