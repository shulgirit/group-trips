import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { colors } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { ConfirmSheet } from "@/components/more/ConfirmSheet";
import { styles as rowStyles } from "@/components/more/Row";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { type TKey, useT } from "@/lib/i18n";
import { useMembers, useTrip } from "@/lib/trip";

const ROLE_LABEL: Record<string, TKey | null> = {
  owner: "product.admin.roles.owner",
  admin: "product.admin.roles.admin",
  member: null,
  kid: "product.admin.roles.kid",
};

type Role = "admin" | "member" | "kid";

/** Who's on the trip. Organizers change roles and remove people. */
export default function Members() {
  const t = useT();
  const { id, isAdmin } = useTrip();
  const members = useMembers();
  const setRole = useMutation(api.memberships.setRole);
  const removeMember = useMutation(api.memberships.remove);
  const [target, setTarget] = useState<{ id: Id<"memberships">; name: string } | null>(null);
  const [error, setError] = useState("");

  function changeRole(membershipId: Id<"memberships">, current: string) {
    const roles: Role[] = ["admin", "member", "kid"];
    // "product.admin.roles.member" is missing from packages/i18n (reported); add it there
    const labels = roles.map((role) => t(ROLE_LABEL[role] ?? "product.admin.roles.member"));
    const apply = (index: number) => {
      const role = roles[index];
      if (!role || role === current) return;
      setRole({ tripId: id, membershipId, role }).catch(() => setError(t("common.errors.saveFailed")));
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...labels, t("common.cancel")], cancelButtonIndex: labels.length }, apply);
    } else {
      Alert.alert("", "", [...labels.map((label, index) => ({ text: label, onPress: () => apply(index) })), { text: t("common.cancel"), style: "cancel" as const }]);
    }
  }

  const removeName = target ? target.name || t("product.admin.theParticipant") : "";

  return (
    <>
      <Stack.Screen options={{ title: t("product.admin.members", { count: members?.length ?? 0 }) }} />
      <Screen edges={[]}>
        {members === undefined ? (
          <ActivityIndicator color={colors.ink500} style={{ marginTop: 32 }} />
        ) : (
          <View style={rowStyles.surface}>
            {members.map((member, index) => {
              const roleLabel = ROLE_LABEL[member.role];
              const editable = isAdmin && member.role !== "owner" && !member.isMe;
              return (
                <View key={member.id} style={[styles.row, index < members.length - 1 && rowStyles.divider]}>
                  <View style={styles.avatar}>
                    {member.image ? (
                      <Image source={member.image} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Text variant="small" weight="medium" color={colors.ink700}>
                        {(member.displayName || "?").slice(0, 1)}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    accessibilityRole={editable ? "button" : undefined}
                    disabled={!editable}
                    onPress={() => changeRole(member.id, member.role)}
                    style={{ flex: 1, gap: 2 }}
                  >
                    <Text weight="medium" numberOfLines={1}>
                      {member.displayName || t("product.admin.noName")}
                    </Text>
                    {(roleLabel || member.guest) && (
                      <Text variant="caption" color={colors.ink500}>
                        {[roleLabel ? t(roleLabel) : null, member.guest ? t("product.admin.guest") : null].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                  </Pressable>
                  {editable && (
                    <Pressable accessibilityRole="button" onPress={() => setTarget({ id: member.id, name: member.displayName })} style={styles.remove} hitSlop={6}>
                      <Text variant="small" weight="medium" color={colors.terra600}>
                        {t("product.admin.remove")}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {error && !target ? (
          <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
            {error}
          </Text>
        ) : null}
      </Screen>
      <ConfirmSheet
        open={!!target}
        title={t("product.admin.removeConfirm", { name: removeName })}
        description={t("product.admin.removeText", { name: removeName })}
        confirmLabel={t("product.admin.remove")}
        error={target ? error : ""}
        onConfirm={async () => {
          if (!target) return;
          setError("");
          try {
            await removeMember({ tripId: id, membershipId: target.id });
            setTarget(null);
          } catch {
            setError(t("product.admin.removeFailed"));
          }
        }}
        onClose={() => {
          setTarget(null);
          setError("");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: "hidden", backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  remove: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
});
