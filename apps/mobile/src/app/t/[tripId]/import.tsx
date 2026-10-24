import { colors } from "@together/shared/tokens";
import { Stack } from "expo-router";
import { BookingImporter } from "@/components/creator/BookingImporter";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Upload or paste a booking: it lands in the schedule, and an AI-planned trip reshapes itself around it. */
export default function ImportBooking() {
  const t = useT();
  const { id, doc } = useTrip();
  return (
    <>
      <Stack.Screen options={{ title: t("money.docs.importTitle") }} />
      <Screen edges={[]}>
        <Text color={colors.ink500}>{doc.tentative ? t("creator.planner.importHintPlan") : t("money.docs.importHint")}</Text>
        <BookingImporter tripId={id} />
      </Screen>
    </>
  );
}
