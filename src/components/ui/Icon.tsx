import {
  BedDouble,
  Binoculars,
  Building2,
  CarFront,
  Castle,
  Citrus,
  Compass,
  ConciergeBell,
  Croissant,
  FerrisWheel,
  Globe,
  Heart,
  IceCreamCone,
  Landmark,
  Luggage,
  MapPin,
  Mountain,
  PartyPopper,
  Pizza,
  Plane,
  Sailboat,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Sparkles,
  SquareParking,
  Sun,
  Ticket,
  TreePalm,
  Users,
  Utensils,
  Volleyball,
  Waves,
  Wine,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { PlaceCategory } from "@/types";

/**
 * One icon language for the whole product: lucide outlines at a thin,
 * consistent stroke. Emoji never render in UI chrome — stored emoji
 * (trip "emoji", AI persona emoji, legacy data) map to these glyphs.
 */

export const STROKE = 1.5;

export const CATEGORY_ICON: Record<PlaceCategory, LucideIcon> = {
  attraction: FerrisWheel,
  restaurant: Utensils,
  beach: Waves,
  icecream: IceCreamCone,
  shopping: ShoppingBag,
  supermarket: ShoppingCart,
  viewpoint: Binoculars,
  parking: SquareParking,
  accommodation: BedDouble,
  sport: Volleyball,
  other: MapPin,
};

/** Curated trip glyphs offered in the creator (value = stored key). */
export const TRIP_GLYPHS: { key: string; Icon: LucideIcon }[] = [
  { key: "plane", Icon: Plane },
  { key: "sun", Icon: Sun },
  { key: "waves", Icon: Waves },
  { key: "mountain", Icon: Mountain },
  { key: "city", Icon: Building2 },
  { key: "palm", Icon: TreePalm },
  { key: "sail", Icon: Sailboat },
  { key: "wine", Icon: Wine },
  { key: "castle", Icon: Castle },
  { key: "globe", Icon: Globe },
];

/** AI persona glyphs (value = stored key in ai.emoji). */
export const PERSONA_GLYPHS: Record<string, LucideIcon> = {
  butler: ConciergeBell,
  pilot: Plane,
  buddy: Smile,
  guide: Compass,
  sparkles: Sparkles,
};

/** Legacy / stored emoji → glyph, so old data renders cleanly. */
const EMOJI_TO_ICON: Record<string, LucideIcon> = {
  "✈️": Plane,
  "✈": Plane,
  "🌴": TreePalm,
  "🏝️": TreePalm,
  "🏖️": Sun,
  "🏔️": Mountain,
  "🍋": Citrus,
  "🍕": Pizza,
  "🥐": Croissant,
  "🎉": PartyPopper,
  "🌍": Globe,
  "⛵": Sailboat,
  "🗺️": Globe,
  "🎩": ConciergeBell,
  "😎": Smile,
  "🧭": Compass,
  "🦻✨": Sparkles,
  "✈️✨": Plane,
  "🧳": Luggage,
  "🎟️": Ticket,
  "🏛️": Landmark,
  "🚗": CarFront,
  "🍷": Wine,
  "❤️": Heart,
  "👨‍👩‍👧‍👦": Users,
};

const KEY_TO_ICON: Record<string, LucideIcon> = {
  ...Object.fromEntries(TRIP_GLYPHS.map((g) => [g.key, g.Icon])),
  ...PERSONA_GLYPHS,
};

/** Resolves a stored glyph value (key or legacy emoji) to an icon. */
export function glyphIcon(value: string | null | undefined, fallback: LucideIcon = Sparkles): LucideIcon {
  if (!value) return fallback;
  return KEY_TO_ICON[value] ?? EMOJI_TO_ICON[value] ?? EMOJI_TO_ICON[value.replace(/️/g, "")] ?? fallback;
}

export function Glyph({
  value,
  fallback,
  size = 18,
  ...props
}: { value: string | null | undefined; fallback?: LucideIcon; size?: number } & Omit<LucideProps, "ref">) {
  const IconComponent = glyphIcon(value, fallback);
  return <IconComponent size={size} strokeWidth={STROKE} aria-hidden {...props} />;
}

export function CategoryIcon({
  category,
  size = 16,
  ...props
}: { category: string; size?: number } & Omit<LucideProps, "ref">) {
  const IconComponent = CATEGORY_ICON[category as PlaceCategory] ?? MapPin;
  return <IconComponent size={size} strokeWidth={STROKE} aria-hidden {...props} />;
}
