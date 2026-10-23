import { colors } from "@together/shared/tokens";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { formatShortDate } from "@together/i18n/format";
import { useLocale, useT } from "@/lib/i18n";

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const todayIso = () => {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * One calendar for a start and an end date: tap the first day, then the last.
 * Replaces two separate pickers; the range is drawn between the two days.
 */
export function DateRangeField({
  start,
  end,
  min,
  onChange,
  startLabel,
  endLabel,
}: {
  start: string;
  end: string;
  min?: string;
  onChange: (start: string, end: string) => void;
  startLabel: string;
  endLabel: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const seed = start || min || todayIso();
  const [view, setView] = useState({ y: Number(seed.slice(0, 4)), m: Number(seed.slice(5, 7)) - 1 });
  const floor = min || "";

  function openPicker() {
    setFrom(start);
    setTo(end);
    const base = start || min || todayIso();
    setView({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
    setOpen(true);
  }

  function pick(day: string) {
    if (floor && day < floor) return;
    if (!from || (from && to && to !== from) || day < from) {
      setFrom(day);
      setTo("");
    } else {
      setTo(day);
    }
  }

  const monthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar-u-nu-latn" : locale === "es" ? "es-ES" : "en-GB", { month: "long", year: "numeric" }).format(new Date(view.y, view.m, 1));
    } catch {
      return `${view.m + 1}/${view.y}`;
    }
  }, [view, locale]);

  const weekdays = useMemo(() => {
    const names = (() => {
      try {
        const f = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar" : locale === "es" ? "es-ES" : "en-GB", { weekday: "narrow" });
        return Array.from({ length: 7 }, (_, i) => f.format(new Date(2023, 0, 1 + i))); // Sunday first
      } catch {
        return ["S", "M", "T", "W", "T", "F", "S"];
      }
    })();
    return names;
  }, [locale]);

  const cells = useMemo(() => {
    const lead = new Date(view.y, view.m, 1).getDay(); // Sunday-first grid
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(iso(view.y, view.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const step = (delta: number) => setView((current) => {
    const d = new Date(current.y, current.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = todayIso();

  return (
    <>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          { label: startLabel, value: start },
          { label: endLabel, value: end },
        ].map((item) => (
          <View key={item.label} style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" color={colors.ink500}>
              {item.label}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={item.label} onPress={openPicker} style={styles.field}>
              <Text color={item.value ? colors.ink900 : colors.ink400} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>
                {item.value ? formatShortDate(item.value) : "—"}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet} edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]}>
          <View style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.ink500}>
                {startLabel}
              </Text>
              <Text variant="headline" weight="semibold" style={{ writingDirection: "ltr", alignSelf: "flex-start" }}>
                {from ? formatShortDate(from) : "—"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.ink500}>
                {endLabel}
              </Text>
              <Text variant="headline" weight="semibold" style={{ writingDirection: "ltr", alignSelf: "flex-start" }}>
                {to ? formatShortDate(to) : "—"}
              </Text>
            </View>
          </View>

          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" onPress={() => step(-1)} hitSlop={12} style={styles.nav}>
              <Icon icon={ChevronLeft} size={22} flip />
            </Pressable>
            <Text variant="title">{monthLabel}</Text>
            <Pressable accessibilityRole="button" onPress={() => step(1)} hitSlop={12} style={styles.nav}>
              <Icon icon={ChevronRight} size={22} flip />
            </Pressable>
          </View>

          <View style={styles.week}>
            {weekdays.map((name, i) => (
              <Text key={i} variant="caption" color={colors.ink500} align="center" style={{ flex: 1 }}>
                {name}
              </Text>
            ))}
          </View>

          <View style={{ paddingHorizontal: 12, gap: 4 }}>
            {rows.map((row, r) => (
              <View key={r} style={styles.week}>
                {row.map((day, c) => {
                  if (!day) return <View key={c} style={styles.cell} />;
                  const disabled = Boolean(floor && day < floor);
                  const isStart = day === from;
                  const isEnd = day === (to || from);
                  const inRange = Boolean(from && to && day > from && day < to);
                  return (
                    <Pressable key={c} disabled={disabled} onPress={() => pick(day)} style={[styles.cell, inRange && styles.range, (isStart || isEnd) && styles.edge]}>
                      <Text
                        weight={isStart || isEnd ? "semibold" : "regular"}
                        color={isStart || isEnd ? colors.chart50 : disabled ? colors.ink300 : day === today ? colors.route700 : colors.ink900}
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {Number(day.slice(8))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.foot}>
            <Button
              label={t("common.done")}
              disabled={!from}
              onPress={() => {
                onChange(from, to || from);
                setOpen(false);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 46, justifyContent: "center", paddingHorizontal: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, backgroundColor: colors.paper },
  sheet: { flex: 1, backgroundColor: colors.chart50 },
  summary: { flexDirection: "row", gap: 12, padding: 20, paddingBottom: 8 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 8 },
  nav: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  week: { flexDirection: "row", paddingHorizontal: 0 },
  cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999, marginVertical: 1 },
  range: { backgroundColor: colors.route100, borderRadius: 0 },
  edge: { backgroundColor: colors.ink900 },
  foot: { marginTop: "auto", padding: 20 },
});
