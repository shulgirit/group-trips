import { formatDayLabel, intlLocale } from "@together/i18n/format";
import { googleMapsUrl, wazeUrl } from "@together/shared/nav";
import { participantsLabel } from "@together/shared/participants";
import { todayIso, tripDayNumber, tripDays } from "@together/shared/trip";
import { stopForDay } from "@together/shared/trip-doc";
import type { TripEvent } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, router } from "expo-router";
import { CalendarDays, Check, ChevronRight, Compass, LayoutGrid, Map as MapIcon, Pencil, Ticket, UserPlus, Users, Vote, Wallet, type LucideIcon } from "lucide-react-native";
import { useMutation } from "convex/react";
import { api } from "@together/backend/api";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Countdown } from "@/components/trip/Countdown";
import { KidsNudge } from "@/components/trip/KidsNudge";
import { TentativeBanner } from "@/components/trip/TentativeBanner";
import { NotifyNudge } from "@/components/trip/NotifyNudge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { glyphIcon } from "@/lib/glyphs";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { uploadImage } from "@/lib/upload";
import { MAPS_AVAILABLE } from "@/lib/maps";
import { useEvents, useFamilies, usePlaces, useTrip } from "@/lib/trip";

const DEFAULT_DURATION_MIN = 90;
const FACE_TINT = ["#b08a55", "#4f7f7a", "#9c5a43", "#6b7fa8", "#8a8f52"];

const startOf = (event: TripEvent) => new Date(`${event.day}T${event.startTime}:00`);
const endOf = (event: TripEvent) => new Date(startOf(event).getTime() + (event.durationMin ?? DEFAULT_DURATION_MIN) * 60_000);

function greetingKey(now: Date): TKey {
  const hour = now.getHours();
  if (hour < 5) return "trip.home.greeting.night";
  if (hour < 12) return "trip.home.greeting.morning";
  if (hour < 18) return "trip.home.greeting.afternoon";
  return "trip.home.greeting.evening";
}

/** Now: the trip's cover, the next thing (when, where, how to get there), today as a route. */
export default function Now() {
  const t = useT();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { id, config, isAdmin } = useTrip();
  const events = useEvents();
  const places = usePlaces();
  const families = useFamilies();
  const base = `/t/${id}`;
  const go = (path: string) => router.push(`${base}${path}` as Href);
  const setCover = useMutation(api.trips.setCover);
  const [coverBusy, setCoverBusy] = useState(false);

  /** The cover is a default found for the destination; organizers can swap it for any photo from the gallery. */
  async function changeCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [4, 5] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setCoverBusy(true);
    try {
      const url = await uploadImage(asset.uri, asset.mimeType ?? "image/jpeg");
      await setCover({ tripId: id, imageUrl: url });
    } catch {
      // keep the current photo; the organizer can try again
    } finally {
      setCoverBusy(false);
    }
  }

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const today = todayIso();
  const duringTrip = today >= config.startDate && today <= config.endDate;
  const { next, todays, current } = useMemo(() => {
    const todays = (events ?? []).filter((e) => e.day === today);
    return {
      todays,
      current: todays.find((e) => startOf(e) <= now && now < endOf(e)) ?? null,
      next: (events ?? []).find((e) => startOf(e) > now) ?? null,
    };
  }, [events, now, today]);
  const nextPlace = (next?.placeId && places?.find((p) => p.id === next.placeId)) || null;
  const stop = stopForDay(config.stops, today);
  const region = next ? stopForDay(config.stops, next.day).region : stop.region;
  const dayNumber = tripDayNumber(today, config);
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long" });
  const dates = t("trip.home.tripDates", {
    start: dateFormat.format(new Date(`${config.startDate}T12:00:00`)),
    end: dateFormat.format(new Date(`${config.endDate}T12:00:00`)),
  });
  const travelers = (families ?? []).flatMap((family) => family.members.map((member) => ({ id: member.id, name: member.name })));
  const minutes = next ? Math.round((startOf(next).getTime() - now.getTime()) / 60_000) : 0;
  const timeUntil = !next
    ? null
    : minutes < 60
      ? t("trip.home.leavingInMinutes", { count: minutes })
      : minutes < 360
        ? minutes % 60
          ? t("trip.home.leavingInHoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
          : t("trip.home.leavingInHours", { hours: minutes / 60 })
        : minutes < 1440
          ? t("trip.home.inHours", { count: Math.floor(minutes / 60) })
          : null;

  const quick: { path: string; label: TKey; icon: LucideIcon }[] = [
    { path: "/schedule", label: "trip.home.quick.schedule", icon: CalendarDays },
    ...(MAPS_AVAILABLE ? [{ path: "/places?view=map", label: "trip.home.quick.map" as TKey, icon: MapIcon }] : []),
    { path: "/documents", label: "trip.home.quick.tickets", icon: Ticket },
    { path: "/expenses", label: "trip.home.quick.expenses", icon: Wallet },
    isAdmin ? { path: "/invites", label: "trip.home.quick.invite", icon: UserPlus } : { path: "/polls", label: "trip.home.quick.polls", icon: Vote },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.chart50 }} contentContainerStyle={{ paddingBottom: 120 }} contentInsetAdjustmentBehavior="never">
      {/* The trip as the cover of its own journal */}
      <View style={styles.hero}>
        {config.heroImage ? <Image source={config.heroImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <LinearGradient colors={["rgba(7,12,22,0.35)", "rgba(7,12,22,0.1)", "rgba(7,12,22,0.88)"]} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityRole="button" onPress={() => router.replace("/trips")} style={[styles.myTrips, { top: insets.top + 10 }]} hitSlop={8}>
          <Icon icon={LayoutGrid} size={14} color={colors.chart50} />
          <Text variant="caption" weight="medium" color={colors.chart50}>
            {t("settings.more.myTrips")}
          </Text>
        </Pressable>
        {isAdmin && (
          <Pressable accessibilityRole="button" accessibilityLabel={t("trip.eventForm.photoChange")} onPress={changeCover} disabled={coverBusy} hitSlop={8} style={[styles.coverPencil, { top: insets.top + 10 }]}>
            {coverBusy ? <ActivityIndicator size="small" color={colors.chart50} /> : <Icon icon={Pencil} size={16} color={colors.chart50} />}
          </Pressable>
        )}
        <View style={[styles.heroText, { paddingTop: insets.top + 56 }]} pointerEvents="box-none">
          {duringTrip ? (
            <>
              <View style={styles.dayChip}>
                <Icon icon={CalendarDays} size={14} color={colors.brass300} />
                <Text variant="caption" weight="medium" color={colors.chart50}>
                  {dayNumber ? t("trip.home.dayOf", { day: dayNumber, total: tripDays(config).length }) : dates}
                </Text>
              </View>
              <Text variant="displayLg" color={colors.chart50}>
                {t(greetingKey(now))}
              </Text>
              <Text variant="body" color="rgba(241,243,239,0.85)">
                {t("trip.home.nowIn", { place: stop.label })}
              </Text>
            </>
          ) : (
            <>
              <Text variant="small" color="rgba(241,243,239,0.8)">
                {dates}
              </Text>
              <Text variant="display" color={colors.chart50}>
                {config.heroTitle}
              </Text>
              <View style={{ marginTop: 12 }}>
                <Countdown targetIso={config.countdownTarget} />
              </View>
            </>
          )}
          {travelers.length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => go("/families")} style={styles.travelers}>
              <View style={styles.faces}>
                {travelers.slice(0, 5).map((person, index) => (
                  <View key={person.id} style={[styles.face, { backgroundColor: FACE_TINT[index % FACE_TINT.length] }, index > 0 && { marginStart: -10 }]}>
                    <Text variant="caption" weight="semibold" color="#fff">
                      {person.name.slice(0, 1)}
                    </Text>
                  </View>
                ))}
              </View>
              <Text variant="small" color="rgba(241,243,239,0.9)">
                {t("trip.home.group", { count: travelers.length })}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.body}>
        {/* The core tools, one tap away */}
        <View style={styles.quickCard}>
          {quick.map((item) => (
            <Pressable key={item.path} accessibilityRole="button" onPress={() => go(item.path)} style={styles.quickItem}>
              <View style={styles.quickIcon}>
                <Icon icon={item.icon} size={19} color={colors.ink700} />
              </View>
              <Text variant="caption" weight="medium" color={colors.ink700} align="center" numberOfLines={1}>
                {t(item.label)}
              </Text>
            </Pressable>
          ))}
        </View>

        <TentativeBanner />
        <KidsNudge />
        <NotifyNudge />

        {current && (
          <View style={styles.nowBanner}>
            <View style={styles.pulse} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="rgba(241,243,239,0.7)">
                {t("trip.home.happeningNow")}
              </Text>
              <Text variant="headline" weight="medium" color={colors.chart50} numberOfLines={1}>
                {current.title}
              </Text>
            </View>
          </View>
        )}

        {/* Next up: when, where and how */}
        <View style={{ gap: 12 }}>
          <Text variant="title">{t("trip.home.nextActivity")}</Text>
          {events === undefined ? (
            <ActivityIndicator color={colors.ink500} />
          ) : next ? (
            <Card style={{ overflow: "hidden" }}>
              <Pressable accessibilityRole="button" onPress={() => go(`/event/${next.id}`)}>
                <View style={{ height: 230, backgroundColor: colors.night900 }}>
                  {nextPlace?.imageUrl || (!nextPlace && config.heroImage) ? (
                    <Image source={nextPlace?.imageUrl || config.heroImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                  ) : null}
                  <LinearGradient colors={["rgba(7,12,22,0.25)", "rgba(7,12,22,0)", "rgba(7,12,22,0.86)"]} style={StyleSheet.absoluteFill} />
                  {timeUntil && minutes > 0 ? (
                    <View style={styles.until}>
                      <Text variant="caption" weight="medium" color={colors.brass100}>
                        {timeUntil}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.coverText}>
                    <Text variant="caption" color="rgba(241,243,239,0.85)">
                      {next.day === today ? t("common.today") : formatDayLabel(next.day, locale)}
                    </Text>
                    <Text variant="displayLg" color={colors.chart50} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr", alignSelf: "flex-start" }}>
                      {next.startTime}
                    </Text>
                  </View>
                </View>
                <View style={styles.nextBody}>
                  <View style={styles.nextText}>
                    <Text variant="headline" weight="medium">
                      {next.title}
                    </Text>
                    {nextPlace && nextPlace.name.trim().toLowerCase() !== next.title.trim().toLowerCase() && (
                      <Text variant="small" color={colors.ink500} numberOfLines={1}>
                        {nextPlace.name}
                      </Text>
                    )}
                    {families && (
                      <View style={styles.inline}>
                        <Icon icon={Users} size={15} color={colors.ink500} />
                        <Text variant="small" color={colors.ink500} numberOfLines={1} style={{ flex: 1 }}>
                          {participantsLabel(next.participants, families)}
                        </Text>
                      </View>
                    )}
                    {next.notes ? (
                      <Text variant="small" color={colors.ink700}>
                        {next.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
              <View style={styles.actions}>
                {nextPlace ? (
                  <>
                    <Button tone="brass" icon={Compass} label={t("trip.home.navigate")} onPress={() => Linking.openURL(wazeUrl(nextPlace, region))} style={{ flex: 1 }} />
                    <Button tone="soft" label={t("trip.home.details")} onPress={() => go(`/place/${nextPlace.id}`)} style={{ flex: 1 }} />
                    <Pressable accessibilityRole="link" accessibilityLabel="Google Maps" onPress={() => Linking.openURL(googleMapsUrl(nextPlace, region))} style={styles.mapsButton}>
                      <Icon icon={MapIcon} size={18} />
                    </Pressable>
                  </>
                ) : (
                  <Button tone="soft" icon={CalendarDays} label={t("trip.home.fullSchedule")} onPress={() => go("/schedule")} style={{ flex: 1 }} />
                )}
              </View>
            </Card>
          ) : (
            <Card style={styles.empty}>
              <Icon icon={CalendarDays} size={28} color={colors.ink400} />
              <Text variant="headline" weight="medium" align="center">
                {t("trip.home.emptyTitle")}
              </Text>
              <Text variant="small" color={colors.ink500} align="center">
                {t("trip.home.emptyDescription")}
              </Text>
              <Button label={t("trip.home.toPlaces")} onPress={() => go("/places")} />
            </Card>
          )}
        </View>

        {/* Today as a route: done, now, next */}
        {duringTrip && todays.length > 0 && (
          <View style={{ gap: 12 }}>
            <View style={styles.sectionHead}>
              <Text variant="title">{t("trip.home.todaySchedule")}</Text>
              <Pressable accessibilityRole="link" onPress={() => go("/schedule")} hitSlop={8}>
                <Text variant="small" weight="medium" color={colors.route700}>
                  {t("trip.home.fullSchedule")}
                </Text>
              </Pressable>
            </View>
            {todays.map((event, index) => {
              const isCurrent = current?.id === event.id;
              const isNext = !current && next?.id === event.id;
              const isPast = endOf(event) < now;
              const last = index === todays.length - 1;
              return (
                <View key={event.id} style={styles.routeRow}>
                  <View style={styles.rail}>
                    {!last && <View style={[styles.railLine, { backgroundColor: isPast ? colors.route500 : colors.chart200 }]} />}
                    <View
                      style={[
                        styles.dot,
                        isCurrent
                          ? { width: 16, height: 16, backgroundColor: colors.brass500, borderWidth: 4, borderColor: colors.brass100 }
                          : isNext
                            ? { width: 14, height: 14, borderWidth: 2, borderColor: colors.route500, backgroundColor: colors.paper }
                            : isPast
                              ? { backgroundColor: colors.route500 }
                              : { borderWidth: 2, borderColor: colors.chart200, backgroundColor: colors.paper },
                      ]}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => go(`/event/${event.id}`)}
                    style={[styles.routeItem, isCurrent ? styles.routeCurrent : isPast ? null : { backgroundColor: "rgba(255,255,255,0.7)" }]}
                  >
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ width: 54, fontVariant: ["tabular-nums"], writingDirection: "ltr" }} color={isPast ? colors.ink400 : colors.ink900}>
                      {event.startTime}
                    </Text>
                    {event.emoji ? <Icon icon={glyphIcon(event.emoji)} size={16} color={colors.ink500} /> : null}
                    <Text weight={isCurrent ? "medium" : "regular"} color={isPast ? colors.ink500 : colors.ink900} numberOfLines={1} style={{ flex: 1 }}>
                      {event.title}
                    </Text>
                    {isCurrent ? (
                      <Text variant="caption" weight="medium" color={colors.brass600}>
                        {t("trip.home.timelineNow")}
                      </Text>
                    ) : isNext ? (
                      <Text variant="caption" weight="medium" color={colors.route700}>
                        {t("trip.home.timelineNext")}
                      </Text>
                    ) : isPast ? (
                      <Icon icon={Check} size={16} color={colors.route500} />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {(places?.length ?? 0) > 0 && (
          <Pressable accessibilityRole="button" onPress={() => go("/places")} style={styles.saved}>
            <View style={styles.savedIcon}>
              <Icon icon={glyphIcon(config.emoji)} size={18} color={colors.route700} />
            </View>
            <Text color={colors.ink700} style={{ flex: 1 }}>
              {t("trip.home.savedPlaces", { count: places!.length })}
            </Text>
            <Icon icon={ChevronRight} size={18} color={colors.ink400} flip />
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 430, backgroundColor: colors.night900, justifyContent: "flex-end" },
  myTrips: {
    position: "absolute",
    end: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(7,12,22,0.45)",
    // Above the hero text, which can be long enough to reach the top of the cover
    zIndex: 10,
    elevation: 10,
  },
  coverPencil: { position: "absolute", start: 16, zIndex: 10, elevation: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(7,12,22,0.45)", alignItems: "center", justifyContent: "center" },
  heroText: { paddingHorizontal: 24, paddingBottom: 64, gap: 8 },
  dayChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(11,19,34,0.55)", borderWidth: StyleSheet.hairlineWidth * 2, borderColor: "rgba(255,255,255,0.18)" },
  travelers: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, alignSelf: "flex-start", paddingEnd: 14, paddingStart: 4, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(11,19,34,0.5)", borderWidth: StyleSheet.hairlineWidth * 2, borderColor: "rgba(255,255,255,0.14)" },
  faces: { flexDirection: "row" },
  face: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.night950,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 20, marginTop: -44, gap: 28 },
  quickCard: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.paper, borderRadius: 26, paddingVertical: 14, paddingHorizontal: 8, shadowColor: colors.ink900, shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  quickItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 6 },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chart50,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    alignItems: "center",
    justifyContent: "center",
  },
  nowBanner: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.night950, borderRadius: radius.card, padding: 16 },
  pulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brass500 },
  coverText: { position: "absolute", start: 18, end: 18, bottom: 14, gap: 0 },
  until: { position: "absolute", top: 14, start: 14, backgroundColor: "rgba(7,12,22,0.75)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  nextBody: { flexDirection: "row", gap: 14, padding: 18, paddingBottom: 4 },
  nextText: { flex: 1, gap: 4 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, padding: 18 },
  mapsButton: {
    width: 48,
    height: 48,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { padding: 24, gap: 10, alignItems: "center" },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  routeRow: { flexDirection: "row", gap: 12 },
  rail: { width: 16, alignItems: "center" },
  railLine: { position: "absolute", top: 22, bottom: -8, width: StyleSheet.hairlineWidth * 2 },
  dot: { width: 12, height: 12, borderRadius: 8, marginTop: 18 },
  routeItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 13 },
  routeCurrent: { backgroundColor: colors.paper, shadowColor: colors.ink900, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  saved: { flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.chart200, paddingTop: 18 },
  savedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.route100, alignItems: "center", justifyContent: "center" },
});
