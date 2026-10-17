import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { formatDayLabel } from "@together/i18n/format";
import { googleMapsUrl, wazeUrl } from "@together/shared/nav";
import { stopForDay } from "@together/shared/trip-doc";
import type { Place } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { useAction, useMutation } from "convex/react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, router, Stack, useLocalSearchParams } from "expo-router";
import {
  CalendarPlus,
  ChevronRight,
  Clock,
  Compass,
  Euro,
  Globe,
  Heart,
  Hourglass,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  PenLine,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  UserRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { placeArgs } from "@/components/places/geo";
import { type PlaceDraft, PlaceFields } from "@/components/places/PlaceFields";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { categoryIcon } from "@/lib/glyphs";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { useEvents, usePlace, useTrip } from "@/lib/trip";

const toDraft = (place: Place): PlaceDraft => ({
  name: place.name,
  category: place.category,
  area: place.area ?? "",
  address: place.address ?? "",
  summary: place.summary ?? "",
  openingHours: place.openingHours ?? "",
  priceNotes: place.priceNotes ?? "",
  tips: place.tips ?? "",
  popularDishes: place.popularDishes ?? "",
  reviewsSummary: place.reviewsSummary ?? "",
  website: place.website ?? "",
  bookingUrl: place.bookingUrl ?? "",
  imageUrl: place.imageUrl ?? "",
});

/** One place: photo, actions (navigate, schedule, favorite, AI details, edit, remove), details, its events. */
export default function PlaceDetail() {
  const t = useT();
  const { locale } = useLocale();
  const { id, config, canDeletePlaces } = useTrip();
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const place = usePlace(String(placeId));
  const events = useEvents();
  const update = useMutation(api.places.update);
  const remove = useMutation(api.places.remove);
  const enrich = useAction(api.placesAi.enrich);

  const [editing, setEditing] = useState<PlaceDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  if (place === undefined) return <ActivityIndicator color={colors.ink500} style={{ marginTop: 120 }} />;
  if (place === null) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ headerTransparent: false, title: "" }} />
        <Icon icon={MapPinOff} size={32} color={colors.ink400} />
        <Text variant="headline" weight="medium" align="center">
          {t("trip.place.notFoundTitle")}
        </Text>
        <Text variant="small" color={colors.ink500} align="center">
          {t("trip.place.notFoundDescription")}
        </Text>
        <Button label={t("trip.place.allPlaces")} onPress={() => router.back()} />
      </View>
    );
  }

  const placeKey = place.id as Id<"places">;
  const category = t(`trip.categories.${place.category}` as TKey);
  const placeEvents = (events ?? []).filter((e) => e.placeId === place.id).sort((a, b) => (a.day + a.startTime).localeCompare(b.day + b.startTime));
  // Ambiguous addresses resolve inside the stop where we'll actually be
  const region = placeEvents.length ? stopForDay(config.stops, placeEvents[0].day).region : config.searchRegionHint;
  const rating = (place as Place & { rating?: number }).rating;

  const rows = (
    [
      place.address && { icon: MapPin, label: t("trip.place.fields.address"), value: place.address },
      place.openingHours && { icon: Clock, label: t("trip.place.fields.openingHours"), value: place.openingHours },
      place.priceNotes && { icon: Euro, label: t("trip.place.fields.price"), value: place.priceNotes },
      place.recommendedDurationMin && {
        icon: Hourglass,
        label: t("trip.place.fields.recommendedTime"),
        value: t("trip.place.aboutHours", { count: Math.max(1, Math.round(place.recommendedDurationMin / 60)) }),
      },
      place.tips && { icon: Lightbulb, label: t("trip.place.fields.tips"), value: place.tips },
      place.popularDishes && { icon: UtensilsCrossed, label: t("trip.place.fields.dishes"), value: place.popularDishes },
      place.reviewsSummary && { icon: Star, label: t("trip.place.fields.reviews"), value: place.reviewsSummary },
      place.createdByName && { icon: UserRound, label: t("trip.place.fields.addedBy"), value: place.createdByName },
    ].filter(Boolean) as { icon: LucideIcon; label: string; value: string }[]
  );
  const sparse = !place.summary && rows.length < 2;

  async function runEnrich() {
    if (enriching) return;
    setEnriching(true);
    setNotice({ text: t("trip.place.enriching"), error: false });
    try {
      const result = await enrich({ tripId: id, placeId: placeKey, locale });
      setNotice({ text: result.ok ? t("trip.place.enrichDone") : result.message || t("trip.place.enrichNothing"), error: !result.ok });
    } catch {
      setNotice({ text: t("trip.place.enrichFailed"), error: true });
    } finally {
      setEnriching(false);
    }
  }

  async function saveEdit() {
    if (!editing || saving || !editing.name.trim()) return;
    setSaving(true);
    try {
      // Empty strings are sent too, so clearing a field sticks
      await update({ tripId: id, placeId: placeKey, patch: placeArgs({ ...editing, name: editing.name.trim() }) });
      setEditing(null);
    } catch {
      setNotice({ text: t("common.errors.saveFailed"), error: true });
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove() {
    Alert.alert(t("trip.place.confirmDelete", { name: place!.name }), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("trip.place.confirmDeleteYes"),
        style: "destructive",
        onPress: () =>
          remove({ tripId: id, placeId: placeKey })
            .then(() => router.back())
            .catch(() => setNotice({ text: t("common.errors.saveFailed"), error: true })),
      },
    ]);
  }

  const actions: { key: string; icon: LucideIcon; label: string; onPress: () => void; active?: boolean; danger?: boolean }[] = [
    {
      key: "favorite",
      icon: Heart,
      label: t("trip.place.actions.favorite"),
      active: Boolean(place.favorite),
      onPress: () => void update({ tripId: id, placeId: placeKey, patch: { favorite: !place.favorite } }),
    },
    ...(place.website ? [{ key: "website", icon: Globe, label: t("trip.place.actions.website"), onPress: () => void Linking.openURL(place.website!) }] : []),
    ...(place.bookingUrl ? [{ key: "tickets", icon: Ticket, label: t("trip.place.actions.tickets"), onPress: () => void Linking.openURL(place.bookingUrl!) }] : []),
    { key: "enrich", icon: Sparkles, label: t("trip.place.actions.enrich"), onPress: runEnrich },
    { key: "edit", icon: PenLine, label: t("trip.place.actions.edit"), onPress: () => setEditing(toDraft(place)) },
    ...(canDeletePlaces ? [{ key: "remove", icon: Trash2, label: t("trip.place.actions.remove"), onPress: confirmRemove, danger: true }] : []),
  ];

  if (editing) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.chart50 }} contentContainerStyle={styles.editBody} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Stack.Screen options={{ headerTransparent: false, title: t("trip.place.actions.edit") }} />
        <PlaceFields draft={editing} onChange={setEditing} />
        <Button size="lg" label={saving ? t("common.saving") : t("common.save")} onPress={saveEdit} busy={saving} disabled={!editing.name.trim()} />
        <Button tone="outline" label={t("common.cancel")} onPress={() => setEditing(null)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.chart50 }} contentContainerStyle={{ paddingBottom: 64 }} contentInsetAdjustmentBehavior="never">
      <Stack.Screen options={{ headerTransparent: true, title: "", headerTintColor: colors.chart50 }} />
      <View style={styles.hero}>
        {place.imageUrl ? (
          <Image source={place.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroFallback]}>
            <Icon icon={categoryIcon(place.category)} size={48} color="rgba(241,243,239,0.4)" />
          </View>
        )}
        <LinearGradient colors={["rgba(7,12,22,0.5)", "transparent", "rgba(7,12,22,0.85)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroText}>
          <View style={styles.inline}>
            <Icon icon={categoryIcon(place.category)} size={14} color="rgba(241,243,239,0.85)" />
            <Text variant="small" color="rgba(241,243,239,0.85)">
              {category}
              {place.area ? ` · ${place.area}` : ""}
            </Text>
            {rating ? (
              <>
                <Icon icon={Star} size={13} color={colors.brass300} />
                <Text variant="small" color="rgba(241,243,239,0.85)">
                  {rating.toFixed(1)}
                </Text>
              </>
            ) : null}
          </View>
          <Text variant="display" color={colors.chart50}>
            {place.name}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button tone="brass" icon={Compass} label={t("trip.home.navigate")} onPress={() => Linking.openURL(wazeUrl(place, region))} style={{ flex: 1 }} />
          <Pressable accessibilityRole="link" accessibilityLabel="Google Maps" onPress={() => Linking.openURL(googleMapsUrl(place, region))} style={styles.square}>
            <Icon icon={MapIcon} size={18} />
          </Pressable>
        </View>
        <Button
          tone="soft"
          icon={CalendarPlus}
          label={t("trip.place.addToSchedule")}
          onPress={() => router.push(`/t/${id}/event/new?placeId=${place.id}&title=${encodeURIComponent(place.name)}` as Href)}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
          {actions.map((action) => (
            <Pressable key={action.key} accessibilityRole="button" accessibilityState={{ selected: action.active }} onPress={action.onPress} style={styles.action}>
              <View style={[styles.actionIcon, action.active && { backgroundColor: colors.terra100, borderColor: colors.terra100 }]}>
                {action.key === "enrich" && enriching ? (
                  <ActivityIndicator size="small" color={colors.ink500} />
                ) : (
                  <Icon icon={action.icon} size={18} color={action.danger ? colors.terra600 : action.active ? colors.terra500 : colors.ink700} />
                )}
              </View>
              <Text variant="caption" weight="medium" color={action.danger ? colors.terra600 : colors.ink700} align="center" numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {notice && (
          <Text accessibilityRole={notice.error ? "alert" : undefined} variant="small" weight="medium" color={notice.error ? colors.terra600 : colors.route700}>
            {notice.text}
          </Text>
        )}

        {sparse && !enriching ? (
          <Card style={styles.sparse}>
            <Text variant="headline" weight="medium">
              {t("trip.place.emptyDetailsTitle")}
            </Text>
            <Text variant="small" color={colors.ink500}>
              {t("trip.place.emptyDetailsBody")}
            </Text>
            <Button tone="soft" icon={Sparkles} label={t("trip.place.enrichCta")} onPress={runEnrich} />
          </Card>
        ) : null}

        {place.summary ? (
          <Text variant="body" color={colors.ink700}>
            {place.summary}
          </Text>
        ) : null}

        {rows.length > 0 && (
          <Card style={{ overflow: "hidden" }}>
            {rows.map((row, index) => (
              <View key={row.label} style={[styles.row, index > 0 && styles.rowDivider]}>
                <Icon icon={row.icon} size={18} color={colors.ink500} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="caption" color={colors.ink500}>
                    {row.label}
                  </Text>
                  <Text selectable>{row.value}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {placeEvents.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text variant="title">{t("trip.place.onSchedule")}</Text>
            <Card style={{ overflow: "hidden" }}>
              {placeEvents.map((event, index) => (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/t/${id}/event/${event.id}` as Href)}
                  style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && { backgroundColor: colors.chart100 }]}
                >
                  <View style={styles.dot} />
                  <View style={{ flex: 1 }}>
                    <Text>{formatDayLabel(event.day, locale)}</Text>
                    {event.title ? (
                      <Text variant="small" color={colors.ink500} numberOfLines={1}>
                        {event.title}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="headline" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>
                    {event.startTime}
                  </Text>
                  <Icon icon={ChevronRight} size={16} color={colors.ink300} flip />
                </Pressable>
              ))}
            </Card>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: colors.chart50 },
  hero: { height: 340, justifyContent: "flex-end", backgroundColor: colors.night900 },
  heroFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.route700 },
  heroText: { paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  body: { paddingHorizontal: 20, paddingTop: 18, gap: 18 },
  square: {
    width: 48,
    height: 48,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  action: { width: 72, alignItems: "center", gap: 6 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    alignItems: "center",
    justifyContent: "center",
  },
  sparse: { padding: 18, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart200 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.route500 },
  editBody: { padding: 20, gap: 16, paddingBottom: 64 },
});
