import { colors } from "@together/shared/tokens";
import type { LucideIcon } from "lucide-react-native";
import { I18nManager } from "react-native";

export const STROKE = 1.75;

/** A lucide icon in the house stroke; `flip` mirrors directional icons in RTL. */
export function Icon({ icon: Glyph, size = 20, color = colors.ink900, flip = false }: { icon: LucideIcon; size?: number; color?: string; flip?: boolean }) {
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={STROKE}
      style={flip && I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );
}
