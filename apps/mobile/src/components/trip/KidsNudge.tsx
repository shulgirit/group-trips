import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@together/shared/tokens";
import { type Href, router } from "expo-router";
import { Baby } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { useFamilies, useMembers, useTrip } from "@/lib/trip";

/**
 * Organizers only: kids on the roster whose phone isn't connected yet. After
 * the move from Firebase, kids no longer sign in by picking their name — each
 * needs a kid invite link. Hides itself once every kid has a seat, or when
 * dismissed (per trip).
 */
export function KidsNudge() {
  const t = useT();
  const { id, isAdmin } = useTrip();
  const families = useFamilies();
  const members = useMembers();
  const key = `together.kidsNudge.${id}`;
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((value) => setDismissed(value === "1"))
      .catch(() => setDismissed(false));
  }, [key]);

  if (!isAdmin || dismissed || !families || !members) return null;
  const connected = new Set(members.map((member) => member.memberKey).filter(Boolean));
  const waiting = families.flatMap((family) => family.members).filter((member) => member.kid && !connected.has(member.id));
  if (!waiting.length) return null;

  return (
    <Card style={{ padding: 18, gap: 10, borderColor: colors.brass300 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon icon={Baby} size={20} color={colors.brass600} />
        <Text variant="headline" weight="semibold" style={{ flex: 1 }}>
          {t("trip.home.kidsTitle")}
        </Text>
      </View>
      <Text variant="small" color={colors.ink500}>
        {t("trip.home.kidsText")}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t("trip.home.kidsCta")} onPress={() => router.push(`/t/${id}/invites` as Href)} style={{ flex: 1 }} />
        <Button
          tone="soft"
          label={t("common.close")}
          onPress={() => {
            AsyncStorage.setItem(key, "1").catch(() => undefined);
            setDismissed(true);
          }}
        />
      </View>
    </Card>
  );
}
