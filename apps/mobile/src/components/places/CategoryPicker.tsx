import { PLACE_CATEGORIES, type PlaceCategory } from "@together/shared/types";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { type TKey, useT } from "@/lib/i18n";

export const CATEGORY_IDS = Object.keys(PLACE_CATEGORIES) as PlaceCategory[];

export function CategoryPicker({ value, onChange }: { value: PlaceCategory; onChange: (next: PlaceCategory) => void }) {
  const t = useT();
  return (
    <ChipRow>
      {CATEGORY_IDS.map((id) => (
        <Chip key={id} label={t(`trip.categories.${id}` as TKey)} active={value === id} onPress={() => onChange(id)} />
      ))}
    </ChipRow>
  );
}
