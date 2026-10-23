import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@together/backend/api";
import {
  basicsValid,
  type CreatorState,
  DRAFT_KEY,
  groupValid,
  initialState,
  peopleCounts,
  primaryPlace,
  shortId,
  toTripInput,
  tripEnd,
  tripStart,
} from "@together/backend/creator";
import type { Id } from "@together/backend/dataModel";
import { toTripDoc } from "@together/backend/shapes";
import { formatShortDate } from "@together/i18n/format";
import { stopsOf } from "@together/shared/trip-doc";
import { colors, radius } from "@together/shared/tokens";
import { type ConvexReactClient, useConvex, useConvexAuth, useQuery } from "convex/react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { ArrowRight, BedDouble, CalendarDays, CarFront, Check, ChevronLeft, Plane, Share2, Ticket, Users, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingImporter } from "@/components/creator/BookingImporter";
import { StepAi } from "@/components/creator/StepAi";
import { StepHeader } from "@/components/creator/StepHeader";
import { StepWhere } from "@/components/creator/StepWhere";
import { StepWho } from "@/components/creator/StepWho";
import { inviteMessage, inviteUrl } from "@/components/more/links";
import { GuideAvatar } from "@/components/trips/GuideAvatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { errorReason } from "@/lib/convert";
import { useSafeQuery } from "@/lib/safe-query";
import { glyphIcon } from "@/lib/glyphs";
import { type TKey, useLocale, useT } from "@/lib/i18n";

const STEPS = [
  { key: "where", label: "creator.steps.where" },
  { key: "who", label: "creator.steps.who" },
  { key: "bookings", label: "creator.steps.bookings" },
  { key: "ai", label: "creator.steps.ai" },
  { key: "launch", label: "creator.steps.launch" },
] as const satisfies readonly { key: string; label: TKey }[];

async function readDraft(): Promise<CreatorState | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CreatorState) : null;
  } catch {
    return null;
  }
}

function writeDraft(state: CreatorState | null) {
  (state ? AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(state)) : AsyncStorage.removeItem(DRAFT_KEY)).catch(() => undefined);
}

/** Loads an existing trip (draft resume / organizer edit) into wizard state. */
async function loadTrip(convex: ConvexReactClient, ref: string): Promise<CreatorState | null> {
  const tripId = await convex.query(api.trips.resolve, { ref });
  if (!tripId) return null;
  const [{ trip, me: seat, avatarUrl }, familyRows] = await Promise.all([convex.query(api.trips.get, { tripId }), convex.query(api.families.list, { tripId })]);
  const data = toTripDoc(trip, avatarUrl);
  const familyKey = familyRows.find((f) => f._id === seat.familyId)?.key;
  return {
    tripId,
    status: data.status,
    name: data.name,
    emoji: data.emoji,
    stops: stopsOf(data).map((stop) => ({
      id: /^[a-z0-9-]{2,40}$/.test(stop.id) ? stop.id : shortId("s"),
      place: {
        label: stop.label,
        placeId: stop.placeId ?? "",
        lat: stop.lat,
        lng: stop.lng,
        region: stop.region,
        country: stop.country ?? "",
        timezone: stop.timezone,
        currency: stop.currency,
        coverImage: stop.coverImage,
      },
      startDate: stop.startDate,
      endDate: stop.endDate,
    })),
    departureTime: data.departureAt?.slice(11, 16) ?? "",
    currencies: trip.currencies ?? [],
    groupKind: data.groupKind,
    groupName: data.groupName,
    families: familyRows.map((f) => ({
      id: f.key,
      name: f.name,
      members: f.members.map((m) => ({ id: m.key, name: m.name, kid: Boolean(m.kid), age: m.age ?? null })),
    })),
    me: familyKey && seat.memberKey ? { familyId: familyKey, memberId: seat.memberKey } : null,
    ai: {
      name: data.ai.name,
      emoji: data.ai.emoji,
      avatar: data.ai.avatar ?? null,
      avatarStorageId: trip.ai.avatar?.kind === "file" ? trip.ai.avatar.storageId : null,
      preset: data.ai.preset,
      rules: data.ai.rules ?? [],
      customRules: data.ai.customRules ?? "",
    },
    aboutUs: data.aboutUs ?? "",
    homeBase: data.homeBase,
  };
}


/**
 * The trip creator: where → who → bookings → guide → launch. A new trip
 * saves as a draft from step 2 (bookings attach to it); ?trip=<id> resumes a
 * draft or edits a live trip.
 */
export default function NewTrip() {
  const t = useT();
  const { locale, rtl } = useLocale();
  const convex = useConvex();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useSafeQuery(api.account.me, isAuthenticated ? {} : "skip");
  const myTrips = useSafeQuery(api.trips.mine, isAuthenticated ? {} : "skip");
  const params = useLocalSearchParams<{ trip?: string }>();
  const [state, setState] = useState<CreatorState | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [launched, setLaunched] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  // Initial state: an existing trip (?trip=), the saved draft, or fresh
  useEffect(() => {
    if (!me || me.guest) return;
    const key = params.trip ?? "new";
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    if (params.trip) {
      loadTrip(convex, params.trip)
        .then((loaded) => {
          if (!loaded) return setError(t("creator.errors.notFound"));
          setState(loaded);
          // Drafts resume where details are still missing
          setStep(loaded.status === "draft" ? 2 : 0);
        })
        .catch(() => setError(t("creator.errors.noPermission")));
    } else {
      readDraft().then((draft) => setState(draft && !draft.tripId ? draft : initialState(me.name ?? null)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, params.trip]);

  const update = useCallback((patch: Partial<CreatorState>) => {
    setState((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (!next.tripId) writeDraft(next);
      return next;
    });
  }, []);

  async function save(status: "draft" | "active"): Promise<string | null> {
    if (!state) return null;
    setSaving(true);
    setError("");
    try {
      const input = toTripInput(state, status);
      let tripId: string;
      if (state.tripId) {
        await convex.mutation(api.trips.update, { tripId: state.tripId as Id<"trips">, input });
        tripId = state.tripId;
      } else {
        tripId = await convex.mutation(api.trips.create, { input });
        writeDraft(null);
        loadedFor.current = tripId;
        setState((current) => (current ? { ...current, tripId } : current));
      }
      if (status === "active") setState((current) => (current ? { ...current, status: "active" } : current));
      return tripId;
    } catch (err) {
      const reason = errorReason(err);
      setError(reason === "trip_limit" ? t("creator.errors.tripLimit") : reason ? t("creator.errors.saveFailed") : t("creator.errors.network"));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (!state) return;
    const problem = step === 0 ? basicsValid(state) : step === 1 ? groupValid(state) : null;
    if (problem) return setError(problem);
    setError("");
    // From step 2 on there is a server trip (draft) to attach bookings to
    if (step >= 1 || state.tripId) {
      if (!(await save(state.status === "active" ? "active" : "draft"))) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  async function launch() {
    if (!state) return;
    const tripId = await save("active");
    if (!tripId) return;
    setLaunched(true);
    scroll.current?.scrollTo({ y: 0, animated: true });
    convex
      .action(api.assist.summary, { tripId: tripId as Id<"trips">, locale })
      .then(setSummary)
      .catch(() => setSummary(""));
  }

  if (!isLoading && !isAuthenticated) return <Redirect href="/welcome" />;
  if (me?.guest) return <Redirect href="/trips" />;
  if (!state) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        {error ? (
          <View style={{ gap: 12, padding: 24 }}>
            <Text weight="medium" align="center">
              {error}
            </Text>
            <Button tone="soft" label={t("product.gate.myTrips")} onPress={() => router.replace("/trips")} />
          </View>
        ) : (
          <ActivityIndicator color={colors.ink500} />
        )}
      </SafeAreaView>
    );
  }

  const isEdit = state.status === "active" && !launched;
  const stepKey = STEPS[step].key;
  const cover = primaryPlace(state)?.coverImage ?? null;
  const stopLabels = state.stops.map((s) => s.place?.label ?? "").filter(Boolean);
  const dates = `${tripStart(state) ? formatShortDate(tripStart(state)) : ""}–${tripEnd(state) ? formatShortDate(tripEnd(state)) : ""}`;
  const { people } = peopleCounts(state);

  if (launched && state.tripId) {
    return <Launched state={state} cover={cover} dates={dates} stopLabels={stopLabels} summary={summary} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Progress: the steps as a route */}
        <View style={styles.top}>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/trips"))} hitSlop={10}>
              <Text variant="small" weight="medium" color={colors.route700}>
                {t("common.close")}
              </Text>
            </Pressable>
            <Text variant="small" color={colors.ink500}>
              {t("creator.wizard.progress", { n: step + 1, total: STEPS.length })}
            </Text>
          </View>
          <View style={styles.steps} accessibilityLabel={t("creator.steps.label")}>
            {STEPS.map((s, index) => {
              const done = index < step;
              const current = index === step;
              const reachable = index <= step || Boolean(state.tripId);
              return (
                <Pressable
                  key={s.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current, disabled: !reachable }}
                  disabled={!reachable}
                  onPress={() => setStep(index)}
                  style={styles.step}
                >
                  {index > 0 && <View style={[styles.stepLine, { backgroundColor: index <= step ? colors.route500 : colors.chart200 }]} />}
                  <View style={[styles.stepDot, current ? styles.stepCurrent : done ? styles.stepDone : styles.stepTodo]}>
                    {done && <Icon icon={Check} size={9} color={colors.chart50} />}
                  </View>
                  <Text variant="caption" weight={current ? "medium" : "regular"} color={current ? colors.ink900 : done ? colors.ink700 : colors.ink400} numberOfLines={1}>
                    {t(s.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView ref={scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {stepKey === "where" && <StepWhere state={state} update={update} />}
          {stepKey === "who" && (
            <StepWho state={state} update={update} previousTrips={(myTrips ?? []).filter((trip) => trip.id !== state.tripId && trip.status !== "draft")} />
          )}
          {stepKey === "bookings" && state.tripId && (
            <View style={{ gap: 20 }}>
              <StepHeader title={t("creator.bookings.title")} text={t("creator.bookings.text")} />
              <ChipRow>
                {(
                  [
                    [Plane, "creator.booking.kinds.flight"],
                    [BedDouble, "creator.booking.kinds.lodging"],
                    [CarFront, "creator.booking.kinds.car"],
                    [Ticket, "creator.booking.kinds.activity"],
                  ] as const
                ).map(([, key]) => (
                  <Chip key={key} label={t(key)} />
                ))}
              </ChipRow>
              <BookingImporter
                tripId={state.tripId}
                onApplied={(result) => {
                  // Reflect the new home base so later saves don't clear it
                  if (result.homeBase)
                    convex
                      .query(api.trips.get, { tripId: state.tripId as Id<"trips"> })
                      .then(({ trip }) => update({ homeBase: trip.homeBase }))
                      .catch(() => undefined);
                }}
              />
            </View>
          )}
          {stepKey === "ai" && <StepAi state={state} update={update} />}
          {stepKey === "launch" && (
            <View style={{ gap: 20 }}>
              <StepHeader title={isEdit ? t("creator.launch.editTitle") : t("creator.launch.title")} text={isEdit ? t("creator.launch.editText") : t("creator.launch.text")} />
              <Card style={{ overflow: "hidden" }}>
                <View style={styles.preview}>
                  {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  <LinearGradient colors={["transparent", "rgba(7,12,22,0.85)"]} style={StyleSheet.absoluteFill} />
                  <View style={{ padding: 18, gap: 4 }}>
                    <Text variant="small" color="rgba(241,243,239,0.8)" style={{ writingDirection: "ltr" }}>
                      {dates}
                    </Text>
                    <View style={styles.inline}>
                      <Icon icon={glyphIcon(state.emoji)} size={20} color="rgba(241,243,239,0.75)" />
                      <Text variant="title" color={colors.chart50} numberOfLines={1} style={{ flex: 1 }}>
                        {state.name}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ padding: 18, gap: 10 }}>
                  {stopLabels.map((label, index) => (
                    <View key={`${label}-${index}`} style={styles.inline}>
                      <View style={[styles.stopDot, index === stopLabels.length - 1 && stopLabels.length > 1 ? styles.stopLast : null]} />
                      <Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                        {label}
                      </Text>
                      {stopLabels.length > 1 && state.stops[index]?.startDate ? (
                        <Text variant="caption" color={colors.ink500}>
                          {formatShortDate(state.stops[index].startDate)}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
                {(
                  [
                    [
                      Users,
                      t("creator.launch.people"),
                      t("creator.launch.peopleValue", {
                        people,
                        count: state.families.length,
                        units: state.groupKind === "families" ? t("creator.launch.families") : t("creator.launch.groups"),
                      }),
                    ],
                    [glyphIcon(state.ai.emoji), t("creator.launch.ai"), state.ai.name],
                    [BedDouble, t("creator.launch.lodging"), state.homeBase?.name ?? t("creator.launch.lodgingNone")],
                    [CalendarDays, t("creator.launch.dates"), `${tripStart(state)} – ${tripEnd(state)}`],
                  ] as [LucideIcon, string, string][]
                ).map(([RowIcon, label, value]) => (
                  <View key={label} style={styles.fact}>
                    <Icon icon={RowIcon} size={16} color={colors.ink500} />
                    <Text variant="small" color={colors.ink500}>
                      {label}
                    </Text>
                    <Text variant="small" weight="medium" numberOfLines={1} style={{ flex: 1, textAlign: rtl ? "left" : "right" }}>
                      {value}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          )}
          {error ? (
            <View accessibilityRole="alert" style={styles.error}>
              <Text variant="small" weight="medium" color={colors.terra600} align="center">
                {error}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <Pressable accessibilityRole="button" accessibilityLabel={t("creator.nav.previous")} onPress={() => setStep((s) => s - 1)} style={styles.back}>
              <Icon icon={ChevronLeft} size={20} flip />
            </Pressable>
          )}
          {stepKey === "launch" ? (
            <Button
              tone="brass"
              size="lg"
              style={{ flex: 1 }}
              busy={saving}
              label={isEdit ? t("creator.launch.saveChanges") : t("creator.launch.create")}
              onPress={isEdit ? () => save("active").then((id) => id && router.replace(`/t/${id}` as Href)) : launch}
            />
          ) : (
            <Button
              size="lg"
              style={{ flex: 1 }}
              busy={saving}
              icon={undefined}
              label={stepKey === "bookings" ? t("common.continue") : t("common.next")}
              onPress={next}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The routes meet: the trip exists. Guide's summary, invite links, enter. */
function Launched({ state, cover, dates, stopLabels, summary }: { state: CreatorState; cover: string | null; dates: string; stopLabels: string[]; summary: string | null }) {
  const t = useT();
  const { locale, rtl } = useLocale();
  const tripId = state.tripId as Id<"trips">;
  const invites = useQuery(api.invites.list, { tripId });
  const families = useQuery(api.families.list, { tripId });
  const invitees = state.families.flatMap((f) => f.members.filter((m) => !m.kid && m.id !== state.me?.memberId).map((m) => m.name));
  const myFamilyKey = state.me?.familyId;

  const links = (invites ?? [])
    .filter((invite) => invite.role !== "kid")
    .map((invite) => {
      const family = families?.find((f) => f._id === invite.familyId);
      return { code: invite.code, familyName: family?.name ?? null, mine: Boolean(family && family.key === myFamilyKey && family.members.length <= 1) };
    })
    .filter((link) => !link.mine);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={styles.launchHero}>
          {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <LinearGradient colors={["rgba(7,12,22,0.2)", "rgba(7,12,22,0.9)"]} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["top"]} style={{ padding: 24, gap: 8 }}>
            <View style={styles.meet}>
              <View style={styles.meetLine} />
              <View style={styles.meetDot} />
              <View style={styles.meetLine} />
            </View>
            <Text variant="display" color={colors.chart50}>
              {t("creator.launched.title", { name: state.name })}
            </Text>
            <Text variant="body" color="rgba(241,243,239,0.8)">
              {stopLabels.join(rtl ? " ← " : " → ")} · {dates}
            </Text>
          </SafeAreaView>
        </View>
        <View style={{ padding: 20, gap: 24 }}>
          {summary !== "" && (
            <Card style={{ flexDirection: "row", gap: 14, padding: 18 }}>
              <GuideAvatar avatar={state.ai.avatar} emoji={state.ai.emoji} size={40} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="small" weight="medium">
                  {state.ai.name}
                </Text>
                {summary ? <Text color={colors.ink700}>{summary}</Text> : <ActivityIndicator color={colors.ink400} style={{ alignSelf: "flex-start" }} />}
              </View>
            </Card>
          )}
          <View style={{ gap: 12 }}>
            <Text variant="title">{t("creator.wizard.inviteTitle")}</Text>
            <Text color={colors.ink500}>{invitees.length === 1 ? t("creator.launched.textOne", { name: invitees[0] }) : t("creator.launched.text")}</Text>
            {invites === undefined ? (
              <ActivityIndicator color={colors.ink400} />
            ) : (
              links.map((link) => (
                <Card key={link.code} style={styles.inviteRow}>
                  <View style={{ flex: 1 }}>
                    <Text weight="medium">{link.familyName ?? t("product.invite.general")}</Text>
                    <Text variant="caption" color={colors.ink500} numberOfLines={1} style={{ writingDirection: "ltr" }}>
                      {inviteUrl(link.code)}
                    </Text>
                  </View>
                  <Button
                    tone="soft"
                    icon={Share2}
                    label={t("product.invite.send")}
                    onPress={() => {
                      const url = inviteUrl(link.code);
                      Share.share({ message: inviteMessage(locale, { tripName: state.name, familyName: link.familyName, url }) }).catch(() => undefined);
                    }}
                  />
                </Card>
              ))
            )}
          </View>
          <Button size="lg" icon={ArrowRight} label={t("creator.launched.enter")} onPress={() => router.replace(`/t/${tripId}` as Href)} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chart50 },
  center: { alignItems: "center", justifyContent: "center" },
  top: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  steps: { flexDirection: "row" },
  step: { flex: 1, alignItems: "center", gap: 6, paddingTop: 6, minHeight: 44 },
  stepLine: { position: "absolute", top: 12, end: "50%", width: "100%", height: StyleSheet.hairlineWidth * 2 },
  stepDot: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  stepCurrent: { backgroundColor: colors.brass500, borderWidth: 3, borderColor: colors.brass100, width: 18, height: 18, borderRadius: 9, marginTop: -2 },
  stepDone: { backgroundColor: colors.route500 },
  stepTodo: { borderWidth: 2, borderColor: colors.chart200, backgroundColor: colors.chart50 },
  body: { padding: 20, paddingBottom: 40, gap: 24 },
  inline: { flexDirection: "row", alignItems: "center", gap: 10 },
  preview: { height: 170, justifyContent: "flex-end", backgroundColor: colors.night900 },
  stopDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.route500 },
  stopLast: { backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.route500 },
  fact: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart200 },
  error: { backgroundColor: colors.terra100, borderRadius: radius.card, padding: 14 },
  footer: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart200, backgroundColor: colors.chart50 },
  back: { width: 56, height: 56, borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  launchHero: { height: 320, justifyContent: "flex-end", backgroundColor: colors.night950 },
  meet: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  meetLine: { width: 40, height: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(241,243,239,0.5)" },
  meetDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brass500 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
});
