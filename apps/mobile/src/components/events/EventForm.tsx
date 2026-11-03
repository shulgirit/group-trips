import { formatDayLabel } from "@together/i18n/format";
import { todayIso, tripDays } from "@together/shared/trip";
import type { Participants } from "@together/shared/types";
import { colors } from "@together/shared/tokens";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { api } from "@together/backend/api";
import { useAction, useMutation } from "convex/react";
import { uploadToTrip } from "@/lib/upload";
import { DurationChips } from "@/components/events/DurationChips";
import { GlyphPicker } from "@/components/events/GlyphPicker";
import { ParticipantsPicker } from "@/components/events/ParticipantsPicker";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Field } from "@/components/ui/Field";
import { Labeled } from "@/components/ui/Label";
import { PickerSheet } from "@/components/ui/PickerSheet";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { TimeField } from "@/components/ui/TimeField";
import type { EventDraft } from "@/lib/convert";
import { useLocale, useT } from "@/lib/i18n";
import { useFamilies, usePlaces, useTrip } from "@/lib/trip";

/** Add or edit an event: what, icon, place, day, time, duration, who, notes. */
export function EventForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial: Partial<EventDraft>;
  submitLabel: string;
  onSubmit: (draft: EventDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { id: tripId, config } = useTrip();
  const addPlace = useMutation(api.places.add);
  const updatePlace = useMutation(api.places.update);
  const fileUrl = useMutation(api.documents.fileUrl);
  const searchPlaces = useAction(api.placesAi.search);
  const families = useFamilies();
  const places = usePlaces();
  const days = tripDays(config);
  const today = todayIso();

  const [title, setTitle] = useState(initial.title ?? "");
  const [emoji, setEmoji] = useState(initial.emoji ?? "");
  const [placeId, setPlaceId] = useState(initial.placeId ?? "");
  const [day, setDay] = useState(initial.day && days.includes(initial.day) ? initial.day : days.includes(today) ? today : days[0]);
  const [startTime, setStartTime] = useState(initial.startTime ?? "10:00");
  const [durationMin, setDurationMin] = useState<number | null>(initial.durationMin ?? null);
  const [participants, setParticipants] = useState<Participants>(initial.participants ?? { type: "all" });
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [address, setAddress] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const participantsInvalid =
    (participants.type === "families" && !participants.familyIds.length) || (participants.type === "members" && !participants.memberIds.length);
  const disabled = saving || !title.trim() || participantsInvalid;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoBusy(true);
    setError("");
    try {
      const storageId = await uploadToTrip(tripId, asset.uri, asset.mimeType ?? "image/jpeg");
      setPhoto(await fileUrl({ tripId, storageId }));
    } catch {
      setError(t("common.errors.saveFailed"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit() {
    if (disabled) return;
    setSaving(true);
    setError("");
    try {
      let linked = placeId;
      if (!linked && (address.trim() || photo)) {
        // A typed address (or a chosen photo) becomes a place of its own: it brings the map pin, the navigate button
        // and, when no photo was chosen, an automatic Google photo
        let found: { address: string; area: string; lat: number | null; lng: number | null; imageUrl: string } | undefined;
        if (address.trim()) {
          found = await searchPlaces({ tripId, query: address.trim() }).then((rows) => rows[0]).catch(() => undefined);
        }
        const created = await addPlace({
          tripId,
          input: {
            name: title.trim(),
            category: "other",
            address: found?.address || address.trim() || undefined,
            area: found?.area || undefined,
            lat: found?.lat ?? undefined,
            lng: found?.lng ?? undefined,
            imageUrl: photo || found?.imageUrl || undefined,
          },
        });
        linked = created.id;
      } else if (linked && photo) {
        await updatePlace({ tripId, placeId: linked as never, patch: { imageUrl: photo } });
      }
      await onSubmit({ title, emoji: emoji || undefined, placeId: linked || null, day, startTime, durationMin, participants, notes });
    } catch {
      setError(t("common.errors.saveFailed"));
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(t("trip.eventForm.delete"), title, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("trip.eventForm.confirmDelete"),
        style: "destructive",
        onPress: () => onDelete().catch(() => setError(t("trip.eventForm.deleteFailed"))),
      },
    ]);
  }

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 48 }}>
      <Labeled label={t("trip.eventForm.what")}>
        <Field value={title} onChangeText={setTitle} large autoFocus={!initial.title} returnKeyType="done" />
      </Labeled>
      <Labeled label={t("trip.eventForm.icon")}>
        <GlyphPicker value={emoji} onChange={setEmoji} />
      </Labeled>
      <Labeled label={t("trip.eventForm.linkedPlace")}>
        <PickerSheet
          title={t("trip.eventForm.linkedPlace")}
          value={placeId}
          onChange={setPlaceId}
          none={t("trip.eventForm.noPlace")}
          options={(places ?? []).map((place) => ({ value: place.id, label: place.name, detail: place.address }))}
        />
      </Labeled>
      {!placeId && (
        <Labeled label={t("trip.eventForm.address")}>
          <Field value={address} onChangeText={setAddress} placeholder={t("trip.eventForm.addressPlaceholder")} autoComplete="street-address" returnKeyType="done" />
          <Text variant="caption" color={colors.ink500}>
            {t("trip.eventForm.addressHint")}
          </Text>
        </Labeled>
      )}
      {placeId ? (
        <Text variant="caption" color={colors.ink500}>
          {t("trip.eventForm.addressLinked")}
        </Text>
      ) : null}
      <Labeled label={t("trip.eventForm.photo")}>
        <Pressable accessibilityRole="button" onPress={pickPhoto} disabled={photoBusy} style={styles.photo}>
          {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={styles.photoLabel}>
            {photoBusy ? <ActivityIndicator color={colors.chart50} /> : null}
            <Text variant="small" weight="medium" color={photo ? colors.chart50 : colors.ink700}>
              {photo ? t("trip.eventForm.photoChange") : t("trip.eventForm.photoAdd")}
            </Text>
          </View>
        </Pressable>
      </Labeled>
      <Labeled label={t("trip.schedule.whichDay")}>
        <ChipRow scroll>
          {days.map((d) => (
            <Chip key={d} label={`${formatDayLabel(d, locale)}${d === today ? ` · ${t("common.today")}` : ""}`} active={day === d} onPress={() => setDay(d)} />
          ))}
        </ChipRow>
      </Labeled>
      <Labeled label={t("trip.schedule.time")}>
        <TimeField label={t("trip.schedule.time")} value={startTime} onChange={setStartTime} />
      </Labeled>
      <Labeled label={t("trip.eventForm.duration")}>
        <DurationChips value={durationMin} onChange={setDurationMin} />
      </Labeled>
      <Labeled label={t("trip.schedule.whoComes")}>
        {families ? <ParticipantsPicker value={participants} onChange={setParticipants} families={families} /> : <ActivityIndicator color={colors.ink500} />}
      </Labeled>
      <Labeled label={t("trip.eventForm.notes")}>
        <Field value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
      </Labeled>
      {error ? (
        <Text accessibilityRole="alert" variant="small" weight="medium" color={colors.terra600}>
          {error}
        </Text>
      ) : null}
      <Button size="lg" label={saving ? t("common.saving") : submitLabel} onPress={submit} disabled={disabled} busy={saving} />
      {onDelete && (
        <View style={{ alignItems: "center" }}>
          <Button tone="outline" icon={Trash2} label={t("trip.eventForm.delete")} onPress={confirmDelete} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { height: 120, borderRadius: 16, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  photoLabel: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(7,12,22,0.25)" },
});
