import type { PlaceCategory } from "@together/shared/types";
import { colors } from "@together/shared/tokens";
import { View } from "react-native";
import { Field } from "@/components/ui/Field";
import { Labeled } from "@/components/ui/Label";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { CategoryPicker } from "./CategoryPicker";

/** The editable text fields of a place (draft shape shared by add and edit). */
export interface PlaceDraft {
  name: string;
  category: PlaceCategory;
  area: string;
  address: string;
  summary: string;
  openingHours: string;
  priceNotes: string;
  tips: string;
  popularDishes: string;
  reviewsSummary: string;
  website: string;
  bookingUrl: string;
  imageUrl: string;
}

export const EMPTY_DRAFT: PlaceDraft = {
  name: "",
  category: "attraction",
  area: "",
  address: "",
  summary: "",
  openingHours: "",
  priceNotes: "",
  tips: "",
  popularDishes: "",
  reviewsSummary: "",
  website: "",
  bookingUrl: "",
  imageUrl: "",
};

/** Name, category, then the optional details. */
export function PlaceFields({ draft, onChange, autoFocusName }: { draft: PlaceDraft; onChange: (next: PlaceDraft) => void; autoFocusName?: boolean }) {
  const t = useT();
  const set = (key: keyof PlaceDraft) => (value: string) => onChange({ ...draft, [key]: value });
  const text = (label: string, key: keyof PlaceDraft, options?: { ltr?: boolean; multiline?: boolean; placeholder?: string }) => (
    <Labeled key={key} label={label}>
      <Field
        value={draft[key] as string}
        onChangeText={set(key)}
        placeholder={options?.placeholder}
        multiline={options?.multiline}
        autoCapitalize={options?.ltr ? "none" : "sentences"}
        autoCorrect={!options?.ltr}
        keyboardType={options?.ltr ? "url" : "default"}
        style={[options?.multiline ? { minHeight: 84, textAlignVertical: "top" } : null, options?.ltr ? { writingDirection: "ltr", textAlign: "left" } : null]}
      />
    </Labeled>
  );
  return (
    <View style={{ gap: 18 }}>
      <Labeled label={t("trip.newPlace.name")}>
        <Field value={draft.name} onChangeText={set("name")} placeholder={t("trip.newPlace.namePlaceholder")} large autoFocus={autoFocusName} />
      </Labeled>
      <Labeled label={t("trip.newPlace.category")}>
        <CategoryPicker value={draft.category} onChange={(category) => onChange({ ...draft, category })} />
      </Labeled>
      <Text variant="headline" weight="semibold" color={colors.ink700}>
        {t("trip.newPlace.moreDetailsOptional")}
      </Text>
      {text(t("trip.newPlace.fields.summary"), "summary", { multiline: true })}
      {text(t("trip.newPlace.fields.area"), "area", { placeholder: t("trip.newPlace.fields.areaPlaceholder") })}
      {text(t("trip.place.fields.address"), "address")}
      {text(t("trip.place.fields.openingHours"), "openingHours")}
      {text(t("trip.newPlace.fields.prices"), "priceNotes")}
      {text(t("trip.place.fields.tips"), "tips", { multiline: true })}
      {draft.category === "restaurant" ? text(t("trip.place.fields.dishes"), "popularDishes", { multiline: true }) : null}
      {text(t("trip.newPlace.fields.website"), "website", { ltr: true })}
      {text(t("trip.newPlace.fields.bookingUrl"), "bookingUrl", { ltr: true })}
      {text(t("trip.newPlace.fields.imageUrl"), "imageUrl", { ltr: true })}
    </View>
  );
}
