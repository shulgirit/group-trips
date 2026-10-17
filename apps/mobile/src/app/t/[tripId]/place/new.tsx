import { api } from "@together/backend/api";
import { samePlaceName } from "@together/shared/place-name";
import { PLACE_CATEGORIES, type PlaceCategory } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { useAction, useMutation } from "convex/react";
import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import { ChevronRight, Link2, PenLine, RotateCcw, Search, Sparkles, Star, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { placeArgs } from "@/components/places/geo";
import { EMPTY_DRAFT, type PlaceDraft, PlaceFields } from "@/components/places/PlaceFields";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { categoryIcon } from "@/lib/glyphs";
import { useLocale, useT } from "@/lib/i18n";
import { usePlaces, useTrip } from "@/lib/trip";

type Method = "search" | "link" | "manual";
const METHODS: { id: Method; icon: LucideIcon }[] = [
  { id: "search", icon: Search },
  { id: "link", icon: Link2 },
  { id: "manual", icon: PenLine },
];

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

const asCategory = (value: string, fallback: PlaceCategory): PlaceCategory => (value in PLACE_CATEGORIES ? (value as PlaceCategory) : fallback);

/**
 * New place (modal): find it on Google by name, import it from a link with
 * AI, or fill it in by hand — then review and save. Duplicates are flagged
 * while typing (and the backend dedupes by name anyway).
 */
export default function NewPlace() {
  const t = useT();
  const { locale } = useLocale();
  const { id } = useTrip();
  const places = usePlaces();
  const draftFromUrl = useAction(api.placesAi.draftFromUrl);
  const searchPlaces = useAction(api.placesAi.search);
  const add = useMutation(api.places.add);

  const [method, setMethod] = useState<Method>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"search" | "import" | "save" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draft, setDraft] = useState<PlaceDraft>(EMPTY_DRAFT);
  const [extra, setExtra] = useState<{ lat: number | null; lng: number | null; sourceUrl: string; recommendedDurationMin: number | null }>({
    lat: null,
    lng: null,
    sourceUrl: "",
    recommendedDurationMin: null,
  });

  const duplicateOf = useMemo(
    () => (draft.name.trim().length < 3 ? null : ((places ?? []).find((p) => samePlaceName(p.name, draft.name)) ?? null)),
    [places, draft.name]
  );

  function reset() {
    setHasDraft(false);
    setDraft(EMPTY_DRAFT);
    setExtra({ lat: null, lng: null, sourceUrl: "", recommendedDurationMin: null });
    setMessage(null);
    setResults(null);
  }

  async function runSearch() {
    const text = query.trim();
    if (!text || busy) return;
    setBusy("search");
    setMessage(null);
    setResults(null);
    try {
      const found: SearchResult[] = await searchPlaces({ tripId: id, query: text });
      if (found.length) setResults(found);
      else setMessage({ text: t("trip.newPlace.notFound"), error: true });
    } catch {
      setMessage({ text: t("trip.newPlace.searchFailed"), error: true });
    } finally {
      setBusy(null);
    }
  }

  function pick(result: SearchResult) {
    setDraft({
      ...EMPTY_DRAFT,
      name: result.name,
      category: asCategory(result.category, "attraction"),
      area: result.area,
      address: result.address,
      website: result.website,
      imageUrl: result.imageUrl,
    });
    setExtra({ lat: result.lat, lng: result.lng, sourceUrl: "", recommendedDurationMin: null });
    if (result.website) setUrl(result.website);
    setResults(null);
    setHasDraft(true);
    setMessage({ text: t("trip.newPlace.found"), error: false });
  }

  async function runImport() {
    const link = url.trim();
    if (!link || busy) return;
    setBusy("import");
    setMessage(null);
    try {
      const imported = await draftFromUrl({ tripId: id, url: /^https?:\/\//.test(link) ? link : `https://${link}`, locale });
      setDraft({
        name: imported.name,
        category: asCategory(imported.category, "other"),
        area: imported.area,
        address: imported.address,
        summary: imported.summary,
        openingHours: imported.openingHours,
        priceNotes: imported.priceNotes,
        tips: imported.tips,
        popularDishes: imported.popularDishes,
        reviewsSummary: imported.reviewsSummary,
        website: imported.website,
        bookingUrl: imported.bookingUrl,
        imageUrl: imported.imageUrl,
      });
      setExtra({ lat: imported.lat, lng: imported.lng, sourceUrl: imported.sourceUrl, recommendedDurationMin: imported.recommendedDurationMin });
      setHasDraft(true);
      setMessage({ text: t("trip.newPlace.imported"), error: false });
    } catch {
      setMessage({ text: t("trip.newPlace.importFailed"), error: true });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (busy || !draft.name.trim()) return;
    setBusy("save");
    setMessage(null);
    try {
      const input = placeArgs({
        ...draft,
        name: draft.name.trim(),
        lat: extra.lat,
        lng: extra.lng,
        sourceUrl: extra.sourceUrl,
        recommendedDurationMin: extra.recommendedDurationMin,
      }) as Parameters<typeof add>[0]["input"];
      const { id: placeId } = await add({ tripId: id, input });
      router.replace(`/t/${id}/place/${placeId}` as Href);
    } catch {
      setMessage({ text: t("trip.newPlace.saveFailed"), error: true });
      setBusy(null);
    }
  }

  const showForm = hasDraft || method === "manual";

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 48 }}>
      {!hasDraft && (
        <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel={t("trip.newPlace.methodsAria")}>
          {METHODS.map((option) => {
            const active = method === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setMethod(option.id);
                  setMessage(null);
                }}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Icon icon={option.icon} size={15} color={active ? colors.ink900 : colors.ink500} />
                <Text variant="small" weight={active ? "semibold" : "regular"} color={active ? colors.ink900 : colors.ink500} numberOfLines={1}>
                  {t(`trip.newPlace.methods.${option.id}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!hasDraft && method === "search" && (
        <View style={{ gap: 12 }}>
          <Text variant="small" color={colors.ink500}>
            {t("trip.newPlace.searchHint")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Field
              value={query}
              onChangeText={setQuery}
              placeholder={t("trip.newPlace.searchPlaceholder")}
              accessibilityLabel={t("trip.newPlace.methods.search")}
              returnKeyType="search"
              onSubmitEditing={runSearch}
              autoFocus
              style={{ flex: 1 }}
            />
            <Button label={busy === "search" ? t("trip.newPlace.searching") : t("common.search")} onPress={runSearch} disabled={!query.trim()} busy={busy === "search"} />
          </View>
          {results && (
            <View style={styles.results}>
              {results.map((result, index) => (
                <Pressable
                  key={`${result.name}-${index}`}
                  accessibilityRole="button"
                  onPress={() => pick(result)}
                  style={({ pressed }) => [styles.result, index > 0 && styles.resultDivider, pressed && { backgroundColor: colors.chart100 }]}
                >
                  <View style={styles.resultThumb}>
                    {result.imageUrl ? (
                      <Image source={result.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Icon icon={categoryIcon(result.category)} size={20} color={colors.route700} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text weight="medium" numberOfLines={1}>
                      {result.name}
                    </Text>
                    <Text variant="small" color={colors.ink500} numberOfLines={1}>
                      {result.address || result.area}
                    </Text>
                    {result.rating ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon icon={Star} size={12} color={colors.brass500} />
                        <Text variant="caption" color={colors.ink500}>
                          {result.rating.toFixed(1)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Icon icon={ChevronRight} size={16} color={colors.ink300} flip />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {(method === "link" || hasDraft) && (
        <View style={{ gap: 10 }}>
          <Text variant="small" color={colors.ink500}>
            {t("trip.newPlace.importHint")}
          </Text>
          <Field
            value={url}
            onChangeText={setUrl}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{ writingDirection: "ltr", textAlign: "left" }}
          />
          <Button tone="soft" icon={Sparkles} label={busy === "import" ? t("trip.newPlace.importing") : t("trip.newPlace.importButton")} onPress={runImport} disabled={!url.trim()} busy={busy === "import"} />
          {busy === "import" && (
            <Text variant="caption" color={colors.ink500}>
              {t("trip.newPlace.importWait")}
            </Text>
          )}
        </View>
      )}

      {message && (
        <Text accessibilityRole={message.error ? "alert" : undefined} variant="small" weight="medium" color={message.error ? colors.terra600 : colors.route700}>
          {message.text}
        </Text>
      )}

      {method === "manual" && !hasDraft && (
        <Text variant="small" color={colors.ink500}>
          {t("trip.newPlace.manualHint")}
        </Text>
      )}

      {showForm && (
        <>
          {hasDraft && draft.imageUrl ? <Image source={draft.imageUrl} style={styles.preview} contentFit="cover" /> : null}
          <PlaceFields draft={draft} onChange={setDraft} autoFocusName={method === "manual" && !hasDraft} />
          {duplicateOf && (
            <Pressable accessibilityRole="link" onPress={() => router.replace(`/t/${id}/place/${duplicateOf.id}` as Href)} style={styles.duplicate}>
              <Icon icon={TriangleAlert} size={16} color={colors.brass600} />
              <Text variant="small" color={colors.ink700} style={{ flex: 1 }}>
                {t("trip.newPlace.duplicate", { name: duplicateOf.name })}
              </Text>
              <Icon icon={ChevronRight} size={16} color={colors.ink300} flip />
            </Pressable>
          )}
          <Button size="lg" label={busy === "save" ? t("common.saving") : t("trip.newPlace.submit")} onPress={save} disabled={!draft.name.trim()} busy={busy === "save"} />
          {hasDraft && (
            <View style={{ alignItems: "center" }}>
              <Button tone="outline" icon={RotateCcw} label={t("trip.newPlace.startOver")} onPress={reset} />
            </View>
          )}
        </>
      )}
      {busy === "search" && !results && <ActivityIndicator color={colors.ink500} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: colors.chart100, borderRadius: radius.field + 2, padding: 3 },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 42, borderRadius: radius.field, paddingHorizontal: 6 },
  segmentActive: { backgroundColor: colors.paper, shadowColor: colors.ink900, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  results: { backgroundColor: colors.paper, borderRadius: radius.card, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.chart200 },
  result: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 },
  resultDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart200 },
  resultThumb: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", backgroundColor: colors.route100, alignItems: "center", justifyContent: "center" },
  preview: { height: 180, borderRadius: radius.card },
  duplicate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.brass300,
    backgroundColor: colors.brass100,
    padding: 12,
  },
});
