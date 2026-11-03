import { api } from "@together/backend/api";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { Alert } from "react-native";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

export type ReportKind = "ai_reply" | "place" | "member" | "other";

/** "Report" for anything a group member or the AI put on screen: pick a reason, it reaches support within the day. */
export function useReport() {
  const t = useT();
  const { id: tripId } = useTrip();
  const submit = useMutation(api.reports.submit);
  return useCallback(
    (kind: ReportKind, targetId: string, excerpt: string) => {
      const send = (reason: string) =>
        submit({ tripId, kind, targetId, excerpt, reason })
          .then(() => Alert.alert(t("common.report.thanks")))
          .catch(() => Alert.alert(t("common.report.failed")));
      Alert.alert(t("common.report.title"), undefined, [
        { text: t("common.report.offensive"), onPress: () => void send("offensive") },
        { text: t("common.report.wrong"), onPress: () => void send("wrong") },
        { text: t("common.report.spam"), onPress: () => void send("spam") },
        { text: t("common.cancel"), style: "cancel" },
      ]);
    },
    [submit, tripId, t]
  );
}
