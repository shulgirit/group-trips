import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { formatShortDate } from "@together/i18n/format";
import { colors, radius } from "@together/shared/tokens";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ban, Check, Hourglass, Link2Off, Lock, UsersRound, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SignIn } from "@/components/auth/SignIn";
import { GuideAvatar } from "@/components/trips/GuideAvatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { signInAsGuest } from "@/lib/auth";
import { type TKey, useT } from "@/lib/i18n";

const MUTED = "rgba(241,243,239,0.72)";

const ERRORS: Record<string, { icon: LucideIcon; title: TKey; text: TKey }> = {
  not_found: { icon: Link2Off, title: "product.join.errorTitles.notFound", text: "product.join.errors.notFound" },
  expired: { icon: Hourglass, title: "product.join.errorTitles.expired", text: "product.join.errors.expired" },
  used_up: { icon: UsersRound, title: "product.join.errorTitles.usedUp", text: "product.join.errors.usedUp" },
  revoked: { icon: Ban, title: "product.join.errorTitles.revoked", text: "product.join.errors.revoked" },
  trip_closed: { icon: Lock, title: "product.join.errorTitles.tripClosed", text: "product.join.errors.tripClosed" },
};

/**
 * An invite link (together.app/j/<code> or together://j/<code>): the trip as
 * an invitation, sign-in or guest, then "which one are you?".
 */
export default function Join() {
  const t = useT();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = String(raw ?? "").toLowerCase();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const result = useQuery(api.invites.preview, { code });
  const me = useQuery(api.account.me, isAuthenticated ? {} : "skip");
  const redeem = useMutation(api.invites.redeem);

  const [pickedFamily, setPickedFamily] = useState<string | null>(null);
  const [asGuest, setAsGuest] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // A freshly created guest identity takes a moment to reach Convex
  const authed = useRef(isAuthenticated);
  useEffect(() => {
    authed.current = isAuthenticated;
  }, [isAuthenticated]);
  async function waitForAuth() {
    for (let i = 0; i < 50 && !authed.current; i++) await new Promise((r) => setTimeout(r, 200));
  }

  if (result === undefined || isLoading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={MUTED} />
      </SafeAreaView>
    );
  }

  if (!result.ok) {
    const info = ERRORS[result.error] ?? ERRORS.not_found;
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.errorBody}>
          <View style={styles.errorIcon}>
            <Icon icon={info.icon} size={22} color={MUTED} />
          </View>
          <Text variant="display" color={colors.chart50}>
            {t(info.title)}
          </Text>
          <Text variant="body" color={MUTED}>
            {t(info.text)}
          </Text>
          <Button tone="light" size="lg" label={t("product.gate.myTrips")} onPress={() => router.replace(isAuthenticated ? "/trips" : "/welcome")} />
        </View>
      </SafeAreaView>
    );
  }

  const { trip, role } = result;
  const isKidInvite = role === "kid";
  const preselected = result.families.length === 1 && result.familyName ? result.families[0].id : null;
  const familyId = pickedFamily ?? preselected;
  const families = familyId ? result.families.filter((f) => f.id === familyId) : result.families;
  const kidsOnly = isKidInvite && result.families.some((f) => f.members.some((m) => m.kid));
  const travelers = result.families.flatMap((f) => f.members);
  const activeFamily = result.families.find((f) => f.id === (familyId ?? families[0]?.id));
  const pickable = (families.length === 1 || familyId ? (activeFamily?.members ?? []) : []).filter((m) => (kidsOnly ? m.kid : true));
  const personal = isAuthenticated && me ? !me.guest : false;
  const canPick = isKidInvite || isAuthenticated || asGuest;

  async function join(memberFamilyId: string | null, memberKey: string | null) {
    if (joining) return;
    setJoining(true);
    setError("");
    try {
      if (!authed.current) {
        await signInAsGuest();
        await waitForAuth();
      }
      try {
        const tripId = await redeem({ code, familyId: memberFamilyId as Id<"families"> | null, memberKey });
        router.replace(`/t/${tripId}`);
      } catch (err) {
        const data = (err as { data?: { detail?: string; code?: string } }).data;
        const reason = data?.detail ?? data?.code ?? "";
        setError(
          t(
            reason === "trip_full"
              ? "product.join.errors.tripFull"
              : reason === "sign_in_required"
                ? "product.join.errors.signInRequired"
                : (ERRORS[reason]?.text ?? "product.join.errors.failed")
          )
        );
      }
    } catch {
      setError(t("product.join.errors.failedNetwork"));
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {/* The trip as an invitation */}
        <View style={styles.hero}>
          {trip.coverImage ? <Image source={trip.coverImage} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <LinearGradient colors={["rgba(7,12,22,0.2)", colors.night950]} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["top"]} style={styles.heroText}>
            <Text variant="small" weight="medium" color={colors.brass300}>
              {t("product.join.invited")}
            </Text>
            <Text variant="display" color={colors.chart50}>
              {trip.name}
            </Text>
            <Text variant="body" color="rgba(241,243,239,0.85)">
              {trip.destination} · {formatShortDate(trip.startDate)}–{formatShortDate(trip.endDate)}
            </Text>
            {trip.organizer ? (
              <Text variant="small" color={MUTED}>
                {t("product.join.organizers", { name: trip.organizer })}
              </Text>
            ) : null}
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          {/* The guide and the group */}
          <View style={styles.guide}>
            <View style={styles.row}>
              <GuideAvatar avatar={trip.ai.avatar} emoji={trip.ai.emoji} size={52} />
              <View style={{ flex: 1 }}>
                <Text variant="headline" weight="medium" color={colors.chart50} numberOfLines={1}>
                  {trip.ai.name}
                </Text>
                <Text variant="small" color={MUTED}>
                  {t("product.join.guideRole")}
                </Text>
              </View>
            </View>
            {travelers.length > 0 && (
              <Text variant="small" color={MUTED} style={styles.group}>
                {trip.groupName ? `${trip.groupName} · ` : ""}
                {t("product.join.travelers", { count: travelers.length })}
                {trip.memberCount > 1 ? ` · ${t("product.join.alreadyIn", { count: trip.memberCount })}` : ""}
              </Text>
            )}
          </View>

          {!canPick ? (
            <View style={{ gap: 20 }}>
              <View style={{ gap: 6 }}>
                <Text variant="small" color={MUTED}>
                  {t("product.join.stepOf", { n: 1, total: 2 })}
                </Text>
                <Text variant="title" color={colors.chart50}>
                  {t("product.join.signInTitle")}
                </Text>
                <Text variant="body" color={MUTED}>
                  {t("product.join.signInText")}
                </Text>
              </View>
              <SignIn />
              <View style={styles.divider}>
                <View style={styles.line} />
                <Text variant="caption" color={MUTED}>
                  {t("common.or")}
                </Text>
                <View style={styles.line} />
              </View>
              <Button tone="ghost" size="lg" label={t("product.join.guest")} onPress={() => setAsGuest(true)} />
              <Text variant="caption" color={MUTED} align="center">
                {t("product.join.guestNote")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <View style={{ gap: 6 }}>
                {!isKidInvite && (
                  <Text variant="small" color={MUTED}>
                    {t("product.join.stepOf", { n: 2, total: 2 })}
                  </Text>
                )}
                <Text variant="title" color={colors.chart50}>
                  {kidsOnly ? t("product.join.whoKids") : t("product.join.whoGroup")}
                </Text>
              </View>
              {families.length > 1 || (pickedFamily && result.families.length > 1) ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {result.families.map((family) => (
                    <Chip key={family.id} label={family.name} active={familyId === family.id} onPress={() => setPickedFamily(family.id)} />
                  ))}
                </ScrollView>
              ) : null}
              {families.length === 1 || familyId ? (
                <View style={styles.grid}>
                  {pickable.map((member) => (
                    <Pressable
                      key={member.key}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: joining || member.taken }}
                      disabled={joining}
                      onPress={() => join(familyId ?? families[0].id, member.key)}
                      style={({ pressed }) => [styles.person, member.taken && { opacity: 0.55 }, pressed && { transform: [{ scale: 0.98 }] }]}
                    >
                      <View style={styles.initial}>
                        <Text variant="small" weight="medium" color={colors.chart50}>
                          {member.name.slice(0, 1)}
                        </Text>
                      </View>
                      <Text weight="medium" color={colors.chart50} numberOfLines={1} style={{ flex: 1 }}>
                        {member.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text variant="small" color={MUTED} style={styles.dashed}>
                  {t("product.join.pickFamily")}
                </Text>
              )}
              {!kidsOnly && (
                <Pressable accessibilityRole="button" disabled={joining} onPress={() => join(familyId, null)} style={{ padding: 12, alignSelf: "center" }}>
                  <Text variant="small" weight="medium" color={colors.brass300} style={{ textDecorationLine: "underline" }}>
                    {joining ? t("product.join.joining") : t("product.join.notListed")}
                  </Text>
                </Pressable>
              )}
              {joining && <ActivityIndicator color={MUTED} />}
              {personal && me ? (
                <View style={[styles.row, { justifyContent: "center", gap: 6 }]}>
                  <Icon icon={Check} size={14} color={colors.route300} />
                  <Text variant="caption" color={MUTED}>
                    {t("product.join.signedInAs", { name: me.name || me.email || "" })}
                  </Text>
                </View>
              ) : !isKidInvite ? (
                <Text variant="caption" color={MUTED} align="center">
                  {t("product.join.guestHint")}
                </Text>
              ) : null}
            </View>
          )}

          {error ? (
            <View accessibilityRole="alert" style={styles.error}>
              <Text variant="small" weight="medium" color={colors.terra600} align="center">
                {error}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night950 },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { height: 340, justifyContent: "flex-end", backgroundColor: colors.night900 },
  heroText: { paddingHorizontal: 24, paddingBottom: 24, gap: 6 },
  body: { paddingHorizontal: 20, gap: 28 },
  guide: { backgroundColor: colors.night800, borderRadius: radius.card, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(241,243,239,0.15)", paddingTop: 12 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(241,243,239,0.2)" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  person: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(241,243,239,0.18)",
    backgroundColor: colors.night900,
  },
  initial: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.route500, alignItems: "center", justifyContent: "center" },
  dashed: { borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(241,243,239,0.25)", borderRadius: radius.card, padding: 16 },
  error: { backgroundColor: colors.terra100, borderRadius: radius.card, padding: 14 },
  errorBody: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14 },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(241,243,239,0.15)",
    backgroundColor: colors.night800,
    alignItems: "center",
    justifyContent: "center",
  },
});
