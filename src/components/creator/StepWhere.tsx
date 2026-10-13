"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Sparkles, X } from "lucide-react";
import { apiFetch } from "@/lib/firebase/client";
import type { CreatorDestination, CreatorState } from "./state";

interface Suggestion {
  placeId: string;
  label: string;
  secondary: string;
}

const EMOJIS = ["✈️", "🌴", "🏖️", "🏔️", "🍋", "🍕", "🥐", "🎉", "🌍", "⛵", "🗺️", "🏝️"];

function nights(start: string, end: string): number | null {
  if (!start || !end || end < start) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

export function StepWhere({
  state,
  update,
}: {
  state: CreatorState;
  update: (patch: Partial<CreatorState>) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [names, setNames] = useState<{ name: string; emoji: string }[]>([]);
  const [naming, setNaming] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const id = ++requestId.current;
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
      update({
        destination: { ...destination, label: destination.label || suggestion.label },
        ...(state.name
          ? {}
          : {
              name: `${destination.label || suggestion.label}${state.startDate ? ` ${state.startDate.slice(0, 4)}` : ""}`,
            }),
      });
    } catch {
      setError("לא הצלחנו לטעון את היעד — נסו שוב");
    } finally {
      setResolving(false);
    }
  }

  async function suggestNames() {
    if (!state.destination || naming) return;
    setNaming(true);
    try {
      const response = await apiFetch("/api/ai/trip-assist", {
        method: "POST",
        body: JSON.stringify({
          action: "names",
          draft: {
            destination: state.destination.label,
            startDate: state.startDate,
            endDate: state.endDate,
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

  const tripNights = nights(state.startDate, state.endDate);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-900">לאן טסים? 🌍</h1>
        <p className="mt-1 text-ink-500">היעד והתאריכים — כל השאר נבנה מזה</p>
      </header>

      {/* Destination */}
      <section className="space-y-2">
        <label className="text-sm font-semibold text-ink-700" htmlFor="dest">
          יעד
        </label>
        {state.destination ? (
          <div className="card relative overflow-hidden">
            <div className="relative h-40 bg-gradient-to-br from-sea-900 to-sea-500">
              {state.destination.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.destination.coverImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <div className="hero-overlay absolute inset-0" />
              <div className="absolute inset-x-4 bottom-3 flex items-end justify-between">
                <div>
                  <p className="font-display text-2xl font-bold text-cream-50">
                    {state.destination.label}
                  </p>
                  <p className="text-xs text-cream-50/80" dir="ltr">
                    {state.destination.timezone} · {state.destination.currency}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => update({ destination: null })}
                  className="rounded-full bg-cream-50/90 px-3 py-1.5 text-xs font-semibold text-ink-900"
                >
                  שינוי
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-300" />
            <input
              id="dest"
              className="field ps-12 text-lg"
              placeholder="סיציליה, טוסקנה, אתונה…"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              disabled={resolving}
            />
            {(suggestions.length > 0 || searching || resolving) && (
              <ul className="card absolute inset-x-0 top-full z-20 mt-2 overflow-hidden p-1">
                {resolving && (
                  <li className="px-4 py-3 text-sm text-ink-500">טוענים את היעד…</li>
                )}
                {!resolving && searching && suggestions.length === 0 && (
                  <li className="px-4 py-3 text-sm text-ink-500">מחפשים…</li>
                )}
                {suggestions.map((suggestion) => (
                  <li key={suggestion.placeId}>
                    <button
                      type="button"
                      onClick={() => pick(suggestion)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start hover:bg-cream-100"
                    >
                      <MapPin className="h-4.5 w-4.5 shrink-0 text-sea-600" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-900">
                          {suggestion.label}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {suggestion.secondary}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && <p className="text-sm text-terra-600">{error}</p>}
      </section>

      {/* Dates */}
      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink-700">מתי?</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-ink-500">יוצאים</span>
            <input
              type="date"
              className="field"
              value={state.startDate}
              onChange={(event) => {
                const startDate = event.target.value;
                update({
                  startDate,
                  ...(state.endDate && state.endDate < startDate ? { endDate: startDate } : {}),
                });
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-ink-500">חוזרים</span>
            <input
              type="date"
              className="field"
              min={state.startDate || undefined}
              value={state.endDate}
              onChange={(event) => update({ endDate: event.target.value })}
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            {tripNights !== null
              ? tripNights === 0
                ? "יום אחד ✨"
                : `${tripNights} לילות · ${tripNights + 1} ימים`
              : ""}
          </p>
          <label className="flex items-center gap-2 text-sm text-ink-500">
            שעת המראה
            <input
              type="time"
              className="field w-28 py-2"
              value={state.departureTime}
              onChange={(event) => update({ departureTime: event.target.value })}
            />
          </label>
        </div>
      </section>

      {/* Name */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-ink-700" htmlFor="trip-name">
            שם הטיול
          </label>
          {state.destination && (
            <button
              type="button"
              onClick={suggestNames}
              disabled={naming}
              className="flex items-center gap-1 text-sm font-semibold text-sea-700"
            >
              <Sparkles className="h-4 w-4" />
              {naming ? "חושב…" : "הצעות AI"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            id="trip-name"
            className="field flex-1 text-lg"
            placeholder="סיציליה 2026"
            value={state.name}
            maxLength={60}
            onChange={(event) => update({ name: event.target.value })}
          />
        </div>
        {names.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {names.map((option) => (
              <button
                key={option.name}
                type="button"
                onClick={() => {
                  update({ name: option.name, emoji: option.emoji || state.emoji });
                  setNames([]);
                }}
                className="chip bg-lemon-100 text-ink-700"
              >
                {option.emoji} {option.name}
              </button>
            ))}
            <button type="button" onClick={() => setNames([])} aria-label="סגירה" className="chip px-2.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => update({ emoji })}
              aria-label={`אימוג׳י ${emoji}`}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl transition ${
                state.emoji === emoji ? "bg-sea-700 ring-2 ring-sea-200" : "bg-cream-100"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
