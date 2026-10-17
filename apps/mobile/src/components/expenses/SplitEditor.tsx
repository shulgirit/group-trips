import { formatNumber } from "@together/i18n/format";
import { currencySymbol, type Currency } from "@together/shared/currency";
import type { Family } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { Check, Minus, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Stored Hebrew family names start with "Family" (mishpachat) — dropped in tight UI. */
const FAMILY_PREFIX = "משפחת ";

export function shortFamilyName(name: string): string {
  return name.replace(FAMILY_PREFIX, "");
}

/** Add/edit split state; `counts` is sparse (a family without one counts in full). */
export interface SplitState {
  everyone: boolean;
  participantIds: string[];
  byPeople: boolean;
  counts: Record<string, number>;
}

// Fair by default — families differ in size
export const DEFAULT_SPLIT: SplitState = { everyone: true, participantIds: [], byPeople: true, counts: {} };

const participating = (families: Family[], split: SplitState) =>
  split.everyone ? families : families.filter((f) => split.participantIds.includes(f.id));
const countFor = (split: SplitState, family: Family) => split.counts[family.id] ?? family.members.length;
const totalPeople = (families: Family[], split: SplitState) =>
  participating(families, split).reduce((sum, family) => sum + countFor(split, family), 0);

/** Why the split can't be saved (null = fine). */
export function splitProblem(families: Family[], split: SplitState): "pick" | "person" | null {
  if (!split.everyone && split.participantIds.length === 0) return "pick";
  if (split.byPeople && totalPeople(families, split) <= 0) return "person";
  return null;
}

export function splitPayload(families: Family[], split: SplitState): { participantFamilyIds: string[] | null; participantCounts?: Record<string, number> } {
  if (!split.byPeople) return { participantFamilyIds: split.everyone ? null : split.participantIds };
  // Counts mode always writes explicit family ids matching the counts
  const counted = participating(families, split).filter((family) => countFor(split, family) > 0);
  return {
    participantFamilyIds: counted.map((family) => family.id),
    participantCounts: Object.fromEntries(counted.map((family) => [family.id, countFor(split, family)])),
  };
}

function Check2({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={styles.check}>
      <View style={[styles.box, on && styles.boxOn]}>{on && <Icon icon={Check} size={13} color={colors.chart50} />}</View>
      <Text variant="small" color={colors.ink700} style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Who shares the expense: everyone or some units, optionally by head count. */
export function SplitEditor({
  families,
  split,
  onChange,
  amount,
  currency,
}: {
  families: Family[];
  split: SplitState;
  onChange: (next: SplitState) => void;
  amount?: number;
  currency: Currency;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { config } = useTrip();
  const shown = participating(families, split);
  const total = totalPeople(families, split);
  const setCount = (family: Family, next: number) =>
    onChange({ ...split, counts: { ...split.counts, [family.id]: Math.min(family.members.length, Math.max(0, next)) } });

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 10 }}>
        <Check2 on={split.everyone} label={config.group.splitEveryoneLabel} onPress={() => onChange({ ...split, everyone: !split.everyone })} />
        {!split.everyone && (
          <ChipRow>
            {families.map((family) => (
              <Chip
                key={family.id}
                label={shortFamilyName(family.name)}
                active={split.participantIds.includes(family.id)}
                onPress={() =>
                  onChange({
                    ...split,
                    participantIds: split.participantIds.includes(family.id)
                      ? split.participantIds.filter((id) => id !== family.id)
                      : [...split.participantIds, family.id],
                  })
                }
              />
            ))}
          </ChipRow>
        )}
      </View>
      <View style={{ gap: 10 }}>
        <Check2 on={split.byPeople} label={t("money.split.byPeople")} onPress={() => onChange({ ...split, byPeople: !split.byPeople })} />
        {split.byPeople && shown.length > 0 && (
          <View style={styles.counts}>
            {shown.map((family) => (
              <View key={family.id} style={styles.countRow}>
                <Text variant="small" color={colors.ink700} style={{ flex: 1 }}>
                  {shortFamilyName(family.name)}
                  <Text variant="small" color={colors.ink400}>
                    {` · ${t("money.split.outOf", { count: family.members.length })}`}
                  </Text>
                </Text>
                <View style={styles.stepper}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("money.split.fewer", { family: family.name })} onPress={() => setCount(family, countFor(split, family) - 1)} style={styles.step}>
                    <Icon icon={Minus} size={16} color={colors.ink700} />
                  </Pressable>
                  <Text style={{ width: 28, textAlign: "center", fontVariant: ["tabular-nums"] }}>{countFor(split, family)}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("money.split.more", { family: family.name })} onPress={() => setCount(family, countFor(split, family) + 1)} style={styles.step}>
                    <Icon icon={Plus} size={16} color={colors.ink700} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Text variant="small" color={colors.ink500} style={{ paddingVertical: 10 }}>
              {t("money.split.totalPeople", { count: total })}
              {amount && total > 0 ? ` · ≈ ${currencySymbol(currency)}${formatNumber(amount / total, locale, 1)} ${t("money.split.perPerson")}` : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.chart300, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.route700, borderColor: colors.route700 },
  counts: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, backgroundColor: colors.chart50, paddingHorizontal: 12 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.chart200 },
  stepper: { flexDirection: "row", direction: "ltr", alignItems: "center", borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, backgroundColor: colors.paper, padding: 2 },
  step: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
