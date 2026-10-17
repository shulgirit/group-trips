import { formatNumber } from "@together/i18n/format";
import { PLACE_CATEGORIES, type ChatCandidate, type PlaceCategory } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import { Check, ChevronRight, Globe, Heart, Star, Vote, X } from "lucide-react-native";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { categoryIcon } from "@/lib/glyphs";
import { type TKey, useLocale, useT } from "@/lib/i18n";

/** A place the guide recommends: save to the trip, add to a poll, read more, dismiss. */
export function CandidateCard({
  candidate,
  busy,
  onSave,
  onOpenSaved,
  onPoll,
  onInfo,
  onDismiss,
}: {
  candidate: ChatCandidate;
  busy: boolean;
  onSave: () => void;
  onOpenSaved: () => void;
  onPoll: () => void;
  onInfo: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const category = (candidate.category in PLACE_CATEGORIES ? candidate.category : "other") as PlaceCategory;
  return (
    <Card style={{ overflow: "hidden" }}>
      {candidate.imageUrl ? <Image source={candidate.imageUrl} style={styles.photo} contentFit="cover" transition={150} /> : null}
      <View style={styles.body}>
        <View style={styles.head}>
          {!candidate.imageUrl && (
            <View style={styles.glyph}>
              <Icon icon={categoryIcon(category)} size={20} color={colors.route700} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" weight="medium" numberOfLines={2}>
              {candidate.name}
            </Text>
            <Text variant="small" color={colors.ink500}>
              {t(`trip.categories.${category}` as TKey)}
              {candidate.area ? ` · ${candidate.area}` : ""}
              {candidate.priceNotes ? ` · ${candidate.priceNotes}` : ""}
            </Text>
            {candidate.rating ? (
              <View style={styles.inline}>
                <Icon icon={Star} size={13} color={colors.brass600} />
                <Text variant="small" color={colors.ink700}>
                  {candidate.rating}
                  {candidate.ratingCount ? ` · ${t("ai.reviews", { count: candidate.ratingCount, n: formatNumber(candidate.ratingCount, locale) })}` : ""}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("ai.dismiss")} onPress={onDismiss} hitSlop={10}>
            <Icon icon={X} size={16} color={colors.ink300} />
          </Pressable>
        </View>
        <Text variant="small" color={colors.ink700}>
          {candidate.description}
        </Text>
        <View style={[styles.inline, { alignItems: "flex-start" }]}>
          <View style={{ marginTop: 3 }}>
            <Icon icon={Heart} size={14} color={colors.terra600} />
          </View>
          <Text variant="small" color={colors.terra600} style={{ flex: 1 }}>
            {candidate.why}
          </Text>
        </View>
        <View style={styles.actions}>
          {candidate.savedPlaceId ? (
            <Pressable accessibilityRole="button" onPress={onOpenSaved} style={[styles.action, { backgroundColor: colors.route100, borderColor: colors.route100 }]}>
              <Icon icon={Check} size={15} color={colors.route700} />
              <Text variant="small" weight="medium" color={colors.route700}>
                {t("ai.saved")}
              </Text>
              <Icon icon={ChevronRight} size={15} color={colors.route700} flip />
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={[styles.action, styles.primary, busy && { opacity: 0.6 }]}>
              <Text variant="small" weight="medium" color={colors.chart50}>
                {busy ? t("common.saving") : t("ai.savePlace")}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onPoll}
            style={[styles.action, candidate.polled && { backgroundColor: colors.brass100, borderColor: colors.brass300 }]}
          >
            <Icon icon={candidate.polled ? Check : Vote} size={15} color={colors.ink700} />
            <Text variant="small" color={colors.ink700}>
              {candidate.polled ? t("ai.inPoll") : t("ai.toPoll")}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onInfo} style={styles.action}>
            <Text variant="small" color={colors.ink700}>
              {t("ai.tellMore")}
            </Text>
          </Pressable>
          {candidate.website ? (
            <Pressable accessibilityRole="link" accessibilityLabel={t("ai.website")} onPress={() => Linking.openURL(candidate.website!)} style={styles.action}>
              <Icon icon={Globe} size={16} color={colors.ink700} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: "100%", aspectRatio: 2 },
  body: { padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  glyph: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    alignItems: "center",
    justifyContent: "center",
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  action: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  primary: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
});
