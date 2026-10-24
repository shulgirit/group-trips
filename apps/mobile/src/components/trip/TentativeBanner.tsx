import { api } from "@together/backend/api";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { CalendarCheck, Send, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Shown on an AI-planned trip until its organizer publishes it: confirm real dates, then publish and invite. */
export function TentativeBanner() {
  const t = useT();
  const { id, doc, isAdmin } = useTrip();
  const confirmDates = useMutation(api.trips.confirmDates);
  const publish = useMutation(api.trips.publish);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(doc.startDate);
  if (!doc.tentative) return null;

  const confirm = async () => {
    await confirmDates({ tripId: id, startDate: start }).catch(() => undefined);
    setOpen(false);
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
      {isAdmin && (
        <View style={styles.actions}>
          {doc.datesApproximate && <Button tone="outline" icon={CalendarCheck} label={t("creator.planner.confirm")} onPress={() => setOpen(true)} style={{ flex: 1 }} />}
          <Button tone="brass" icon={Send} label={t("creator.planner.publish")} onPress={askPublish} style={{ flex: 1 }} />
        </View>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t("creator.planner.confirmTitle")}>
        <Text color={colors.ink500}>{t("creator.planner.confirmText")}</Text>
        <DateField value={start} onChange={setStart} label={t("creator.planner.confirmTitle")} min={new Date().toISOString().slice(0, 10)} />
        <Button label={t("creator.planner.confirm")} onPress={confirm} />
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10, marginTop: 12, borderColor: colors.brass500, borderRadius: radius.card },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
});
