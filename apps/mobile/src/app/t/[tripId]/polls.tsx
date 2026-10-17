import { colors } from "@together/shared/tokens";
import { type Href, router } from "expo-router";
import { Plus, Vote } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { PollCard } from "@/components/polls/PollCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { usePlaces, usePolls, useTrip } from "@/lib/trip";

/** Polls: the pinned ideas poll first, open before closed. */
export default function Polls() {
  const t = useT();
  const { id } = useTrip();
  const polls = usePolls();
  const places = usePlaces();
  const create = () => router.push(`/t/${id}/poll/new` as Href);
  const sorted = (polls ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(a.closed) - Number(b.closed));

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 48 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="small" color={colors.ink500}>
            {t("polls.kicker")}
          </Text>
          <Text variant="display">{t("polls.title")}</Text>
        </View>
        <Button icon={Plus} label={t("polls.newShort")} onPress={create} />
      </View>
      {polls === undefined ? (
        <ActivityIndicator color={colors.ink500} style={{ marginTop: 32 }} />
      ) : sorted.length === 0 ? (
        <Card style={{ padding: 24, gap: 10, alignItems: "center" }}>
          <Icon icon={Vote} size={28} color={colors.ink400} />
          <Text variant="headline" weight="medium" align="center">
            {t("polls.emptyTitle")}
          </Text>
          <Text variant="small" color={colors.ink500} align="center">
            {t("polls.emptyDescription")}
          </Text>
          <Button icon={Plus} label={t("polls.firstPoll")} onPress={create} />
        </Card>
      ) : (
        sorted.map((poll) => <PollCard key={poll.id} poll={poll} places={places ?? []} />)
      )}
    </Screen>
  );
}
