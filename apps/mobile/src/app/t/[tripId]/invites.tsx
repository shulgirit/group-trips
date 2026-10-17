import { api } from "@together/backend/api";
import { colors, radius } from "@together/shared/tokens";
import { useMutation, useQuery } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { type Href, Stack, router } from "expo-router";
import { Check, Copy, Link2, Pencil, Share2, Smartphone, Users, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from "react-native";
import { inviteMessage, inviteUrl } from "@/components/more/links";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";
import { useFamilies, useTrip } from "@/lib/trip";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={async () => {
        await Clipboard.setStringAsync(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      style={styles.round}
    >
      <Icon icon={copied ? Check : Copy} size={18} color={copied ? colors.route500 : colors.ink700} />
    </Pressable>
  );
}

function InviteRow({ icon, label, hint, url, message }: { icon: LucideIcon; label: string; hint: string; url: string; message: string }) {
  const t = useT();
  return (
    <View style={styles.invite}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon icon={icon} size={16} color={colors.ink500} />
          <Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Text>
        </View>
        <Text variant="caption" color={colors.ink500} numberOfLines={1} style={{ writingDirection: "ltr" }}>
          {hint}
        </Text>
      </View>
      <CopyButton value={url} label={t("product.invite.copyLink")} />
      <Pressable accessibilityRole="button" onPress={() => Share.share({ message })} style={styles.send}>
        <Icon icon={Share2} size={16} color={colors.chart50} />
        <Text variant="small" weight="medium" color={colors.chart50}>
          {t("product.invite.send")}
        </Text>
      </Pressable>
    </View>
  );
}

/** Organizers: the trip's invite links (general + per family) and kid-phone pairing. */
export default function Invites() {
  const t = useT();
  const { locale } = useLocale();
  const { id, config, isAdmin, isKid, me } = useTrip();
  const families = useFamilies();
  const invites = useQuery(api.invites.list, isAdmin ? { tripId: id } : "skip");
  const create = useMutation(api.invites.create);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [kidLink, setKidLink] = useState("");
  const [kidBusy, setKidBusy] = useState(false);

  async function createGeneral() {
    setCreating(true);
    setError("");
    try {
      await create({ tripId: id, role: "member" });
    } catch {
      setError(t("product.invite.loadFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function pairKid() {
    setKidBusy(true);
    setError("");
    try {
      setKidLink(inviteUrl(await create({ tripId: id, role: "kid" })));
    } catch {
      setError(t("product.admin.kidLinkFailed"));
    } finally {
      setKidBusy(false);
    }
  }

  const general = invites?.find((i) => !i.familyId && i.role === "member");
  const perFamily = (families ?? [])
    // Your own one-person family has nobody to invite
    .filter((family) => !(family.id === me.familyId && family.members.length <= 1))
    .map((family) => ({ family, invite: invites?.find((i) => i.familyId === family.id && i.role === "member") }))
    .filter((row): row is { family: (typeof row)["family"]; invite: NonNullable<(typeof row)["invite"]> } => Boolean(row.invite));

  return (
    <>
      <Stack.Screen options={{ title: t("product.admin.inviteTitle") }} />
      <Screen edges={[]}>
        {!isAdmin ? null : (
          <>
            <Text variant="body" color={colors.ink500}>
              {t("settings.invite.lead")}
            </Text>
            {invites === undefined ? (
              <ActivityIndicator color={colors.ink500} />
            ) : (
              <View style={{ gap: 8 }}>
                {general ? (
                  <InviteRow
                    icon={Link2}
                    label={t("product.invite.general")}
                    hint={inviteUrl(general.code).replace(/^https?:\/\//, "")}
                    url={inviteUrl(general.code)}
                    message={inviteMessage(locale, { tripName: config.name, url: inviteUrl(general.code) })}
                  />
                ) : (
                  <Button tone="outline" label={creating ? t("product.invite.creating") : t("product.invite.create")} onPress={createGeneral} busy={creating} />
                )}
                {perFamily.map(({ family, invite }) => (
                  <InviteRow
                    key={family.id}
                    icon={Users}
                    label={family.name}
                    hint={invite.uses > 0 ? t("product.invite.joinedCount", { count: invite.uses }) : t("product.invite.notJoined")}
                    url={inviteUrl(invite.code)}
                    message={inviteMessage(locale, { tripName: config.name, familyName: family.name, url: inviteUrl(invite.code) })}
                  />
                ))}
              </View>
            )}
            <Text variant="caption" color={colors.ink500}>
              {t("product.invite.footnote")}
            </Text>
            <Button tone="soft" icon={Pencil} label={t("product.admin.editTrip")} onPress={() => router.push(`/new?trip=${id}` as Href)} />
          </>
        )}

        {!isKid && (
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={styles.round}>
                <Icon icon={Smartphone} size={18} color={colors.ink700} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="medium">{t("product.admin.kidsTitle")}</Text>
                <Text variant="small" color={colors.ink500}>
                  {t("product.admin.kidsText")}
                </Text>
              </View>
            </View>
            {kidLink ? (
              <View style={{ gap: 8 }}>
                <Text variant="caption" color={colors.ink700} numberOfLines={1} style={styles.linkBox}>
                  {kidLink}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button tone="soft" icon={Copy} label={t("product.admin.copyLink")} onPress={() => Clipboard.setStringAsync(kidLink)} style={{ flex: 1 }} />
                  <Button icon={Share2} label={t("product.invite.send")} onPress={() => Share.share({ message: kidLink })} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <Button tone="outline" label={kidBusy ? t("product.admin.wait") : t("product.admin.createKidLink")} onPress={pairKid} busy={kidBusy} />
            )}
          </Card>
        )}

        {error ? (
          <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
            {error}
          </Text>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  invite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    paddingStart: 16,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    alignItems: "center",
    justifyContent: "center",
  },
  send: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: colors.route700 },
  linkBox: { backgroundColor: colors.chart100, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, writingDirection: "ltr" },
});
