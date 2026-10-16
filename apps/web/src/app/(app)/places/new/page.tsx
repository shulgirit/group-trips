"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Link2,
  PenLine,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  TriangleAlert,
} from "lucide-react";
import { addPlace, samePlaceName } from "@/lib/db";
import { usePlaces } from "@/lib/hooks";
import { PLACE_CATEGORIES, type PlaceCategory } from "@together/shared/types";
import { useTrip } from "@/components/providers/TripProvider";
import { apiFetch } from "@/lib/firebase/client";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { RouteArt } from "@/components/journal/RouteArt";
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

type Method = "search" | "link" | "manual";

const METHODS: { id: Method; icon: typeof Search }[] = [
  { id: "search", icon: Search },
  { id: "link", icon: Link2 },
  { id: "manual", icon: PenLine },
];

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]";

export default function NewPlacePage() {
  const { prefix, id: tripId } = useTrip();
  const t = useT();
  const router = useRouter();
  const { places } = usePlaces();

  const [method, setMethod] = useState<Method>("search");

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

  const hasDraft = imported || found;

  function resetDraft() {
    setImported(false);
    setFound(false);
    setImportError("");
    setSearchError("");
    setName("");
    setCategory("attraction");
    setArea("");
    setAddress("");
    setWebsite("");
    setImageUrl("");
    setSummary("");
    setOpeningHours("");
    setPriceNotes("");
    setTips("");
    setPopularDishes("");
    setReviewsSummary("");
    setBookingUrl("");
    setCoords({ lat: null, lng: null });
    setSourceUrl("");
    setDurationMin(null);
  }

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
          dir="auto"
          onChange={(e) => setter(e.target.value)}
          rows={3}
          className="field py-2.5 leading-relaxed"
        />
      ) : (
        <input
          type="text"
          dir={options?.ltr ? "ltr" : "auto"}
          value={value}
          onChange={(e) => setter(e.target.value)}
          placeholder={options?.placeholder}
          className="field py-2.5"
        />
      )}
    </label>
  );

  const categoryPicker = (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(PLACE_CATEGORIES) as PlaceCategory[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setCategory(id)}
          aria-pressed={category === id}
          className={`chip min-h-11 ${category === id ? "chip-active" : "text-ink-700"}`}
        >
          <CategoryIcon category={id} size={16} />
          {t(`trip.categories.${id}`)}
        </button>
      ))}
    </div>
  );

  const duplicateWarning = duplicateOf && (
    <Link
      href={`${prefix}/places/${duplicateOf.id}`}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-brass-300 bg-brass-100 px-4 py-3 text-sm text-ink-700"
    >
      <TriangleAlert size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-brass-600" />
      <span className="flex-1">{t("trip.newPlace.duplicate", { name: duplicateOf.name })}</span>
      <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180" />
    </Link>
  );

  const showForm = hasDraft || method === "manual";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-4">
      <div>
        <Link
          href={`${prefix}/places`}
          className="-ms-1 inline-flex min-h-11 items-center gap-1 text-sm text-ink-500"
        >
          <ChevronLeft size={16} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
          {t("trip.places.title")}
        </Link>
        <h1 className="font-display text-3xl font-light text-ink-900">
          {t("trip.newPlace.title")}
        </h1>
      </div>

      {/* ── Method picker (hidden once a draft is ready) ── */}
      {!hasDraft && (
        <div
          role="tablist"
          aria-label={t("trip.newPlace.methodsAria")}
          className="grid grid-cols-3 gap-1 rounded-2xl bg-cream-100 p-1"
        >
          {METHODS.map(({ id, icon: Icon }) => {
            const active = method === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMethod(id)}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm transition ${
                  active
                    ? "bg-white font-medium text-ink-900 shadow-[0_1px_2px_rgb(15_27_45/0.08)]"
                    : "text-ink-500"
                }`}
              >
                <Icon size={15} strokeWidth={STROKE} aria-hidden className="shrink-0" />
                <span className="truncate">{t(`trip.newPlace.methods.${id}`)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Search by name ── */}
      {!hasDraft && method === "search" && (
        <section role="tabpanel" className="space-y-3">
          <p className="text-sm text-ink-500">{t("trip.newPlace.searchHint")}</p>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                strokeWidth={STROKE}
                aria-hidden
                className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="search"
                dir="auto"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder={t("trip.newPlace.searchPlaceholder")}
                aria-label={t("trip.newPlace.methods.search")}
                autoFocus
                className="field ps-10"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="btn-primary min-h-11 whitespace-nowrap px-4 text-sm"
            >
              {searching ? t("trip.newPlace.searching") : t("common.search")}
            </button>
          </div>
          {searchError && (
            <p role="alert" className="text-sm font-medium text-terra-600">
              {searchError}
            </p>
          )}
          {searchResults && (
            <ul className={`divide-y divide-cream-100 overflow-hidden rounded-2xl bg-white ${CARD_SHADOW}`}>
              {searchResults.map((result, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => applyResult(result)}
                    className="flex w-full items-center gap-3 p-2.5 text-start transition active:bg-cream-100/60"
                  >
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                      {result.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-route-700">
                          <CategoryIcon category={result.category} size={20} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span dir="auto" className="truncate font-medium text-ink-900">
                          {result.name}
                        </span>
                        {result.rating ? (
                          <span className="flex shrink-0 items-center gap-0.5 text-sm text-ink-500">
                            <Star size={12} strokeWidth={STROKE} aria-hidden className="fill-brass-300 text-brass-500" />
                            <span dir="ltr">{result.rating}</span>
                          </span>
                        ) : null}
                      </span>
                      <span dir="auto" className="block truncate text-xs text-ink-500">
                        {result.address}
                      </span>
                    </span>
                    <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Import from a link (AI) ── */}
      {!hasDraft && method === "link" && (
        <section role="tabpanel" className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-ink-500">
            <Sparkles size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-brass-500" />
            {t("trip.newPlace.importHint")}
          </p>
          <input
            type="url"
            dir="ltr"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleImport();
              }
            }}
            placeholder="https://…"
            aria-label={t("trip.newPlace.methods.link")}
            className="field"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !importUrl.trim()}
            className="btn-accent min-h-11 w-full py-3 text-sm"
          >
            {!importing && <Sparkles size={16} strokeWidth={STROKE} aria-hidden />}
            {importing ? t("trip.newPlace.importing") : t("trip.newPlace.importButton")}
          </button>
          {importing && (
            <p className="text-sm text-ink-500">{t("trip.newPlace.importWait")}</p>
          )}
          {importError && (
            <p role="alert" className="text-sm font-medium text-terra-600">
              {importError}
            </p>
          )}
        </section>
      )}

      {/* ── Manual ── */}
      {!hasDraft && method === "manual" && (
        <section role="tabpanel" className="space-y-5">
          <p className="text-sm text-ink-500">{t("trip.newPlace.manualHint")}</p>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink-700">
              {t("trip.newPlace.name")}
            </span>
            <input
              type="text"
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("trip.newPlace.namePlaceholder")}
              required
              className="field py-3.5 text-lg"
            />
          </label>
          {duplicateWarning}
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">{t("trip.newPlace.category")}</p>
            {categoryPicker}
          </div>
          {textField(t("trip.newPlace.fields.area"), area, setArea, {
            placeholder: t("trip.newPlace.fields.areaPlaceholder"),
          })}
        </section>
      )}

      {/* ── Preview of a found / imported place ── */}
      {hasDraft && (
        <section className="space-y-4">
          <p className="flex items-start gap-1.5 text-sm text-route-700">
            <Check size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0" />
            {imported ? t("trip.newPlace.imported") : t("trip.newPlace.found")}
          </p>

          <div className={`overflow-hidden rounded-2xl bg-white ${CARD_SHADOW}`}>
            <div className="relative aspect-[16/9] bg-sea-900">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <RouteArt seed={name || "new-place"} focus="top" />
              )}
              <span className="absolute start-3 top-3 flex items-center gap-1.5 rounded-full bg-cream-50/90 px-3 py-1 text-xs font-medium text-ink-700 backdrop-blur">
                <CategoryIcon category={category} size={13} />
                {t(`trip.categories.${category}`)}
              </span>
            </div>
            <div className="space-y-3 p-4">
              <label className="block">
                <span className="sr-only">{t("trip.newPlace.name")}</span>
                <input
                  type="text"
                  dir="auto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("trip.newPlace.namePlaceholder")}
                  required
                  className="w-full rounded-lg border-b border-transparent bg-transparent py-1 font-display text-2xl text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-cream-300"
                />
              </label>
              <label className="block">
                <span className="sr-only">{t("trip.newPlace.fields.area")}</span>
                <input
                  type="text"
                  dir="auto"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder={t("trip.newPlace.fields.areaPlaceholder")}
                  className="w-full border-b border-transparent bg-transparent py-1 text-sm text-ink-500 outline-none transition placeholder:text-ink-300 focus:border-cream-300"
                />
              </label>
              {address && (
                <p dir="auto" className="text-xs text-ink-400">
                  {address}
                </p>
              )}
              <div className="border-t border-cream-100 pt-3">
                <p className="mb-2 text-sm text-ink-500">{t("trip.newPlace.category")}</p>
                {categoryPicker}
              </div>
            </div>
          </div>

          {duplicateWarning}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {found && !imported && importUrl && (
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-900 disabled:opacity-50"
              >
                <Sparkles size={15} strokeWidth={STROKE} aria-hidden className="text-brass-500" />
                {importing ? t("trip.newPlace.importing") : t("trip.newPlace.enrichWithAi")}
              </button>
            )}
            <button
              type="button"
              onClick={resetDraft}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-500"
            >
              <RotateCcw size={14} strokeWidth={STROKE} aria-hidden />
              {t("trip.newPlace.startOver")}
            </button>
          </div>
          {importing && (
            <p className="text-sm text-ink-500">{t("trip.newPlace.importWait")}</p>
          )}
          {importError && (
            <p role="alert" className="text-sm font-medium text-terra-600">
              {importError}
            </p>
          )}
        </section>
      )}

      {/* ── Extra fields, collapsed ── */}
      {showForm && (
        <details className="group rounded-2xl border border-cream-200 bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium text-ink-700 [&::-webkit-details-marker]:hidden">
            {hasDraft ? t("trip.newPlace.moreDetails") : t("trip.newPlace.moreDetailsOptional")}
            <ChevronDown
              size={16}
              strokeWidth={STROKE}
              aria-hidden
              className="shrink-0 text-ink-400 transition group-open:rotate-180"
            />
          </summary>
          <div className="space-y-3 border-t border-cream-100 px-4 pb-4 pt-3">
            {textField(t("trip.newPlace.fields.summary"), summary, setSummary, { multiline: true })}
            {reviewsSummary &&
              textField(t("trip.place.fields.reviews"), reviewsSummary, setReviewsSummary, {
                multiline: true,
              })}
            {popularDishes &&
              textField(t("trip.place.fields.dishes"), popularDishes, setPopularDishes)}
            {tips && textField(t("trip.place.fields.tips"), tips, setTips, { multiline: true })}
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
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-terra-600">
          {error}
        </p>
      )}

      {showForm && (
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary min-h-12 w-full py-3.5 text-base"
        >
          {saving ? t("common.saving") : t("trip.newPlace.submit")}
        </button>
      )}
    </form>
  );
}
