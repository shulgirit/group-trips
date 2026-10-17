import { colors, radius } from "@together/shared/tokens";
import { type Href, router } from "expo-router";
import { ChevronRight, LayoutGrid, Settings, Ticket, UserPlus, UserRound, Users, UsersRound, Vote, Wallet } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { LanguagePicker } from "@/components/more/LanguagePicker";
import { Group, Row } from "@/components/more/Row";
import { GuideAvatar } from "@/components/trips/GuideAvatar";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { useMembers, useTrip } from "@/lib/trip";

/** More: the trip's other tools, then account and app. */
export default function More() {
  const t = useT();
  const { id, doc, config, isAdmin, avatarUrl } = useTrip();
  const members = useMembers();
  const go = (path: string) => router.push(`/t/${id}${path}` as Href);
  const avatar = doc.ai.avatar?.kind === "bot" ? `bot:${doc.ai.avatar.id}` : avatarUrl;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text variant="small" color={colors.ink500} numberOfLines={1}>
          {config.name}
        </Text>
        <Text variant="display">{t("settings.more.title")}</Text>
      </View>

      {/* The guide: the one brass moment on this page */}
      <Pressable accessibilityRole="button" onPress={() => go("/guide")} style={({ pressed }) => [styles.guide, pressed && { opacity: 0.9 }]}>
        <GuideAvatar avatar={avatar} emoji={config.ai.moreEmoji} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="headline" weight="medium" numberOfLines={1}>
            {config.ai.moreLabel}
          </Text>
          <Text variant="small" color={colors.ink500}>
            {t("settings.more.aiDescription")}
          </Text>
        </View>
        <Icon icon={ChevronRight} size={18} color={colors.brass600} flip />
      </Pressable>

      <Group title={t("settings.more.groupTrip")}>
        <Row icon={Vote} label={t("settings.more.polls")} description={t("settings.more.pollsDescription")} onPress={() => go("/polls")} />
        <Row icon={Wallet} label={t("settings.more.expenses")} description={t("settings.more.expensesDescription")} onPress={() => go("/expenses")} />
        <Row icon={Users} label={config.group.moreLabel} description={config.group.moreDescription} onPress={() => go("/families")} />
        <Row
          icon={Ticket}
          label={t("settings.more.documents")}
          description={t("settings.more.documentsDescription")}
          onPress={() => go("/documents")}
          last={!isAdmin}
        />
        {isAdmin && <Row icon={UserPlus} label={t("product.admin.inviteTitle")} description={t("settings.invite.lead")} onPress={() => go("/invites")} />}
        {isAdmin && (
          <Row
            icon={UsersRound}
            label={t("product.admin.members", { count: members?.length ?? 0 })}
            onPress={() => go("/members")}
            last
          />
        )}
      </Group>

      <Group title={t("settings.more.groupApp")}>
        <Row icon={Settings} label={t("settings.title")} description={t("settings.more.settingsDescription")} onPress={() => go("/settings")} />
        <Row icon={LayoutGrid} label={t("settings.more.myTrips")} description={t("settings.more.myTripsDescription")} onPress={() => router.replace("/trips")} />
        <Row icon={UserRound} label={t("product.account.title")} onPress={() => router.push("/account")} last />
      </Group>

      <LanguagePicker />
    </Screen>
  );
}

const styles = StyleSheet.create({
  guide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.brass300,
  },
});
