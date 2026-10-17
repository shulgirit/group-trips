import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { colors } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { CalendarX } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { EventForm } from "@/components/events/EventForm";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { eventArgs } from "@/lib/convert";
import { useT } from "@/lib/i18n";
import { useEvent, useTrip } from "@/lib/trip";

/** Edit (or delete) an event. Prefilled once from the live row. */
export default function EditEvent() {
  const t = useT();
  const { id } = useTrip();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(String(eventId));
  const update = useMutation(api.events.update);
  const remove = useMutation(api.events.remove);

  if (event === undefined) {
    return <ActivityIndicator color={colors.ink500} style={{ marginTop: 48 }} />;
  }
  if (event === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
        <Icon icon={CalendarX} size={32} color={colors.ink400} />
        <Text variant="headline" weight="medium" align="center">
          {t("trip.eventForm.notFoundTitle")}
        </Text>
        <Text variant="small" color={colors.ink500} align="center">
          {t("trip.eventForm.notFoundDescription")}
        </Text>
        <Button label={t("trip.eventForm.toSchedule")} onPress={() => router.back()} />
      </View>
    );
  }

  const eventKey = event.id as Id<"events">;
  return (
    <>
      <Stack.Screen options={{ title: t("trip.eventForm.editTitle") }} />
      <EventForm
        key={event.id}
        initial={{ ...event, emoji: event.emoji ?? undefined, placeId: event.placeId ?? null, durationMin: event.durationMin ?? null }}
        submitLabel={t("trip.eventForm.saveChanges")}
        onSubmit={async (draft) => {
          await update({ tripId: id, eventId: eventKey, input: eventArgs(draft) });
          router.back();
        }}
        onDelete={async () => {
          await remove({ tripId: id, eventId: eventKey });
          router.back();
        }}
      />
    </>
  );
}
