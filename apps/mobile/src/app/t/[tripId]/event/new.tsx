import { api } from "@together/backend/api";
import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { EventForm } from "@/components/events/EventForm";
import { eventArgs } from "@/lib/convert";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** New event (modal). ?day=, ?placeId= and ?title= prefill it (from a place or a day). */
export default function NewEvent() {
  const t = useT();
  const { id } = useTrip();
  const params = useLocalSearchParams<{ day?: string; placeId?: string; title?: string }>();
  const add = useMutation(api.events.add);
  return (
    <EventForm
      initial={{ day: params.day, placeId: params.placeId ?? null, title: params.title }}
      submitLabel={t("trip.schedule.submit")}
      onSubmit={async (draft) => {
        await add({ tripId: id, input: eventArgs(draft) });
        router.back();
      }}
    />
  );
}
