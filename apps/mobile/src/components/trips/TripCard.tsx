import { formatShortDate } from "@together/i18n/format";
import { tripPhase } from "@together/shared/trip-doc";
import { todayIso } from "@together/shared/trip";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { CalendarDays, MapPin } from "lucide-react-native";
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
  /** Draft only: furthest wizard step reached (0-4) */
  draftStep?: number;
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
      style={({ pressed }) => [styles.card, { height: large ? 340 : 190 }, live && styles.live, pressed && { opacity: 0.92 }]}
    >
      {trip.coverImage ? (
        <Image source={trip.coverImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.empty]}>
          <Icon icon={glyphIcon(trip.emoji)} size={44} color="rgba(241,243,239,0.5)" />
        </View>
      )}
      <LinearGradient colors={["rgba(7,12,22,0.28)", "rgba(7,12,22,0)", "rgba(7,12,22,0.9)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.badge, live ? { backgroundColor: colors.route500, borderColor: colors.route500 } : null]}>
        {live ? <View style={styles.liveDot} /> : null}
        <Text variant="caption" weight="semibold" color={colors.chart50}>
          {badge}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text variant={large ? "displayLg" : "title"} color={colors.chart50} numberOfLines={large ? 2 : 1}>
          {trip.name}
        </Text>
        {trip.status === "draft" ? (
          <View style={{ gap: 6 }}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round((((trip.draftStep ?? 2) + 1) / 5) * 100)}%` }]} />
            </View>
            <Text variant="small" weight="medium" color={colors.brass300}>
              {t("product.card.draftContinue", { n: Math.min((trip.draftStep ?? 2) + 1, 5), total: 5 })}
            </Text>
          </View>
        ) : null}
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Icon icon={CalendarDays} size={13} color="rgba(241,243,239,0.8)" />
            <Text variant="small" color="rgba(241,243,239,0.85)">
              {formatShortDate(trip.startDate)}–{formatShortDate(trip.endDate)}
            </Text>
          </View>
          {trip.stops.length > 0 ? (
            <View style={[styles.metaItem, { flexShrink: 1 }]}>
              <Icon icon={MapPin} size={13} color="rgba(241,243,239,0.8)" />
              <Text variant="small" color="rgba(241,243,239,0.85)" numberOfLines={1}>
                {trip.stops.join(" · ")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, overflow: "hidden", backgroundColor: colors.night900, shadowColor: colors.ink900, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  live: { borderWidth: 2, borderColor: colors.route500 },
  empty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.night900 },
  badge: { position: "absolute", top: 14, start: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(11,19,34,0.55)", borderWidth: StyleSheet.hairlineWidth * 2, borderColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.brass500 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.chart50 },
  meta: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  footer: { position: "absolute", start: 20, end: 20, bottom: 18, gap: 8 },
});
