import { colors } from "@together/shared/tokens";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { glyphIcon } from "@/lib/glyphs";

/** The gallery robots, bundled (the web serves the same files from /avatars). */
const BOTS: Record<string, number> = {
  tog: require("../../../assets/avatars/tog.webp"),
  nova: require("../../../assets/avatars/nova.webp"),
  pilot: require("../../../assets/avatars/pilot.webp"),
  butler: require("../../../assets/avatars/butler.webp"),
  explorer: require("../../../assets/avatars/explorer.webp"),
  buddy: require("../../../assets/avatars/buddy.webp"),
};

/** "bot:<id>" → bundled robot; an http(s) URL → that image; else null. */
export function avatarSource(value: string | null | undefined): number | string | null {
  if (!value) return null;
  if (value.startsWith("bot:")) return BOTS[value.slice(4)] ?? null;
  return /^https?:\/\//.test(value) ? value : null;
}

/** The AI guide's face in a brass ring; falls back to the persona glyph. */
export function GuideAvatar({ avatar, emoji, size = 56 }: { avatar: string | null | undefined; emoji: string; size?: number }) {
  const source = avatarSource(avatar);
  return (
    <View style={[styles.ring, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
      <View style={[styles.face, { width: size, height: size, borderRadius: size / 2 }]}>
        {source ? (
          <Image source={source} style={{ width: size, height: size }} contentFit="cover" />
        ) : (
          <Icon icon={glyphIcon(emoji)} size={size * 0.45} color={colors.brass300} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, borderColor: colors.brass500, alignItems: "center", justifyContent: "center" },
  face: { backgroundColor: colors.night900, overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
