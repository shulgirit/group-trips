import { formatDayLabel } from "@together/i18n/format";
import { googleMapsUrl, wazeUrl } from "@together/shared/nav";
import { participantsIntersect, participantsLabel } from "@together/shared/participants";
import { todayIso, tripDayNumber, tripDays } from "@together/shared/trip";
import { stopForDay } from "@together/shared/trip-doc";
import type { Family, TripEvent } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { Image } from "expo-image";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { CalendarDays, Compass, Map as MapIcon, Plus, Split, TriangleAlert, Users } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { categoryIcon, glyphIcon } from "@/lib/glyphs";
import { useLocale, useT } from "@/lib/i18n";
import { useEvents, useFamilies, usePlaces, useTrip } from "@/lib/trip";

const DEFAULT_DURATION_MIN = 90;

const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

function overlap(a: TripEvent, b: TripEvent) {
  const startA = minutesOf(a.startTime);
  const startB = minutesOf(b.startTime);
  return startA < startB + (b.durationMin ?? DEFAULT_DURATION_MIN) && startB < startA + (a.durationMin ?? DEFAULT_DURATION_MIN);
}

/** Per event: does the group split up (overlap, different people) or clash (same people twice)? */
function analyzeDay(events: TripEvent[], families: Family[]) {
  const flags = new Map(events.map((e) => [e.id, { split: false, conflict: false }]));
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const [a, b] = [events[i], events[j]];
      if (!overlap(a, b)) continue;
      const key = participantsIntersect(a.participants, b.participants, families) ? "conflict" : "split";
      flags.get(a.id)![key] = true;
      flags.get(b.id)![key] = true;
    }
  }
  return flags;
}

/** The trip day by day: a day strip, then the day as a route of events. */
export default function Schedule() {
  const t = useT();
  const { locale } = useLocale();
  const { id, config } = useTrip();
  const params = useLocalSearchParams<{ day?: string }>();
  const days = tripDays(config);
  const today = todayIso();
  const [selected, setSelected] = useState(params.day && days.includes(params.day) ? params.day : days.includes(today) ? today : days[0]);
  // Reminder pushes deep-link here with ?day=
  useEffect(() => {
    if (params.day && days.includes(params.day)) setSelected(params.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.day]);
  const events = useEvents();
  const places = usePlaces();
  const families = useFamilies();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const dayEvents = useMemo(() => (events ?? []).filter((e) => e.day === selected), [events, selected]);
  const flags = useMemo(() => analyzeDay(dayEvents, families ?? []), [dayEvents, families]);
  const hasSplit = dayEvents.some((e) => flags.get(e.id)?.split);
  const dayNumber = tripDayNumber(selected, config);
  const stop = stopForDay(config.stops, selected);
  const go = (path: string) => router.push(`/t/${id}${path}` as Href);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.chart50 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} stickyHeaderIndices={[1]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text variant="small" color={colors.ink500}>
              {t("trip.calendar.kicker")}
            </Text>
            <Text variant="display">{t("trip.calendar.title")}</Text>
          </View>
          <Button icon={Plus} label={t("trip.calendar.addEvent")} onPress={() => go(`/event/new?day=${selected}`)} />
        </View>

        {/* Day strip */}
        <View style={{ backgroundColor: colors.chart50, paddingVertical: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {days.map((day, index) => {
              const active = day === selected;
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(day)}
                  style={[styles.day, active ? styles.dayActive : day === today ? styles.dayToday : null]}
                >
                  <Text variant="caption" color={active ? "rgba(241,243,239,0.75)" : colors.ink500}>
                    {t("trip.calendar.dayN", { n: index + 1 })}
                  </Text>
                  <Text variant="small" weight="medium" color={active ? colors.chart50 : colors.ink900} style={{ writingDirection: "ltr" }}>
                    {formatDayLabel(day, locale).split("· ")[1] ?? day.slice(5)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.body}>
          <View style={styles.dayLine}>
            <Text variant="small" color={colors.ink500} style={{ flexShrink: 1 }}>
              {formatDayLabel(selected, locale)}
              {dayNumber ? ` · ${t("trip.calendar.dayOf", { day: dayNumber, total: days.length })}` : ""}
              {config.stops.length > 1 ? ` · ${stop.label}` : ""}
              {selected === today ? ` · ${t("common.today")}` : ""}
            </Text>
            {hasSplit && (
              <View style={styles.splitBadge}>
                <Icon icon={Split} size={12} color={colors.ink700} />
                <Text variant="caption" weight="medium" color={colors.ink700}>
                  {t("trip.calendar.split")}
                </Text>
              </View>
            )}
          </View>

          {events === undefined ? (
            <ActivityIndicator color={colors.ink500} style={{ marginTop: 32 }} />
          ) : dayEvents.length === 0 ? (
            <Card style={styles.empty}>
              <Icon icon={CalendarDays} size={28} color={colors.ink400} />
              <Text variant="headline" weight="medium" align="center">
                {t("trip.calendar.emptyTitle")}
              </Text>
              <Text variant="small" color={colors.ink500} align="center">
                {t("trip.calendar.emptyDescription")}
              </Text>
              <Button label={t("trip.calendar.pickPlace")} onPress={() => go("/places")} />
            </Card>
          ) : (
            dayEvents.map((event, index) => {
              const place = event.placeId ? (places?.find((p) => p.id === event.placeId) ?? null) : null;
              const flag = flags.get(event.id);
              const region = stopForDay(config.stops, event.day).region;
              const last = index === dayEvents.length - 1;
              const past =
                event.day === today && minutesOf(event.startTime) + (event.durationMin ?? DEFAULT_DURATION_MIN) < now.getHours() * 60 + now.getMinutes();
              return (
                <View key={event.id} style={[styles.row, past && { opacity: 0.6 }]}>
                  <View style={styles.spine}>
                    <Text variant="headline" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>
                      {event.startTime}
                    </Text>
                    {event.durationMin ? (
                      <Text variant="caption" color={colors.ink400}>
                        {event.durationMin >= 60
                          ? t("trip.units.hoursShort", { value: +(event.durationMin / 60).toFixed(1) })
                          : t("trip.units.minutesShort", { value: event.durationMin })}
                      </Text>
                    ) : null}
                    <View
                      style={[
                        styles.node,
                        flag?.conflict
                          ? { backgroundColor: colors.terra500 }
                          : flag?.split
                            ? { backgroundColor: colors.brass500 }
                            : past
                              ? { backgroundColor: colors.route500 }
                              : { borderWidth: 2, borderColor: colors.route500, backgroundColor: colors.paper },
                      ]}
                    />
                    {!last && <View style={styles.line} />}
                  </View>
                  <Card
                    style={[
                      styles.card,
                      flag?.conflict ? { borderColor: colors.terra500 } : flag?.split ? { borderColor: colors.brass300 } : null,
                    ]}
                  >
                    <Pressable accessibilityRole="button" onPress={() => go(`/event/${event.id}`)} style={styles.cardMain}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text variant="headline" weight="medium" numberOfLines={2}>
                          {event.title}
                        </Text>
                        {place && (
                          <Text variant="small" color={colors.ink500} numberOfLines={1}>
                            {place.name}
                          </Text>
                        )}
                        {families && (
                          <View style={styles.inline}>
                            <Icon icon={Users} size={14} color={colors.ink500} />
                            <Text variant="small" color={colors.ink500} numberOfLines={1} style={{ flex: 1 }}>
                              {participantsLabel(event.participants, families)}
                            </Text>
                          </View>
                        )}
                        {event.notes ? (
                          <Text variant="small" color={colors.ink700} numberOfLines={2}>
                            {event.notes}
                          </Text>
                        ) : null}
                        {flag?.conflict && (
                          <View style={styles.inline}>
                            <Icon icon={TriangleAlert} size={14} color={colors.terra600} />
                            <Text variant="small" weight="medium" color={colors.terra600}>
                              {t("trip.calendar.conflict")}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.thumb}>
                        {place?.imageUrl ? (
                          <Image source={place.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                        ) : (
                          <Icon icon={place ? categoryIcon(place.category) : glyphIcon(event.emoji, CalendarDays)} size={24} color={colors.route700} />
                        )}
                      </View>
                    </Pressable>
                    {(place || event.createdByName) && (
                      <View style={styles.cardFoot}>
                        {place && (
                          <>
                            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(wazeUrl(place, region))} style={styles.navPill}>
                              <Icon icon={Compass} size={15} color={colors.route700} />
                              <Text variant="small" weight="medium" color={colors.route700}>
                                {t("trip.home.navigate")}
                              </Text>
                            </Pressable>
                            <Pressable accessibilityRole="link" accessibilityLabel="Google Maps" onPress={() => Linking.openURL(googleMapsUrl(place, region))} style={styles.iconButton} hitSlop={6}>
                              <Icon icon={MapIcon} size={15} color={colors.ink500} />
                            </Pressable>
                          </>
                        )}
                        <View style={{ flex: 1 }} />
                        {event.createdByName ? (
                          <Text variant="caption" color={colors.ink400} numberOfLines={1}>
                            {event.createdByName}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </Card>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  day: {
    minWidth: 64,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  dayActive: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
  dayToday: { borderColor: colors.brass500 },
  body: { paddingHorizontal: 20, gap: 4 },
  dayLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  splitBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.brass300, paddingHorizontal: 10, paddingVertical: 4 },
  empty: { padding: 24, gap: 10, alignItems: "center" },
  row: { flexDirection: "row", gap: 12 },
  spine: { width: 56, alignItems: "center" },
  node: { width: 12, height: 12, borderRadius: 6, marginTop: 8 },
  line: { flex: 1, width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.route300, marginTop: 4 },
  card: { flex: 1, marginBottom: 16, overflow: "hidden" },
  cardMain: { flexDirection: "row", gap: 12, padding: 12 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  thumb: { width: 76, height: 76, borderRadius: 12, overflow: "hidden", backgroundColor: colors.route100, alignItems: "center", justifyContent: "center" },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart200, paddingHorizontal: 12, paddingVertical: 8 },
  navPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.route100, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  iconButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.chip },
});
