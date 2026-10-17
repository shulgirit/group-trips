import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { BOT_AVATARS } from "@together/shared/avatars";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Check, ImagePlus } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { avatarSource } from "@/components/trips/GuideAvatar";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { type TKey, useT } from "@/lib/i18n";
import { uploadToTrip } from "@/lib/upload";

/**
 * The guide's face: a gallery robot, or a photo the organizer picks (square,
 * 384px, stored with the trip so only members can read it).
 */
export function AvatarPicker({
  tripId,
  value,
  onChange,
}: {
  tripId: string | null;
  value: string | null;
  onChange: (avatar: string | null, storageId?: string | null) => void;
}) {
  const t = useT();
  const fileUrl = useMutation(api.documents.fileUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploaded = value && !value.startsWith("bot:") ? value : null;

  async function pick() {
    if (!tripId || uploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    setError("");
    try {
      const square = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 384, height: 384 } }], { compress: 0.85, format: SaveFormat.JPEG });
      const storageId = await uploadToTrip(tripId, square.uri, "image/jpeg");
      const url = await fileUrl({ tripId: tripId as Id<"trips">, storageId });
      onChange(url, storageId);
    } catch {
      setError(t("creator.ai.avatar.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text variant="small" weight="medium" color={colors.ink700}>
        {t("creator.ai.avatar.title")}
      </Text>
      <View style={styles.grid}>
        {BOT_AVATARS.map((id) => {
          const key = `bot:${id}`;
          const selected = value === key;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`creator.ai.avatar.bots.${id}` as TKey)}
              onPress={() => onChange(key)}
              style={[styles.tile, selected && styles.selected]}
            >
              <Image source={avatarSource(key)} style={StyleSheet.absoluteFill} contentFit="cover" />
              {selected && (
                <View style={styles.check}>
                  <Icon icon={Check} size={13} color={colors.night950} />
                </View>
              )}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(uploaded), disabled: !tripId || uploading }}
          disabled={!tripId || uploading}
          onPress={pick}
          style={[styles.tile, uploaded ? styles.selected : styles.upload, !tripId && { opacity: 0.5 }]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.ink500} />
          ) : uploaded ? (
            <Image source={uploaded} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <>
              <Icon icon={ImagePlus} size={20} color={colors.ink500} />
              <Text variant="caption" color={colors.ink500} align="center">
                {t("creator.ai.avatar.upload")}
              </Text>
            </>
          )}
        </Pressable>
      </View>
      <Text variant="caption" color={colors.ink500}>
        {value
          ? t(value.startsWith("bot:") ? (`creator.ai.avatar.bots.${value.slice(4)}` as TKey) : "creator.ai.avatar.yours")
          : t("creator.ai.avatar.hint")}
      </Text>
      {error ? (
        <Text variant="small" color={colors.terra600}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: colors.night900,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  selected: { borderWidth: 3, borderColor: colors.brass500 },
  upload: { backgroundColor: colors.paper, borderWidth: 1, borderStyle: "dashed", borderColor: colors.chart300, padding: 4 },
  check: { position: "absolute", top: 5, end: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brass500, alignItems: "center", justifyContent: "center" },
});
