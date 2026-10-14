"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { STROKE, TRIP_GLYPHS } from "@/components/ui/Icon";
import { useT, type TKey } from "@/i18n";
import { apiFetch } from "@/lib/firebase/client";
import {
  primaryPlace,
  shortId,
  tripEnd,
  tripStart,
  type CreatorDestination,
  type CreatorState,
  type CreatorStop,
} from "./state";

interface Suggestion {
  placeId: string;
  label: string;
  secondary: string;
}


function nights(start: string, end: string): number | null {
  if (!start || !end || end < start) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Destination search box (Places autocomplete → resolved destination). */
function DestinationSearch({
  onPick,
  autoFocus,
  placeholder,
}: {
  onPick: (destination: CreatorDestination) => void;
  autoFocus?: boolean;
  placeholder: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    if (q.length < 2) {
      const clear = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiFetch(
          `/api/places/destination?q=${encodeURIComponent(q)}`
        );
        const body = await response.json();
        if (id === requestId.current) setSuggestions(body.suggestions ?? []);
      } catch {
        // keep typing
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  async function pick(suggestion: Suggestion) {
    setResolving(true);
    setError("");
    setSuggestions([]);
    setQuery("");
    try {
      const response = await apiFetch(
        `/api/places/destination?placeId=${encodeURIComponent(suggestion.placeId)}`
      );
      if (!response.ok) throw new Error();
      const { destination } = (await response.json()) as {
        destination: CreatorDestination;
      };
      onPick({ ...destination, label: destination.label || suggestion.label });
    } catch {
      setError(t("creator.where.loadFailed"));
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="relative">
      <Search
        size={20}
        strokeWidth={STROKE}
        aria-hidden
        className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-300"
      />
      <input
        className="field ps-12 text-lg"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={t("creator.where.searchLabel")}
        onChange={(event) => setQuery(event.target.value)}
        disabled={resolving}
      />
      {(suggestions.length > 0 || searching || resolving) && (
        <ul className="card absolute inset-x-0 top-full z-20 mt-2 overflow-hidden p-1">
          {resolving && <li className="px-4 py-3 text-sm text-ink-500">{t("creator.where.loading")}</li>}
          {!resolving && searching && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-500">{t("creator.where.searching")}</li>
          )}
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                onClick={() => pick(suggestion)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start hover:bg-cream-100"
              >
                <MapPin size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-sea-600" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink-900">{suggestion.label}</span>
                  <span className="block truncate text-xs text-ink-500">{suggestion.secondary}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-terra-600">{error}</p>}
    </div>
  );
}

function StopCard({
  stop,
  index,
  count,
  minDate,
  onChange,
  onMove,
  onRemove,
}: {
  stop: CreatorStop;
  index: number;
  count: number;
  minDate: string;
  onChange: (patch: Partial<CreatorStop>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const multi = count > 1;
  const stopNights = nights(stop.startDate, stop.endDate);
  return (
    <div className="card overflow-visible">
      {stop.place ? (
        <div className="relative h-32 overflow-hidden rounded-t-3xl bg-sea-900">
          {stop.place.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stop.place.coverImage} alt="" className="h-full w-full object-cover" />
          )}
          <div className="hero-overlay absolute inset-0" />
          {multi && (
            <span className="numerals absolute start-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-cream-50/90 text-sm text-ink-900">
              {index + 1}
            </span>
          )}
          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-light text-cream-50">
                {stop.place.label}
              </p>
              <p className="text-xs text-cream-50/80" dir="ltr">
                {stop.place.timezone} · {stop.place.currency}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ place: null })}
              className="shrink-0 rounded-full bg-cream-50/90 px-3 py-1.5 text-xs font-medium text-ink-900"
            >
              {t("creator.where.change")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 px-4 pt-4">
          {multi && (
            <p className="text-sm font-medium text-ink-700">{t("creator.where.stopN", { n: index + 1 })}</p>
          )}
          <DestinationSearch
            autoFocus={index > 0}
            placeholder={
              index === 0 ? t("creator.where.firstPlaceholder") : t("creator.where.nextPlaceholder")
            }
            onPick={(place) => onChange({ place })}
          />
        </div>
      )}

      <div className="space-y-2 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-ink-500">
              {index === 0 ? t("creator.where.depart") : t("creator.where.arrive")}
            </span>
            <input
              type="date"
              className="field"
              min={minDate || undefined}
              value={stop.startDate}
              onChange={(event) => {
                const startDate = event.target.value;
                onChange({
                  startDate,
                  ...(stop.endDate && stop.endDate < startDate ? { endDate: startDate } : {}),
                });
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-ink-500">
              {index === count - 1 ? t("creator.where.return") : t("creator.where.moveOn")}
            </span>
            <input
              type="date"
              className="field"
              min={stop.startDate || minDate || undefined}
              value={stop.endDate}
              onChange={(event) => onChange({ endDate: event.target.value })}
            />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500">
            {stopNights !== null
              ? stopNights === 0
                ? t("creator.where.oneDay")
                : t("creator.where.nights", { count: stopNights })
              : ""}
          </p>
          {multi && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t("creator.where.moveUp")}
                disabled={index === 0}
                onClick={() => onMove(-1)}
                className="rounded-xl p-2 text-ink-500 disabled:opacity-30"
              >
                <ArrowUp size={16} strokeWidth={STROKE} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("creator.where.moveDown")}
                disabled={index === count - 1}
                onClick={() => onMove(1)}
                className="rounded-xl p-2 text-ink-500 disabled:opacity-30"
              >
                <ArrowDown size={16} strokeWidth={STROKE} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("creator.where.removeStop")}
                onClick={onRemove}
                className="rounded-xl p-2 text-ink-300 hover:text-terra-600"
              >
                <Trash2 size={16} strokeWidth={STROKE} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StepWhere({
  state,
  update,
}: {
  state: CreatorState;
  update: (patch: Partial<CreatorState>) => void;
}) {
  const t = useT();
  const [names, setNames] = useState<{ name: string; emoji: string }[]>([]);
  const [naming, setNaming] = useState(false);
  const stops = state.stops;
  const start = tripStart(state);
  const end = tripEnd(state);
  const firstPlace = primaryPlace(state);

  function setStops(next: CreatorStop[], extra: Partial<CreatorState> = {}) {
    update({ stops: next, ...extra });
  }

  function changeStop(index: number, patch: Partial<CreatorStop>) {
    const next = stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop));
    // A stop's new end date pulls an empty/overlapping next start along
    if (patch.endDate && next[index + 1] && (!next[index + 1].startDate || next[index + 1].startDate < patch.endDate)) {
      next[index + 1] = {
        ...next[index + 1],
        startDate: patch.endDate,
        ...(next[index + 1].endDate && next[index + 1].endDate < patch.endDate ? { endDate: patch.endDate } : {}),
      };
    }
    // Default trip name from the first destination
    const extra: Partial<CreatorState> = {};
    if (patch.place && !state.name.trim()) {
      const year = (next[0].startDate || "").slice(0, 4);
      extra.name = `${patch.place.label}${year ? ` ${year}` : ""}`;
    }
    setStops(next, extra);
  }

  function addStop() {
    const last = stops[stops.length - 1];
    setStops([
      ...stops,
      {
        id: shortId("s"),
        place: null,
        startDate: last?.endDate ?? "",
        endDate: last?.endDate ? plusDays(last.endDate, 3) : "",
      },
    ]);
  }

  function moveStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    // Swap the places, keep the date slots in order
    const next = stops.map((stop) => ({ ...stop }));
    const place = next[index].place;
    next[index].place = next[target].place;
    next[target].place = place;
    setStops(next);
  }

  function removeStop(index: number) {
    setStops(stops.filter((_, i) => i !== index));
  }

  async function suggestNames() {
    if (!firstPlace || naming) return;
    setNaming(true);
    try {
      const response = await apiFetch("/api/ai/trip-assist", {
        method: "POST",
        body: JSON.stringify({
          action: "names",
          draft: {
            destination: stops
              .map((s) => s.place?.label)
              .filter(Boolean)
              .join(" ← "),
            startDate: start,
            endDate: end,
            groupKind: state.groupKind,
            groupName: state.groupName,
          },
        }),
      });
      const body = await response.json();
      setNames(body.names ?? []);
    } catch {
      // optional nicety
    } finally {
      setNaming(false);
    }
  }

  const tripNights = nights(start, end);
  const countries = new Set(stops.map((s) => s.place?.country).filter(Boolean));

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-3xl font-light text-ink-900">{t("creator.where.title")}</h1>
        <p className="mt-2 text-ink-500">{t("creator.where.text")}</p>
      </header>

      <section className="space-y-3">
        {stops.map((stop, index) => (
          <StopCard
            key={stop.id}
            stop={stop}
            index={index}
            count={stops.length}
            minDate={stops[index - 1]?.endDate ?? ""}
            onChange={(patch) => changeStop(index, patch)}
            onMove={(direction) => moveStop(index, direction)}
            onRemove={() => removeStop(index)}
          />
        ))}
        {stops.length < 12 && (
          <button
            type="button"
            onClick={addStop}
            disabled={!stops[stops.length - 1]?.place}
            className="btn-outline w-full py-3 disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={STROKE} aria-hidden /> {t("creator.where.addStop")}
          </button>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            {tripNights !== null
              ? [
                  t("creator.where.days", { count: tripNights + 1 }),
                  ...(stops.length > 1 ? [t("creator.where.stops", { count: stops.length })] : []),
                  ...(countries.size > 1 ? [t("creator.where.countries", { count: countries.size })] : []),
                ].join(" · ")
              : ""}
          </p>
          <label className="flex items-center gap-2 text-sm text-ink-500">
            {t("creator.where.departureTime")}
            <input
              type="time"
              className="field w-28 py-2"
              value={state.departureTime}
              onChange={(event) => update({ departureTime: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink-700" htmlFor="trip-name">
            {t("creator.where.nameLabel")}
          </label>
          {firstPlace && (
            <button
              type="button"
              onClick={suggestNames}
              disabled={naming}
              className="flex items-center gap-1.5 text-sm font-medium text-sea-700"
            >
              <Sparkles size={16} strokeWidth={STROKE} aria-hidden />
              {naming ? t("creator.where.thinking") : t("creator.where.suggest")}
            </button>
          )}
        </div>
        <input
          id="trip-name"
          className="field text-lg"
          placeholder={t("creator.where.namePlaceholder")}
          value={state.name}
          maxLength={60}
          onChange={(event) => update({ name: event.target.value })}
        />
        {names.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {names.map((option) => (
              <button
                key={option.name}
                type="button"
                onClick={() => {
                  // Suggested emoji are ignored — the trip keeps its chosen icon
                  update({ name: option.name });
                  setNames([]);
                }}
                className="chip text-ink-700"
              >
                {option.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNames([])}
              aria-label={t("common.close")}
              className="chip px-2.5"
            >
              <X size={16} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>
        )}
        <div
          role="radiogroup"
          aria-label={t("creator.where.iconLabel")}
          className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-1"
        >
          {TRIP_GLYPHS.map(({ key, Icon }) => {
            const active = state.emoji === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ emoji: key })}
                aria-label={t(`creator.where.icons.${key}` as TKey)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                  active
                    ? "border-sea-700 bg-sea-700 text-cream-50"
                    : "border-cream-200 bg-white text-ink-500"
                }`}
              >
                <Icon size={18} strokeWidth={STROKE} aria-hidden />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
