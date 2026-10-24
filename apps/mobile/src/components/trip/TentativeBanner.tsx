import { api } from "@together/backend/api";
import { colors, radius } from "@together/shared/tokens";
import { daysBetween } from "@together/shared/holidays";
import { useAction, useMutation } from "convex/react";
import { CalendarRange, Send, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { type Href, router } from "expo-router";
import { Pressable } from "react-native";
import { errorReason } from "@/lib/convert";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Shown on an AI-planned trip until its organizer publishes it: confirm real dates, then publish and invite. */
export function TentativeBanner() {
  const t = useT();
  const { id, doc, isAdmin } = useTrip();
  const adjustDates = useAction(api.planner.adjustDates);
  const publish = useMutation(api.trips.publish);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ start: doc.startDate, end: doc.endDate });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"failed" | "blocked" | null>(null);
  if (!doc.tentative) return null;

  const current = daysBetween(doc.startDate, doc.endDate);
  const chosen = range.start && range.end ? daysBetween(range.start, range.end) : current;
  const openSheet = () => {
    setRange({ start: doc.startDate, end: doc.endDate });
    setError(null);
    setOpen(true);
  };
  /** The AI reshapes the plan to the chosen dates: drops days when shorter, plans extra days when longer. */
  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      await adjustDates({ tripId: id, startDate: range.start, endDate: range.end });
      setOpen(false);
    } catch (err) {
      setError(errorReason(err) === "bookings_in_the_way" ? "blocked" : "failed");
    } finally {
      setBusy(false);
    }
  };
  const askPublish = () =>
    Alert.alert(t("creator.planner.publishTitle"), t("creator.planner.publishText"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("creator.planner.publish"), onPress: () => void publish({ tripId: id }).catch(() => undefined) },
    ]);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Icon icon={Sparkles} size={18} color={colors.brass600} />
        <Text weight="semibold" color={colors.brass600}>
          {t("creator.planner.bannerTitle")}
        </Text>
      </View>
      {doc.datesApproximate ? (
        <Text variant="small" color={colors.ink700}>
          {t("creator.planner.bannerText")}
        </Text>
      ) : null}
      <Pressable accessibilityRole="link" onPress={() => router.push(`/t/${id}/import` as Href)} hitSlop={8}>
        <Text variant="small" weight="medium" color={colors.route700}>
          {t("creator.planner.bookCta")}
        </Text>
      </Pressable>
      {isAdmin && (
        <View style={styles.actions}>
          <Button tone="outline" icon={CalendarRange} label={t("creator.planner.editDates")} onPress={openSheet} style={{ flex: 1 }} />
          <Button tone="brass" icon={Send} label={t("creator.planner.publish")} onPress={askPublish} style={{ flex: 1 }} />
        </View>
      )}
      <Sheet open={open} onClose={() => (busy ? undefined : setOpen(false))} title={t("creator.planner.editTitle")}>
        <Text color={colors.ink500}>{t("creator.planner.editHint")}</Text>
        <DateRangeField
          start={range.start}
          end={range.end}
          min={new Date().toISOString().slice(0, 10)}
          startLabel={t("creator.where.depart")}
          endLabel={t("creator.where.return")}
          onChange={(start, end) => setRange({ start, end })}
        />
        <Text weight="semibold" color={chosen === current ? colors.ink500 : colors.brass600}>
          {chosen === current ? t("creator.planner.editSame", { count: chosen }) : chosen < current ? t("creator.planner.editShorter", { from: current, to: chosen }) : t("creator.planner.editLonger", { from: current, to: chosen })}
        </Text>
        {error && (
          <Text variant="small" color={colors.terra600}>
            {error === "blocked" ? t("creator.planner.editBlocked") : t("creator.planner.editFailed")}
          </Text>
        )}
        {busy ? (
          <View style={styles.working}>
            <ActivityIndicator color={colors.ink900} />
            <Text color={colors.ink500}>{t("creator.planner.editWorking")}</Text>
          </View>
        ) : (
          <Button label={t("creator.planner.editApply")} onPress={apply} disabled={!range.start || !range.end} />
        )}
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10, marginTop: 12, borderColor: colors.brass500, borderRadius: radius.card },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  working: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
});
