"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addPoll } from "@/lib/db";
import { usePlaces } from "@/lib/hooks";
import { Check, ChevronRight, Lightbulb, Plus, Vote, X } from "lucide-react";
import { useTrip } from "@/components/providers/TripProvider";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { usePlacePhoto } from "@/lib/place-photo";
import type { Place } from "@/types";
import { useT } from "@/i18n";

let optionCounter = 0;

interface DraftOption {
  id: string;
  label: string;
  placeId: string | null;
}

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]";

function PlaceTile({
  tripId,
  place,
  selected,
  onToggle,
}: {
  tripId: string;
  place: Place;
  selected: boolean;
  onToggle: () => void;
}) {
  usePlacePhoto(tripId, place);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`group relative overflow-hidden rounded-xl bg-white text-start transition active:scale-[0.98] ${
        selected ? "ring-2 ring-sea-900" : "ring-1 ring-cream-200"
      }`}
    >
      <span className="relative block aspect-[4/3] w-full">
        {place.imageUrl ? (
          <Image src={place.imageUrl} alt="" fill sizes="(min-width: 1024px) 220px, 45vw" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center bg-cream-100 text-route-700">
            <CategoryIcon category={place.category} size={24} />
          </span>
        )}
        <span
          aria-hidden
          className={`absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition ${
            selected ? "bg-sea-900 text-cream-50" : "bg-white/90 text-ink-500"
          }`}
        >
          {selected ? (
            <Check size={15} strokeWidth={2.5} />
          ) : (
            <Plus size={15} strokeWidth={STROKE} />
          )}
        </span>
      </span>
      <span className="block truncate px-3 py-2.5 text-sm font-medium text-ink-900">
        <bdi>{place.name}</bdi>
      </span>
    </button>
  );
}

export default function NewPollPage() {
  const { prefix, id: tripId } = useTrip();
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

  const placeById = new Map((places ?? []).map((p) => [p.id, p]));

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div>
        <Link
          href={`${prefix}/polls`}
          className="-ms-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-ink-500"
        >
          <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="rotate-180 rtl:rotate-0" />
          {t("polls.title")}
        </Link>
        <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
          {t("polls.new.title")}
        </h1>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("polls.new.questionLabel")}
        </span>
        <input
          type="text"
          dir="auto"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("polls.new.questionPlaceholder")}
          required
          className="field py-4 font-display text-xl"
        />
      </label>

      {(places?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ink-700">{t("polls.new.pickPlaces")}</h2>
          <p className="mt-0.5 text-xs text-ink-500">{t("polls.new.pickPlacesHint")}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {places!.map((place) => (
              <PlaceTile
                key={place.id}
                tripId={tripId}
                place={place}
                selected={selectedPlaceIds.has(place.id)}
                onToggle={() => togglePlace(place.id, place.name)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink-700">
          {t("polls.new.freeOption")}
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            dir="auto"
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
            className="btn-soft min-h-12 w-12 shrink-0"
          >
            <Plus size={18} strokeWidth={STROKE} aria-hidden />
          </button>
        </div>
      </section>

      <section className={`rounded-2xl bg-white p-4 ${CARD_SHADOW}`}>
        <h2 className="text-sm font-medium text-ink-700">
          {t("polls.new.optionsCount", { count: options.length })}
        </h2>
        {options.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">{t("polls.new.optionsEmpty")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-cream-100">
            {options.map((option) => {
              const place = option.placeId ? placeById.get(option.placeId) : null;
              return (
                <li key={option.id} className="flex items-center gap-3 py-1.5">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream-100 text-route-700">
                    {place?.imageUrl ? (
                      <Image src={place.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                    ) : place ? (
                      <CategoryIcon category={place.category} size={16} />
                    ) : (
                      <Lightbulb size={16} strokeWidth={STROKE} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-900">
                    <bdi>{option.label}</bdi>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((current) =>
                        current.filter((o) => o.id !== option.id)
                      )
                    }
                    aria-label={t("polls.new.removeOption", { label: option.label })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-300"
                  >
                    <X size={16} strokeWidth={STROKE} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-terra-600">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={saving || !question.trim() || options.length < 2}
          className="btn-primary min-h-12 w-full py-3.5 text-base"
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
          <p className="mt-2 text-center text-sm text-ink-500">
            {t("polls.new.minOptions")}
          </p>
        )}
      </div>
    </form>
  );
}
