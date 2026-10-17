"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Clock, MapPin, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { RouteArt } from "@/components/journal/RouteArt";
import { Glyph, STROKE, TRIP_GLYPHS } from "@/components/ui/Icon";
import { useT, type TKey } from "@/i18n";
import { api } from "@together/backend/api";
import { activeLocale } from "@together/i18n/active";
import { convex } from "@/lib/convex";
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
        const found = await convex.action(api.destinations.autocomplete, { q });
        if (id === requestId.current) setSuggestions(found);
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
      const destination: CreatorDestination | null = await convex.action(api.destinations.resolve, {
        placeId: suggestion.placeId,
      });
      if (!destination) throw new Error("not_found");
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
        className="field min-h-14 ps-12 text-lg"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={t("creator.where.searchLabel")}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && suggestions[0]) {
            event.preventDefault();
            pick(suggestions[0]);
          }
        }}
        disabled={resolving}
      />
      {(suggestions.length > 0 || searching || resolving) && (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-chart-200 bg-white p-1 shadow-[0_2px_8px_rgb(15_27_45/0.08),0_16px_40px_-16px_rgb(15_27_45/0.22)]">
          {resolving && <li className="px-4 py-3 text-sm text-ink-500">{t("creator.where.loading")}</li>}
          {!resolving && searching && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-500">{t("creator.where.searching")}</li>
          )}
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                onClick={() => pick(suggestion)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-chart-100"
              >
                <MapPin size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-route-500" />
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
    <li className="relative flex gap-3">
      {/* The route: a node per stop, joined by one line */}
      <span aria-hidden className="relative flex w-7 shrink-0 justify-center">
        <span className="absolute top-9 -bottom-6 w-px bg-route-300" />
        <span
          className={`relative mt-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
            stop.place ? "bg-route-500 text-cream-50" : "border-2 border-route-300 bg-cream-50 text-route-700"
          }`}
        >
          {index + 1}
        </span>
      </span>
      <div className="min-w-0 flex-1 overflow-visible rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]">
        {stop.place ? (
          <div className="relative h-28 overflow-hidden rounded-t-2xl bg-night-900">
            {stop.place.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stop.place.coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <RouteArt seed={stop.place.placeId || stop.id} focus="top" />
            )}
            <div className="hero-overlay absolute inset-0" />
            <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-[1.375rem] font-medium leading-tight text-cream-50" dir="auto">
                  {stop.place.label}
                </p>
                <p className="mt-0.5 text-xs text-cream-50/80" dir="ltr">
                  {stop.place.timezone} · {stop.place.currency}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ place: null })}
                className="min-h-9 shrink-0 rounded-full bg-cream-50/90 px-3.5 text-xs font-medium text-ink-900"
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

        <div className="space-y-2 px-4 pb-3 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-ink-500">
                {index === 0 ? t("creator.where.depart") : t("creator.where.arrive")}
              </span>
              <input
                type="date"
                className="field px-3"
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
                className="field px-3"
                min={stop.startDate || minDate || undefined}
                value={stop.endDate}
                onChange={(event) => onChange({ endDate: event.target.value })}
              />
            </label>
          </div>
          <div className="flex min-h-11 items-center justify-between">
            <p className="text-sm text-ink-500">
              {stopNights !== null
                ? stopNights === 0
                  ? t("creator.where.oneDay")
                  : t("creator.where.nights", { count: stopNights })
                : ""}
            </p>
            {multi && (
              <div className="-me-2 flex items-center">
                <button
                  type="button"
                  aria-label={t("creator.where.moveUp")}
                  disabled={index === 0}
                  onClick={() => onMove(-1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-500 disabled:opacity-30"
                >
                  <ArrowUp size={17} strokeWidth={STROKE} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("creator.where.moveDown")}
                  disabled={index === count - 1}
                  onClick={() => onMove(1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-500 disabled:opacity-30"
                >
                  <ArrowDown size={17} strokeWidth={STROKE} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("creator.where.removeStop")}
                  onClick={onRemove}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-400 hover:text-terra-600"
                >
                  <Trash2 size={17} strokeWidth={STROKE} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
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
  const [departureOpen, setDepartureOpen] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
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
      const found = await convex.action(api.assist.names, {
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
        locale: activeLocale(),
      });
      setNames(found);
    } catch {
      // optional nicety
    } finally {
      setNaming(false);
    }
  }

  const tripNights = nights(start, end);
  const countries = new Set(stops.map((s) => s.place?.country).filter(Boolean));

  const showDeparture = departureOpen || Boolean(state.departureTime);
  const ActiveGlyph = TRIP_GLYPHS.find((g) => g.key === state.emoji);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-display-sm font-medium text-ink-900">{t("creator.where.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{t("creator.where.text")}</p>
      </header>

      <section className="space-y-3">
        <ol className="space-y-3">
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
            <li className="flex gap-3">
              <span aria-hidden className="flex w-7 shrink-0 justify-center">
                <span className="mt-2.5 h-7 w-7 rounded-full border-2 border-dashed border-route-300 bg-cream-50" />
              </span>
              <button
                type="button"
                onClick={addStop}
                disabled={!stops[stops.length - 1]?.place}
                className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl border border-dashed border-cream-300 px-4 text-sm font-medium text-ink-700 transition hover:bg-white disabled:opacity-40"
              >
                <Plus size={16} strokeWidth={STROKE} aria-hidden /> {t("creator.where.addStop")}
              </button>
            </li>
          )}
        </ol>
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 ps-10">
          <p className="text-sm font-medium text-ink-700">
            {tripNights !== null
              ? [
                  t("creator.where.days", { count: tripNights + 1 }),
                  ...(stops.length > 1 ? [t("creator.where.stops", { count: stops.length })] : []),
                  ...(countries.size > 1 ? [t("creator.where.countries", { count: countries.size })] : []),
                ].join(" · ")
              : ""}
          </p>
          {showDeparture ? (
            <label className="flex items-center gap-2 text-sm text-ink-500">
              <Clock size={16} strokeWidth={STROKE} aria-hidden />
              {t("creator.where.departureTime")}
              <input
                type="time"
                className="field w-28 py-2"
                value={state.departureTime}
                autoFocus={departureOpen && !state.departureTime}
                onChange={(event) => update({ departureTime: event.target.value })}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setDepartureOpen(true)}
              className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-route-700"
            >
              <Clock size={16} strokeWidth={STROKE} aria-hidden />
              {t("creator.wizard.addDeparture")}
            </button>
          )}
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
              className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-route-700"
            >
              <Sparkles size={16} strokeWidth={STROKE} aria-hidden />
              {naming ? t("creator.where.thinking") : t("creator.where.suggest")}
            </button>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIconsOpen((open) => !open)}
            aria-expanded={iconsOpen}
            aria-label={t("creator.where.iconLabel")}
            className="absolute start-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-chart-100 text-ink-700 transition hover:bg-chart-200"
          >
            {ActiveGlyph ? (
              <ActiveGlyph.Icon size={18} strokeWidth={STROKE} aria-hidden />
            ) : (
              <Glyph value={state.emoji} size={18} />
            )}
          </button>
          <input
            id="trip-name"
            className="field min-h-14 ps-14 text-lg"
            placeholder={t("creator.where.namePlaceholder")}
            value={state.name}
            maxLength={60}
            dir="auto"
            onChange={(event) => update({ name: event.target.value })}
          />
        </div>
        {names.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {names.map((option) => (
              <button
                key={option.name}
                type="button"
                onClick={() => {
                  // Suggested emoji are ignored — the trip keeps its chosen icon
                  update({ name: option.name });
                  setNames([]);
                }}
                className="chip min-h-10 text-ink-700"
              >
                <bdi>{option.name}</bdi>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNames([])}
              aria-label={t("common.close")}
              className="chip min-h-10 px-2.5"
            >
              <X size={16} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>
        )}
        {iconsOpen && (
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
                  onClick={() => {
                    update({ emoji: key });
                    setIconsOpen(false);
                  }}
                  aria-label={t(`creator.where.icons.${key}` as TKey)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                    active
                      ? "border-sea-900 bg-sea-900 text-cream-50"
                      : "border-chart-200 bg-white text-ink-500"
                  }`}
                >
                  <Icon size={18} strokeWidth={STROKE} aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
