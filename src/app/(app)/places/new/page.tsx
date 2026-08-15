"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addPlace, samePlaceName } from "@/lib/db";
import { usePlaces } from "@/lib/hooks";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/types";

interface ImportedDraft {
  name: string;
  category: string;
  area: string;
  address: string;
  summary: string;
  openingHours: string;
  priceNotes: string;
  recommendedDurationMin: number | null;
  tips: string;
  popularDishes: string;
  reviewsSummary: string;
  website: string;
  bookingUrl: string;
  imageUrl: string;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
}

interface SearchResult {
  name: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  category: string;
  website: string;
  rating: number | null;
  imageUrl: string;
}

export default function NewPlacePage() {
  const router = useRouter();
  const { places } = usePlaces();

  // Import flow
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [imported, setImported] = useState(false);

  // Free-text search flow
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null
  );
  const [searchError, setSearchError] = useState("");
  const [found, setFound] = useState(false);

  // Draft fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("attraction");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [priceNotes, setPriceNotes] = useState("");
  const [tips, setTips] = useState("");
  const [popularDishes, setPopularDishes] = useState("");
  const [reviewsSummary, setReviewsSummary] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>(
    { lat: null, lng: null }
  );
  const [sourceUrl, setSourceUrl] = useState("");
  const [durationMin, setDurationMin] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleImport() {
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    setImportError("");
    try {
      const response = await fetch("/api/import/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: /^https?:\/\//.test(url) ? url : `https://${url}`,
        }),
      });
      if (!response.ok) throw new Error("import_failed");
      const { draft }: { draft: ImportedDraft } = await response.json();

      setName(draft.name);
      setCategory(
        (draft.category in PLACE_CATEGORIES
          ? draft.category
          : "other") as PlaceCategory
      );
      setArea(draft.area);
      setAddress(draft.address);
      setWebsite(draft.website);
      setImageUrl(draft.imageUrl);
      setSummary(draft.summary);
      setOpeningHours(draft.openingHours);
      setPriceNotes(draft.priceNotes);
      setTips(draft.tips);
      setPopularDishes(draft.popularDishes);
      setReviewsSummary(draft.reviewsSummary);
      setBookingUrl(draft.bookingUrl);
      setCoords({ lat: draft.lat, lng: draft.lng });
      setSourceUrl(draft.sourceUrl);
      setDurationMin(draft.recommendedDurationMin);
      setImported(true);
    } catch {
      setImportError(
        "הייבוא נכשל — אפשר לנסות שוב, או פשוט למלא ידנית למטה"
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query || searching) return;
    setSearching(true);
    setSearchError("");
    setSearchResults(null);
    try {
      const response = await fetch("/api/import/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error("search_failed");
      const { results }: { results: SearchResult[] } = await response.json();
      if (!results.length) {
        setSearchError("לא נמצא — נסו ניסוח אחר, או מלאו ידנית למטה");
      } else {
        setSearchResults(results);
      }
    } catch {
      setSearchError("החיפוש נכשל, נסו שוב");
    } finally {
      setSearching(false);
    }
  }

  function applyResult(result: SearchResult) {
    setName(result.name);
    setCategory(
      (result.category in PLACE_CATEGORIES
        ? result.category
        : "attraction") as PlaceCategory
    );
    setArea(result.area);
    setAddress(result.address);
    setCoords({ lat: result.lat, lng: result.lng });
    setWebsite(result.website);
    setImageUrl(result.imageUrl);
    if (result.website) setImportUrl(result.website);
    setSearchResults(null);
    setFound(true);
  }

  // Live duplicate warning while typing
  const duplicateOf = useMemo(() => {
    if (name.trim().length < 3) return null;
    return (places ?? []).find((p) => samePlaceName(p.name, name)) ?? null;
  }, [places, name]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { id: placeId, existed } = await addPlace({
        name,
        category,
        area,
        address,
        website,
        imageUrl,
        summary,
        openingHours,
        priceNotes,
        tips,
        popularDishes,
        reviewsSummary,
        bookingUrl,
        lat: coords.lat,
        lng: coords.lng,
        sourceUrl,
        recommendedDurationMin: durationMin,
      });
      // Land on the place with the schedule sheet already open (skippable)
      router.replace(
        existed ? `/places/${placeId}` : `/places/${placeId}?schedule=1`
      );
    } catch {
      setError("השמירה נכשלה — בדקו את הפרטים ונסו שוב");
      setSaving(false);
    }
  }

  const textField = (
    label: string,
    value: string,
    setter: (v: string) => void,
    options?: { ltr?: boolean; placeholder?: string; multiline?: boolean }
  ) => (
    <label key={label} className="block">
      <span className="mb-1.5 block text-sm text-ink-500">{label}</span>
      {options?.multiline ? (
        <textarea
          value={value}
          onChange={(e) => setter(e.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
        />
      ) : (
        <input
          type="text"
          dir={options?.ltr ? "ltr" : "rtl"}
          value={value}
          onChange={(e) => setter(e.target.value)}
          placeholder={options?.placeholder}
          className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
        />
      )}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink-900">
        מקום חדש
      </h1>

      {/* URL import */}
      <div className="rounded-3xl border border-sea-200 bg-sea-100/50 p-4">
        <p className="mb-2 text-sm font-medium text-ink-700">
          ✨ יש קישור? הדביקו אותו וה-AI ימלא הכל — כולל ביקורות מהרשת
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            dir="ltr"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !importUrl.trim()}
            className="whitespace-nowrap rounded-2xl bg-sea-600 px-4 py-3 text-sm font-semibold text-cream-50 disabled:opacity-50"
          >
            {importing ? "קורא את הדף…" : "✨ ייבא עם AI"}
          </button>
        </div>
        {importing && (
          <p className="mt-2 text-sm text-ink-500">
            זה לוקח עד דקה — קוראים את האתר, מחפשים ביקורות ומתרגמים לעברית ☕
          </p>
        )}
        {importError && (
          <p role="alert" className="mt-2 text-sm font-medium text-terra-600">
            {importError}
          </p>
        )}
        {imported && (
          <p className="mt-2 text-sm font-medium text-sea-700">
            ✓ יובא! בדקו את הפרטים למטה, ערכו אם צריך — ואז שמרו
          </p>
        )}
      </div>

      {/* Free-text search */}
      <div className="card p-4">
        <p className="mb-2 text-sm font-medium text-ink-700">
          🔍 אין קישור? כתבו את שם המקום בחופשיות — ונמצא אותו
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="למשל: אצטדיון ברברה פלרמו"
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="btn-primary whitespace-nowrap px-4 text-sm"
          >
            {searching ? "מחפש…" : "חפש"}
          </button>
        </div>
        {searchError && (
          <p role="alert" className="mt-2 text-sm font-medium text-terra-600">
            {searchError}
          </p>
        )}
        {searchResults && (
          <ul className="mt-3 space-y-2">
            {searchResults.map((result, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => applyResult(result)}
                  className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-sea-200 bg-white text-right transition active:bg-sea-100"
                >
                  <span className="relative h-14 w-16 shrink-0 overflow-hidden bg-cream-100">
                    {result.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xl">
                        {PLACE_CATEGORIES[
                          result.category as PlaceCategory
                        ]?.emoji ?? "📌"}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 py-2">
                    <span className="block truncate font-semibold text-ink-900">
                      {result.name}
                      {result.rating ? ` · ${result.rating}★` : ""}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {result.address}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {found && (
          <p className="mt-2 text-sm font-medium text-sea-700">
            ✓ נמצא! הפרטים מולאו כולל תמונה ומיקום — בדקו ושמרו
            {importUrl ? "; רוצים עוד פרטים? לחצו ✨ ייבא עם AI למעלה" : ""}
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          איך קוראים למקום? *
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="למשל: Isola Bella"
          required
          className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
        />
      </label>

      {duplicateOf && (
        <Link
          href={`/places/${duplicateOf.id}`}
          className="block rounded-2xl border border-lemon-300 bg-lemon-100 px-4 py-3 text-sm font-medium text-ink-700"
        >
          ⚠️ ״{duplicateOf.name}״ כבר קיים ברשימה — לחצו לפתיחה במקום להוסיף
          שוב ›
        </Link>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">קטגוריה *</p>
        <div className="grid grid-cols-4 gap-2">
          {(
            Object.entries(PLACE_CATEGORIES) as [
              PlaceCategory,
              (typeof PLACE_CATEGORIES)[PlaceCategory],
            ][]
          ).map(([id, { label, emoji }]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 text-sm transition ${
                category === id
                  ? "bg-sea-600 font-medium text-cream-50"
                  : "bg-cream-100 text-ink-700"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {emoji}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {imported && summary && (
        <div className="space-y-3">
          {textField("תיאור", summary, setSummary, { multiline: true })}
          {reviewsSummary &&
            textField("מה אומרים בביקורות", reviewsSummary, setReviewsSummary, {
              multiline: true,
            })}
          {popularDishes &&
            textField("מנות מומלצות", popularDishes, setPopularDishes)}
          {tips && textField("טיפים", tips, setTips, { multiline: true })}
        </div>
      )}

      <details
        open={imported || found}
        className="rounded-2xl border border-cream-200 bg-white px-4 py-3"
      >
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          פרטים נוספים {imported ? "" : "(לא חובה)"}
        </summary>
        <div className="mt-3 space-y-3">
          {textField("אזור", area, setArea, { placeholder: "למשל: טאורמינה" })}
          {textField("כתובת", address, setAddress)}
          {textField("שעות פתיחה", openingHours, setOpeningHours)}
          {textField("מחירים", priceNotes, setPriceNotes)}
          {textField("אתר", website, setWebsite, {
            ltr: true,
            placeholder: "https://…",
          })}
          {textField("קישור הזמנה", bookingUrl, setBookingUrl, { ltr: true })}
          {textField("קישור לתמונה", imageUrl, setImageUrl, { ltr: true })}
        </div>
      </details>

      {error && (
        <p role="alert" className="text-sm font-medium text-terra-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "שומר…" : "שמור מקום"}
      </button>
    </form>
  );
}
