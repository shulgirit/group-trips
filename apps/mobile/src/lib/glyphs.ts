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
} from "lucide-react-native";
import type { PlaceCategory } from "@together/shared/types";

/**
 * Stored glyph keys (trips, events, personas, legacy emoji) → lucide icons.
 * Same mapping as the web (apps/web/src/components/ui/Icon.tsx); emoji
 * never render in UI chrome.
 */

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
  "🏨": BedDouble,
  "🍽️": Utensils,
  "📌": MapPin,
  "🍝": Utensils,
  "🏡": BedDouble,
  "🅿️": SquareParking,
  "🎟️": Ticket,
  "🏛️": Landmark,
  "🚗": CarFront,
  "🍷": Wine,
  "❤️": Heart,
  "👨‍👩‍👧‍👦": Users,
};

/** Icon keys stored on events created by booking import and the AI. */
const EVENT_GLYPHS: Record<string, LucideIcon> = {
  plane: Plane,
  hotel: BedDouble,
  car: CarFront,
  ticket: Ticket,
  dining: Utensils,
  pin: MapPin,
  luggage: Luggage,
  users: Users,
  heart: Heart,
};

const KEY_TO_ICON: Record<string, LucideIcon> = {
  ...EVENT_GLYPHS,
  ...Object.fromEntries(TRIP_GLYPHS.map((g) => [g.key, g.Icon])),
  ...PERSONA_GLYPHS,
};

/** Resolves a stored glyph value (key or legacy emoji) to an icon. */
export function glyphIcon(value: string | null | undefined, fallback: LucideIcon = Sparkles): LucideIcon {
  if (!value) return fallback;
  return KEY_TO_ICON[value] ?? EMOJI_TO_ICON[value] ?? EMOJI_TO_ICON[value.replace(/️/g, "")] ?? fallback;
}


/** A place category's icon (unknown categories → pin). */
export function categoryIcon(category: string | null | undefined): LucideIcon {
  return CATEGORY_ICON[category as PlaceCategory] ?? MapPin;
}
