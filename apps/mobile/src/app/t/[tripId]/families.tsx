import { colors, familyColors, radius } from "@together/shared/tokens";
import { Stack } from "expo-router";
import { Users } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";
import { useFamilies, useTrip } from "@/lib/trip";

/** Roster members written by the creator carry `kid: true`. */
const isKid = (member: object) => Boolean((member as { kid?: boolean }).kid);

/** The group: every family/unit with its travelers; "that's me" on your seat. */
export default function Families() {
  const t = useT();
  const { locale } = useLocale();
  const { config, me } = useTrip();
  const families = useFamilies();

  const everyone = (families ?? []).flatMap((family) => family.members.map((member) => ({ ...member, color: familyColors[family.color] ?? colors.route500 })));
  const kids = everyone.filter(isKid).length;

  return (
    <>
      <Stack.Screen options={{ title: config.group.pageTitle }} />
      <Screen edges={[]}>
        {families === undefined ? (
          <ActivityIndicator color={colors.ink500} style={{ marginTop: 32 }} />
        ) : families.length === 0 ? (
          <Card style={styles.empty}>
            <Icon icon={Users} size={26} color={colors.ink400} />
            <Text variant="headline" weight="medium" align="center">
              {t("settings.families.emptyTitle")}
            </Text>
            <Text variant="small" color={colors.ink500} align="center">
              {t("settings.families.emptyText")}
            </Text>
          </Card>
        ) : (
          <>
            {/* The whole group at a glance */}
            <View style={styles.summary}>
              <View style={{ flexDirection: "row" }}>
                {everyone.slice(0, 6).map((member, index) => (
                  <View key={`${member.id}-${index}`} style={[styles.face, { backgroundColor: member.color }, index > 0 && { marginStart: -8 }]}>
                    <Text variant="small" weight="medium" color={colors.chart50}>
                      {member.name.slice(0, 1)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Text weight="medium">
                  {t("settings.families.travelers", { count: everyone.length })}
                  {kids > 0 ? ` · ${t("settings.families.kids", { count: kids })}` : ""}
                </Text>
                <Text variant="small" color={colors.ink500}>
                  {families.length} {config.group.unitLabel.toLocaleLowerCase(locale)}
                  {config.group.summarySuffix}
                </Text>
              </View>
            </View>

            {families.map((family) => {
              const tone = familyColors[family.color] ?? colors.route500;
              const familyKids = family.members.filter(isKid).length;
              const mine = me.familyId === family.id;
              return (
                <Card key={family.id} style={{ padding: 16, gap: 12 }}>
                  <View style={styles.head}>
                    <View style={[styles.dot, { backgroundColor: tone }]} />
                    <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
                      {family.name}
                    </Text>
                    {mine && (
                      <View style={styles.badge}>
                        <Text variant="caption" weight="medium" color={colors.route700}>
                          {t("settings.families.yours")}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text variant="caption" color={colors.ink500}>
                    {t("settings.families.travelers", { count: family.members.length })}
                    {familyKids > 0 ? ` · ${t("settings.families.kids", { count: familyKids })}` : ""}
                  </Text>
                  <View style={styles.people}>
                    {family.members.map((member) => {
                      const isMe = mine && me.memberKey === member.id;
                      return (
                        <View key={member.id} style={[styles.person, isMe && styles.personMe]}>
                          <View style={[styles.avatar, { backgroundColor: tone }]}>
                            <Text variant="small" weight="medium" color={colors.chart50}>
                              {member.name.slice(0, 1)}
                            </Text>
                          </View>
                          <Text variant="small">{member.name}</Text>
                          {isKid(member) && (
                            <Text variant="caption" color={colors.ink500}>
                              {t("settings.families.kid")}
                            </Text>
                          )}
                          {isMe && (
                            <Text variant="caption" weight="medium" color={colors.route700}>
                              {t("settings.families.you")}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </Card>
              );
            })}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 24, gap: 10, alignItems: "center" },
  summary: { flexDirection: "row", alignItems: "center", gap: 14 },
  face: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.chart50, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  badge: { backgroundColor: colors.route100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  people: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  person: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderRadius: radius.chip, backgroundColor: colors.chart50, paddingStart: 4, paddingEnd: 14 },
  personMe: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.route300 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
