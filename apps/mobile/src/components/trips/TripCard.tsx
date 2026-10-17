import { formatShortDate } from "@together/i18n/format";
import { tripPhase } from "@together/shared/trip-doc";
import { todayIso } from "@together/shared/trip";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { glyphIcon } from "@/lib/glyphs";
import { useT } from "@/lib/i18n";

export interface TripRow {
  id: string;
  name: string;
  emoji: string;
  stops: string[];
  startDate: string;
  endDate: string;
  coverImage: string | null;
  status: "draft" | "active" | "archived";
}

function daysUntil(dateIso: string, today: string) {
  return Math.round((Date.parse(`${dateIso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/** A trip as a photo card: cover (or night ground), phase badge, name and dates. */
export function TripCard({ trip, large = false }: { trip: TripRow; large?: boolean }) {
  const t = useT();
  const today = todayIso();
  const phase = tripPhase(trip, today);
  const days = daysUntil(trip.startDate, today);
  const badge =
    trip.status === "draft"
      ? t("product.card.draft")
      : phase === "live"
        ? t("product.card.live")
        : phase === "upcoming"
          ? days === 1
            ? t("product.card.tomorrow")
            : t("product.card.inDays", { count: days })
          : t("product.card.past");
  const live = phase === "live" && trip.status !== "draft";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.name}, ${badge}`}
      onPress={() => router.push(trip.status === "draft" ? `/new?trip=${trip.id}` : `/t/${trip.id}`)}
      style={({ pressed }) => [styles.card, { height: large ? 260 : 180 }, live && styles.live, pressed && { opacity: 0.92 }]}
    >
      {trip.coverImage ? (
        <Image source={trip.coverImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.empty]}>
          <Icon icon={glyphIcon(trip.emoji)} size={44} color="rgba(241,243,239,0.5)" />
        </View>
      )}
      <LinearGradient colors={["transparent", "rgba(7,12,22,0.85)"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.badge, live ? { backgroundColor: colors.route500 } : null]}>
        <Text variant="caption" weight="medium" color={live ? colors.chart50 : colors.ink900}>
          {badge}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text variant="small" color="rgba(241,243,239,0.8)">
          {trip.stops.join(" · ")} · {formatShortDate(trip.startDate)}–{formatShortDate(trip.endDate)}
        </Text>
        <Text variant={large ? "display" : "title"} color={colors.chart50} numberOfLines={1}>
          {trip.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, overflow: "hidden", backgroundColor: colors.night900 },
  live: { borderWidth: 2, borderColor: colors.route500 },
  empty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.night900 },
  badge: { position: "absolute", top: 14, start: 14, backgroundColor: "rgba(241,243,239,0.92)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  footer: { position: "absolute", start: 18, end: 18, bottom: 16, gap: 4 },
});
