import { formatNumber } from "@together/i18n/format";
import type { ChatCandidate } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import { ActivityIndicator, View } from "react-native";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";

/** "Tell me more" about a recommended place (a short briefing from the guide). */
export function InfoSheet({ target, text, loading, onClose }: { target: ChatCandidate | null; text: string; loading: boolean; onClose: () => void }) {
  const t = useT();
  const { locale } = useLocale();
  if (!target) return null;
  return (
    <Sheet open onClose={onClose} title={target.name}>
      {target.imageUrl ? <Image source={target.imageUrl} style={{ width: "100%", aspectRatio: 2, borderRadius: radius.card }} contentFit="cover" /> : null}
      {(target.area || target.rating) && (
        <Text variant="small" color={colors.ink500}>
          {target.area ?? ""}
          {target.rating ? `${target.area ? " · " : ""}★ ${target.rating}${target.ratingCount ? ` (${formatNumber(target.ratingCount, locale)})` : ""}` : ""}
        </Text>
      )}
      {loading ? (
        <View accessibilityLabel={t("ai.loadingInfo")} style={{ paddingVertical: 24 }}>
          <ActivityIndicator color={colors.ink500} />
        </View>
      ) : (
        <Text color={colors.ink700}>{text}</Text>
      )}
    </Sheet>
  );
}
