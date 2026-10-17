import type { Place } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import { ChevronRight, House, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { categoryIcon } from "@/lib/glyphs";
import { type TKey, useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";
import { hasCoords } from "./geo";

/**
 * Saved places as pins (system map provider: Apple Maps on iOS, Google on
 * Android). Tapping a pin shows a small card that opens the place.
 */
export function PlacesMap({ places, home, scheduledIds }: { places: Place[]; home: Place | null; scheduledIds: Set<string> }) {
  const t = useT();
  const { id, config } = useTrip();
  const [selected, setSelected] = useState<Place | null>(null);
  const pinned = useMemo(() => places.filter(hasCoords) as (Place & { lat: number; lng: number })[], [places]);
  const missing = places.length - pinned.length;

  const region = useMemo<Region>(() => {
    const points = pinned.length ? pinned : [{ lat: config.mapCenter.lat, lng: config.mapCenter.lng }];
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.05, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.05, (maxLng - minLng) * 1.4),
    };
  }, [pinned, config.mapCenter]);

  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region} showsUserLocation showsMyLocationButton onPress={() => setSelected(null)}>
        {pinned.map((place) => {
          const isHome = home?.id === place.id;
          const scheduled = scheduledIds.has(place.id);
          return (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              onPress={(event) => {
                event.stopPropagation();
                setSelected(place);
              }}
              tracksViewChanges={false}
              accessibilityLabel={place.name}
            >
              <View style={[styles.pin, isHome ? styles.pinHome : scheduled ? styles.pinScheduled : null, selected?.id === place.id && styles.pinSelected]}>
                <Icon icon={isHome ? House : categoryIcon(place.category)} size={15} color={isHome || scheduled ? colors.chart50 : colors.ink900} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {missing > 0 && !selected && (
        <View style={styles.notice}>
          <Text variant="caption" color={colors.ink700}>
            {t("trip.map.missingCoords", { count: missing })}
          </Text>
        </View>
      )}

      {selected && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selected.name}
          onPress={() => router.push(`/t/${id}/place/${selected.id}` as Href)}
          style={styles.card}
        >
          <View style={styles.thumb}>
            {selected.imageUrl ? (
              <Image source={selected.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Icon icon={categoryIcon(selected.category)} size={22} color={colors.route700} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="medium" numberOfLines={1}>
              {selected.name}
            </Text>
            <Text variant="small" color={colors.ink500} numberOfLines={1}>
              {selected.area || t(`trip.categories.${selected.category}` as TKey)}
            </Text>
          </View>
          <Icon icon={ChevronRight} size={18} color={colors.ink400} flip />
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => setSelected(null)} hitSlop={10} style={styles.close}>
            <Icon icon={X} size={14} color={colors.ink500} />
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink900,
    alignItems: "center",
    justifyContent: "center",
  },
  pinScheduled: { backgroundColor: colors.route500, borderColor: colors.paper },
  pinHome: { backgroundColor: colors.brass500, borderColor: colors.paper },
  pinSelected: { transform: [{ scale: 1.25 }] },
  notice: { position: "absolute", start: 16, end: 16, bottom: 110, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: radius.field, padding: 10 },
  card: {
    position: "absolute",
    start: 16,
    end: 16,
    bottom: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
    shadowColor: colors.ink900,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", backgroundColor: colors.route100, alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", top: 6, end: 6 },
});
