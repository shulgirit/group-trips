"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Search, Sparkles, Star, TriangleAlert } from "lucide-react";
import { addPlace, samePlaceName } from "@/lib/db";
import { usePlaces } from "@/lib/hooks";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { apiFetch } from "@/lib/firebase/client";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

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
  const { prefix, id: tripId } = useTrip();
  const t = useT();
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
      const response = await apiFetch("/api/import/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: /^https?:\/\//.test(url) ? url : `https://${url}`,
          tripId,
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
      setImportError(t("trip.newPlace.importFailed"));
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
      const response = await apiFetch("/api/import/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, tripId }),
      });
      if (!response.ok) throw new Error("search_failed");
      const { results }: { results: SearchResult[] } = await response.json();
      if (!results.length) {
        setSearchError(t("trip.newPlace.notFound"));
      } else {
        setSearchResults(results);
      }
    } catch {
      setSearchError(t("trip.newPlace.searchFailed"));
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
        existed ? `${prefix}/places/${placeId}` : `${prefix}/places/${placeId}?schedule=1`
      );
    } catch {
      setError(t("trip.newPlace.saveFailed"));
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
          className="field py-2.5"
        />
      ) : (
        <input
          type="text"
          dir={options?.ltr ? "ltr" : undefined}
          value={value}
          onChange={(e) => setter(e.target.value)}
          placeholder={options?.placeholder}
          className="field py-2.5"
        />
      )}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="font-display text-2xl font-light text-ink-900">
        {t("trip.newPlace.title")}
      </h1>

      {/* URL import */}
      <div className="rounded-2xl border border-cream-200 bg-white p-5">
        <p className="mb-3 flex items-start gap-2 text-sm text-ink-700">
          <Sparkles size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-lemon-500" />
          {t("trip.newPlace.importHint")}
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            dir="ltr"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://…"
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !importUrl.trim()}
            className="btn-accent whitespace-nowrap px-4 py-3 text-sm"
          >
            {!importing && <Sparkles size={15} strokeWidth={STROKE} aria-hidden />}
            {importing ? t("trip.newPlace.importing") : t("trip.newPlace.importButton")}
          </button>
        </div>
        {importing && (
          <p className="mt-2 text-sm text-ink-500">
            {t("trip.newPlace.importWait")}
          </p>
        )}
        {importError && (
          <p role="alert" className="mt-2 text-sm font-medium text-terra-600">
            {importError}
          </p>
        )}
        {imported && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-sea-700">
            <Check size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0" />
            {t("trip.newPlace.imported")}
          </p>
        )}
      </div>

      {/* Free-text search */}
      <div className="card p-5">
        <p className="mb-3 flex items-start gap-2 text-sm text-ink-700">
          <Search size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-500" />
          {t("trip.newPlace.searchHint")}
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
            placeholder={t("trip.newPlace.searchPlaceholder")}
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="btn-primary whitespace-nowrap px-4 text-sm"
          >
            {searching ? t("trip.newPlace.searching") : t("common.search")}
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
                  className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-cream-200 bg-white text-start transition active:bg-cream-100"
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
                      <span className="flex h-full items-center justify-center text-sea-700">
                        <CategoryIcon category={result.category} size={20} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 py-2">
                    <span className="flex items-center gap-1 truncate font-medium text-ink-900">
                      <span className="truncate">{result.name}</span>
                      {result.rating ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-sm font-normal text-ink-500">
                          {" · "}
                          {result.rating}
                          <Star size={12} strokeWidth={STROKE} aria-hidden className="fill-lemon-400 text-lemon-500" />
                        </span>
                      ) : null}
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
          <p className="mt-2 flex items-start gap-1.5 text-sm text-sea-700">
            <Check size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              {t("trip.newPlace.found")}
              {importUrl ? t("trip.newPlace.foundMore") : ""}
            </span>
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          {t("trip.newPlace.name")}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("trip.newPlace.namePlaceholder")}
          required
          className="field py-3.5 text-lg"
        />
      </label>

      {duplicateOf && (
        <Link
          href={`${prefix}/places/${duplicateOf.id}`}
          className="flex items-center gap-2 rounded-xl border border-lemon-300 bg-white px-4 py-3 text-sm text-ink-700"
        >
          <TriangleAlert size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-lemon-500" />
          <span className="flex-1">{t("trip.newPlace.duplicate", { name: duplicateOf.name })}</span>
          <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180" />
        </Link>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.newPlace.category")}</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PLACE_CATEGORIES) as PlaceCategory[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              aria-pressed={category === id}
              className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs transition ${
                category === id
                  ? "border-sea-900 bg-sea-900 text-cream-50"
                  : "border-cream-200 bg-white text-ink-700"
              }`}
            >
              <CategoryIcon category={id} size={20} />
              {t(`trip.categories.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {imported && summary && (
        <div className="space-y-3">
          {textField(t("trip.newPlace.fields.summary"), summary, setSummary, { multiline: true })}
          {reviewsSummary &&
            textField(t("trip.place.fields.reviews"), reviewsSummary, setReviewsSummary, {
              multiline: true,
            })}
          {popularDishes &&
            textField(t("trip.place.fields.dishes"), popularDishes, setPopularDishes)}
          {tips && textField(t("trip.place.fields.tips"), tips, setTips, { multiline: true })}
        </div>
      )}

      <details
        open={imported || found}
        className="rounded-2xl border border-cream-200 bg-white px-4 py-3"
      >
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          {imported ? t("trip.newPlace.moreDetails") : t("trip.newPlace.moreDetailsOptional")}
        </summary>
        <div className="mt-3 space-y-3">
          {textField(t("trip.newPlace.fields.area"), area, setArea, {
            placeholder: t("trip.newPlace.fields.areaPlaceholder"),
          })}
          {textField(t("trip.place.fields.address"), address, setAddress)}
          {textField(t("trip.place.fields.openingHours"), openingHours, setOpeningHours)}
          {textField(t("trip.newPlace.fields.prices"), priceNotes, setPriceNotes)}
          {textField(t("trip.newPlace.fields.website"), website, setWebsite, {
            ltr: true,
            placeholder: "https://…",
          })}
          {textField(t("trip.newPlace.fields.bookingUrl"), bookingUrl, setBookingUrl, { ltr: true })}
          {textField(t("trip.newPlace.fields.imageUrl"), imageUrl, setImageUrl, { ltr: true })}
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
        className="btn-primary w-full py-3.5 text-base"
      >
        {saving ? t("common.saving") : t("trip.newPlace.submit")}
      </button>
    </form>
  );
}
