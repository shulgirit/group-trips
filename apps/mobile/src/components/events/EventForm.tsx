import { formatDayLabel } from "@together/i18n/format";
import { todayIso, tripDays } from "@together/shared/trip";
import type { Participants } from "@together/shared/types";
import { colors } from "@together/shared/tokens";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
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
  const { config } = useTrip();
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const participantsInvalid =
    (participants.type === "families" && !participants.familyIds.length) || (participants.type === "members" && !participants.memberIds.length);
  const disabled = saving || !title.trim() || participantsInvalid;

  async function submit() {
    if (disabled) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({ title, emoji: emoji || undefined, placeId: placeId || null, day, startTime, durationMin, participants, notes });
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
