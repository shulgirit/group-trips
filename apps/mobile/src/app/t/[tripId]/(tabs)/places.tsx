import type { Place } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import * as Location from "expo-location";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { List, LocateFixed, Map as MapIcon, MapPin, Plus, Search, X, type LucideIcon } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { distanceMeters, type Fix, hasCoords } from "@/components/places/geo";
import { PlaceCard } from "@/components/places/PlaceCard";
import { PlacesMap } from "@/components/places/PlacesMap";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { type TKey, useT } from "@/lib/i18n";
import { useEvents, useHomeBase, usePlaces, useTrip } from "@/lib/trip";

const FILTERS = ["all", "near", "attractions", "food", "beach", "shopping", "unscheduled", "scheduled", "favorites"] as const;
type FilterId = (typeof FILTERS)[number];

function matches(place: Place, filter: FilterId, scheduled: Set<string>): boolean {
  switch (filter) {
    case "all":
    case "near":
      return true;
    case "attractions":
      return ["attraction", "viewpoint"].includes(place.category);
    case "food":
      return ["restaurant", "icecream"].includes(place.category);
    case "beach":
      return place.category === "beach";
    case "shopping":
      return ["shopping", "supermarket"].includes(place.category);
    case "unscheduled":
      return !scheduled.has(place.id);
    case "scheduled":
      return scheduled.has(place.id);
    case "favorites":
      return Boolean(place.favorite);
  }
}

type LocationState = "idle" | "locating" | "on" | "denied" | "unavailable";

/** Saved places: search, filters (incl. near me), and a list ⇄ map switch (?view=map). */
export default function Places() {
  const t = useT();
  const { id, config } = useTrip();
  const params = useLocalSearchParams<{ view?: string }>();
  const places = usePlaces();
  const events = useEvents();
  const home = useHomeBase();
  const [view, setView] = useState<"list" | "map">(params.view === "map" ? "map" : "list");
  // A deep link (?view=map from Now) switches the view
  const [linkedView, setLinkedView] = useState(params.view);
  if (params.view !== linkedView) {
    setLinkedView(params.view);
    if (params.view === "map" || params.view === "list") setView(params.view);
  }
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [fix, setFix] = useState<Fix | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");

  const scheduled = useMemo(() => new Set((events ?? []).map((e) => e.placeId).filter((x): x is string => Boolean(x))), [events]);

  async function locate() {
    setLocationState("locating");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return setLocationState("denied");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setFix({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationState("on");
    } catch {
      setLocationState("unavailable");
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (places ?? []).filter(
      (place) =>
        matches(place, filter, scheduled) &&
        (!term || [place.name, place.area, place.address].some((field) => field?.toLowerCase().includes(term)))
    );
    if (filter !== "near" || !fix) return list;
    const distance = (place: Place) => (hasCoords(place) ? distanceMeters(fix, place) : Number.POSITIVE_INFINITY);
    return [...list].sort((a, b) => distance(a) - distance(b));
  }, [places, search, filter, scheduled, fix]);

  function distanceLabel(place: Place): string | null {
    if (!fix || !hasCoords(place)) return null;
    const meters = distanceMeters(fix, place);
    return meters < 1000
      ? t("trip.units.meters", { value: Math.round(meters / 10) * 10 })
      : t("trip.units.km", { value: +(meters / 1000).toFixed(meters < 10_000 ? 1 : 0) });
  }

  const header = (
    <View style={{ gap: 14, paddingBottom: 14 }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text variant="small" color={colors.ink500}>
            {config.kicker}
          </Text>
          <Text variant="display">{t("trip.places.title")}</Text>
          {places && places.length > 0 && (
            <Text variant="small" color={colors.ink500}>
              {t("trip.places.count", { count: places.length })}
            </Text>
          )}
        </View>
        <Button icon={Plus} label={t("trip.places.add")} onPress={() => router.push(`/t/${id}/place/new` as Href)} />
      </View>
      <View style={styles.segment} accessibilityRole="tablist">
        {(
          [
            { id: "list", label: t("trip.places.title"), icon: List },
            { id: "map", label: t("trip.map.title"), icon: MapIcon },
          ] as { id: "list" | "map"; label: string; icon: LucideIcon }[]
        ).map((option) => {
          const active = view === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setView(option.id)}
              style={[styles.segmentItem, active && styles.segmentActive]}
            >
              <Icon icon={option.icon} size={16} color={active ? colors.ink900 : colors.ink500} />
              <Text variant="small" weight={active ? "semibold" : "regular"} color={active ? colors.ink900 : colors.ink500}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {view === "list" && (
        <>
          <View style={styles.search}>
            <Icon icon={Search} size={17} color={colors.ink400} />
            <Field
              value={search}
              onChangeText={setSearch}
              placeholder={t("trip.places.searchPlaceholder")}
              accessibilityLabel={t("trip.places.searchAria")}
              returnKeyType="search"
              style={{ flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 8 }}
            />
            {search ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t("trip.places.clearSearch")} onPress={() => setSearch("")} hitSlop={10} style={{ padding: 8 }}>
                <Icon icon={X} size={16} color={colors.ink400} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
            {FILTERS.map((filterId) => (
              <Chip
                key={filterId}
                label={t(`trip.places.filters.${filterId}` as TKey)}
                active={filter === filterId}
                onPress={() => {
                  setFilter(filterId);
                  if (filterId === "near" && locationState !== "on") void locate();
                }}
              />
            ))}
          </ScrollView>
          {filter === "near" && !fix && (
            <View style={styles.locationNote}>
              <Icon icon={LocateFixed} size={16} color={colors.ink500} />
              <Text variant="small" color={colors.ink700} style={{ flex: 1 }}>
                {locationState === "denied"
                  ? t("trip.places.locationDenied")
                  : locationState === "unavailable"
                    ? t("trip.places.locationUnavailable")
                    : t("trip.places.locating")}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  if (view === "map") {
    return (
      <SafeAreaView edges={["top"]} style={styles.root}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>{header}</View>
        {places === undefined ? (
          <ActivityIndicator color={colors.ink500} style={{ marginTop: 40 }} />
        ) : (
          <PlacesMap places={places} home={home ?? null} scheduledIds={scheduled} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <FlatList
        data={places === undefined ? [] : visible}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120, gap: 16 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PlaceCard place={item} scheduled={scheduled.has(item.id)} distance={filter === "near" ? distanceLabel(item) : null} />}
        ListEmptyComponent={
          places === undefined ? (
            <ActivityIndicator color={colors.ink500} style={{ marginTop: 32 }} />
          ) : (
            <Card style={styles.empty}>
              <Icon icon={places.length ? Search : MapPin} size={28} color={colors.ink400} />
              <Text variant="headline" weight="medium" align="center">
                {places.length ? t("trip.places.noResultsTitle") : t("trip.places.emptyTitle")}
              </Text>
              <Text variant="small" color={colors.ink500} align="center">
                {places.length ? t("trip.places.noResultsDescription") : t("trip.places.emptyDescription")}
              </Text>
              {places.length ? (
                <Button
                  tone="soft"
                  label={t("trip.places.filters.all")}
                  onPress={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                />
              ) : (
                <Button icon={Plus} label={t("trip.places.addFirst")} onPress={() => router.push(`/t/${id}/place/new` as Href)} />
              )}
            </Card>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chart50 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  segment: { flexDirection: "row", backgroundColor: colors.chart100, borderRadius: radius.field + 2, padding: 3 },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40, borderRadius: radius.field },
  segmentActive: { backgroundColor: colors.paper, shadowColor: colors.ink900, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingStart: 14,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  locationNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.chart100, borderRadius: radius.field, padding: 12 },
  empty: { padding: 24, gap: 10, alignItems: "center" },
});
