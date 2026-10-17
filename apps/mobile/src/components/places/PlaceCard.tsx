import type { Place } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, router } from "expo-router";
import { CalendarCheck, Heart, MapPin } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { categoryIcon } from "@/lib/glyphs";
import { type TKey, useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** A saved place as a photo card: category chip, name over the image, scheduled state. */
export function PlaceCard({ place, scheduled, distance }: { place: Place; scheduled: boolean; distance?: string | null }) {
  const t = useT();
  const { id } = useTrip();
  const category = t(`trip.categories.${place.category}` as TKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={place.name}
      onPress={() => router.push(`/t/${id}/place/${place.id}` as Href)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.photo}>
        {place.imageUrl ? (
          <Image source={place.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Icon icon={categoryIcon(place.category)} size={36} color="rgba(241,243,239,0.45)" />
          </View>
        )}
        <LinearGradient colors={["transparent", "rgba(7,12,22,0.7)"]} style={styles.shade} />
        <View style={styles.chip}>
          <Icon icon={categoryIcon(place.category)} size={13} color={colors.ink700} />
          <Text variant="caption" weight="medium" color={colors.ink700}>
            {category}
          </Text>
        </View>
        {place.favorite && (
          <View style={styles.heart}>
            <Icon icon={Heart} size={15} color={colors.terra500} />
          </View>
        )}
        <Text variant="title" color={colors.chart50} numberOfLines={1} style={styles.name}>
          {place.name}
        </Text>
      </View>
      <View style={styles.foot}>
        <View style={styles.meta}>
          {distance ? (
            <>
              <Icon icon={MapPin} size={12} color={colors.route700} />
              <Text variant="small" weight="medium" color={colors.route700}>
                {distance}
              </Text>
              <Text variant="small" color={colors.ink300}>
                ·
              </Text>
            </>
          ) : null}
          <Text variant="small" color={colors.ink500} numberOfLines={1} style={{ flexShrink: 1 }}>
            {place.area || category}
          </Text>
        </View>
        {scheduled ? (
          <View style={[styles.badge, { backgroundColor: colors.route100 }]}>
            <Icon icon={CalendarCheck} size={12} color={colors.route700} />
            <Text variant="caption" weight="medium" color={colors.route700}>
              {t("trip.placeCard.scheduled")}
            </Text>
          </View>
        ) : (
          <View style={[styles.badge, { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200 }]}>
            <Text variant="caption" color={colors.ink500}>
              {t("trip.placeCard.notScheduled")}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.chart200,
  },
  photo: { aspectRatio: 16 / 9, backgroundColor: colors.night900 },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.route700 },
  shade: { position: "absolute", start: 0, end: 0, bottom: 0, height: 80 },
  chip: {
    position: "absolute",
    top: 12,
    start: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(241,243,239,0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heart: {
    position: "absolute",
    top: 12,
    end: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(241,243,239,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { position: "absolute", start: 16, end: 16, bottom: 10 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
