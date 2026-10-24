import { api } from "@together/backend/api";
import { tripPhase } from "@together/shared/trip-doc";
import { todayIso } from "@together/shared/trip";
import { colors, radius } from "@together/shared/tokens";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router, useFocusEffect } from "expo-router";
import { ArrowRight, Plus, UserRound } from "lucide-react-native";
import { primaryPlace, type CreatorState } from "@together/backend/creator";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Logo } from "@/components/brand/Logo";
import { readDraft } from "@/lib/creator-draft";
import { TripCard } from "@/components/trips/TripCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useSafeQuery } from "@/lib/safe-query";
import { useT } from "@/lib/i18n";

/** My trips: the live/next trip large, then the rest; past trips at the end. */
export default function Trips() {
  const t = useT();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useSafeQuery(api.account.me, isAuthenticated ? {} : "skip");
  const trips = useSafeQuery(api.trips.mine, isAuthenticated ? {} : "skip");

  // A trip started on this phone that hasn't reached the server yet (steps 1-2 not completed)
  const [localDraft, setLocalDraft] = useState<CreatorState | null>(null);
  // Re-read every time this screen comes back into view (the wizard may have just kept a draft)
  useFocusEffect(
    useCallback(() => {
      readDraft().then((draft) => setLocalDraft(draft && !draft.tripId && primaryPlace(draft) ? draft : null));
    }, [])
  );

  if (!isLoading && !isAuthenticated) return <Redirect href="/welcome" />;

  const today = todayIso();
  const sorted = [...(trips ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const current = sorted
    .filter((trip) => trip.status === "draft" || tripPhase(trip, today) !== "past")
    // Unfinished trips first: they are waiting for the person to come back
    .sort((a, b) => Number(b.status === "draft") - Number(a.status === "draft"));
  const past = sorted.filter((trip) => trip.status !== "draft" && tripPhase(trip, today) === "past").reverse();
  const firstName = (me?.name ?? "").split(" ")[0];

  return (
    <Screen>
      <View style={styles.top}>
        <Logo />
        <Pressable accessibilityRole="button" accessibilityLabel={t("product.account.title")} onPress={() => router.push("/account")} style={styles.avatar} hitSlop={8}>
          <Icon icon={UserRound} size={20} />
        </Pressable>
      </View>

      <View style={{ gap: 6 }}>
        <Text variant="small" color={colors.ink500}>
          {t("product.trips.title")}
        </Text>
        <Text variant="display">{firstName ? t("product.trips.greeting", { name: firstName }) : t("product.trips.greetingAnon")}</Text>
        <Text variant="headline" color={colors.ink500}>
          {t("product.trips.subtitle")}
        </Text>
      </View>

      {me && !me.guest && !me.name && <NameCard />}

      {trips === undefined ? (
        <ActivityIndicator color={colors.ink500} style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <Card style={styles.first}>
          <Text variant="title" color={colors.chart50}>
            {t("product.trips.first.title")}
          </Text>
          <Text variant="body" color="rgba(241,243,239,0.75)">
            {t("product.trips.first.text")}
          </Text>
          {!me?.guest && <Button tone="brass" size="lg" icon={Plus} label={t("product.trips.first.cta")} onPress={() => router.push("/start")} />}
        </Card>
      ) : (
        <>
          {!me?.guest && (
            <Pressable accessibilityRole="button" onPress={() => router.push("/start")} style={({ pressed }) => [styles.newTrip, pressed && { opacity: 0.92 }]}>
              <Image source={require("../../../assets/onboarding/plan.webp")} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={["rgba(7,12,22,0.25)", "rgba(7,12,22,0.88)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <View style={styles.newTripText}>
                <Text variant="title" color={colors.chart50}>
                  {t("product.trips.newTrip.title")}
                </Text>
                <Text variant="small" color="rgba(241,243,239,0.85)" numberOfLines={2}>
                  {t("product.trips.newTrip.text")}
                </Text>
              </View>
              <View style={styles.plus}>
                <Icon icon={Plus} size={22} color={colors.night950} />
              </View>
            </Pressable>
          )}
          {localDraft && (
            <Pressable accessibilityRole="button" onPress={() => router.push("/new")} style={styles.localDraft}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="semibold" color={colors.brass600}>
                  {t("product.card.draftLocal")}
                </Text>
                <Text variant="small" color={colors.ink700} numberOfLines={1}>
                  {primaryPlace(localDraft)?.label}
                </Text>
              </View>
              <Icon icon={ArrowRight} size={18} color={colors.brass600} flip />
            </Pressable>
          )}
          {current.length > 0 && (
            <View style={{ gap: 12 }}>
              <Text variant="title">{t("product.trips.current")}</Text>
              {current.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} large={index === 0} />
              ))}
            </View>
          )}
          {past.length > 0 && (
            <View style={{ gap: 12 }}>
              <Text variant="title">{t("product.trips.past")}</Text>
              {past.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </View>
          )}
        </>
      )}
      {me?.guest && (
        <Text variant="small" color={colors.ink500}>
          {t("product.trips.guestNote")}
        </Text>
      )}
    </Screen>
  );
}

function NameCard() {
  const t = useT();
  const setName = useMutation(api.account.setName);
  const [name, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await setName({ name }).catch(() => setSaving(false));
  }
  return (
    <Card style={{ padding: 18, gap: 10, borderColor: colors.brass300 }}>
      <Text variant="headline" weight="semibold">
        {t("product.trips.nameTitle")}
      </Text>
      <Text variant="small" color={colors.ink500}>
        {t("product.trips.nameHint")}
      </Text>
      <Field value={name} onChangeText={setValue} placeholder={t("product.trips.namePlaceholder")} autoComplete="name" textContentType="name" onSubmitEditing={save} />
      <Button label={t("product.trips.nameSave")} onPress={save} busy={saving} disabled={!name.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.chart200 },
  first: { backgroundColor: colors.night950, borderColor: colors.night900, padding: 24, gap: 14 },
  newTrip: { minHeight: 112, borderRadius: 28, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 14, padding: 20, backgroundColor: colors.night950, shadowColor: colors.ink900, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  localDraft: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.brass100, borderWidth: 1, borderColor: colors.brass300 },
  newTripText: { flex: 1, gap: 4 },
  plus: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brass500, alignItems: "center", justifyContent: "center", shadowColor: colors.brass500, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
});
