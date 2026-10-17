import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@together/shared/tokens";
import { BellRing } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";
import { notificationsAllowed, registerDevice } from "@/lib/push";

const LATER_KEY = "together.notifyLater";

/** "A reminder before each activity?" — asks for notifications on the Now screen, once. */
export function NotifyNudge() {
  const t = useT();
  const { locale } = useLocale();
  const [state, setState] = useState<"hidden" | "ask" | "denied" | "done">("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([notificationsAllowed(), AsyncStorage.getItem(LATER_KEY)])
      .then(([status, later]) => setState(status === "undetermined" && !later ? "ask" : "hidden"))
      .catch(() => undefined);
  }, []);

  if (state === "hidden") return null;

  async function enable() {
    setBusy(true);
    const result = await registerDevice(locale, t("trip.home.navigate"), true).catch(() => "unavailable" as const);
    setBusy(false);
    setState(result === "granted" ? "done" : result === "denied" ? "denied" : "hidden");
  }

  function later() {
    AsyncStorage.setItem(LATER_KEY, "1").catch(() => undefined);
    setState("hidden");
  }

  return (
    <Card style={{ padding: 18, gap: 10, borderColor: colors.brass300 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon icon={BellRing} size={20} color={colors.brass600} />
        <Text variant="headline" weight="semibold" style={{ flex: 1 }}>
          {t("trip.permissions.notify.title")}
        </Text>
      </View>
      {state === "ask" ? (
        <>
          <Text variant="small" color={colors.ink500}>
            {t("trip.permissions.notify.text")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label={t("trip.permissions.notify.enable")} onPress={enable} busy={busy} style={{ flex: 1 }} />
            <Button tone="soft" label={t("trip.permissions.notify.later")} onPress={later} />
          </View>
        </>
      ) : state === "done" ? (
        <Text variant="small" color={colors.route700}>
          {t("trip.permissions.notify.done")}
        </Text>
      ) : (
        <Text variant="small" color={colors.ink500} onPress={() => Linking.openSettings()}>
          {t("trip.permissions.notify.denied")}
        </Text>
      )}
    </Card>
  );
}
