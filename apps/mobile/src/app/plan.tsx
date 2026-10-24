import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { colors } from "@together/shared/tokens";
import { useMutation, useQuery } from "convex/react";
import { type Href, router } from "expo-router";
import { ChevronLeft, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { errorReason } from "@/lib/convert";
import { type TKey, useLocale, useT } from "@/lib/i18n";

const EXAMPLES: TKey[] = ["creator.planner.ex1", "creator.planner.ex2", "creator.planner.ex3"];
const PHASES = ["queued", "outline", "days", "places", "building"] as const;

/** Free text → a tentative trip. Starts the planner on the server and follows its progress. */
export default function Plan() {
  const t = useT();
  const { locale } = useLocale();
  const start = useMutation(api.planner.start);
  const quota = useQuery(api.planner.quota, {});
  const [text, setText] = useState("");
  const [runId, setRunId] = useState<Id<"planRuns"> | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useQuery(api.planner.status, runId ? { runId } : "skip");

  useEffect(() => {
    if (run?.status === "done" && run.tripId) router.replace(`/t/${run.tripId}` as Href);
    if (run?.status === "failed") {
      setRunId(null);
      setError(run.error === "plan_limit" ? t("creator.planner.limit") : t("creator.planner.failed"));
    }
  }, [run, t]);

  async function go() {
    setError(null);
    setStarting(true);
    try {
      setRunId(await start({ text, locale }));
    } catch (err) {
      const reason = errorReason(err);
      setError(reason === "plan_limit" ? t("creator.planner.limit") : reason === "plan_running" ? t("creator.planner.running") : t("creator.planner.failed"));
    } finally {
      setStarting(false);
    }
  }

  const working = runId !== null;
  const phase = (PHASES as readonly string[]).includes(run?.phase ?? "") ? (run?.phase as (typeof PHASES)[number]) : "queued";
  const detail = phase === "places" || phase === "days" ? (run?.detail ?? "") : "";

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} disabled={working} onPress={() => router.back()} style={[styles.back, working && { opacity: 0.3 }]}>
        <Icon icon={ChevronLeft} size={24} color={colors.ink900} />
      </Pressable>
      <Text variant="display">{t("creator.planner.title")}</Text>
      {working ? (
        <Card style={styles.progress}>
          <ActivityIndicator color={colors.ink900} />
          <Text variant="title" align="center">
            {t(`creator.planner.${phase}` as TKey, { detail })}
          </Text>
          <Text variant="small" color={colors.ink500} align="center">
            {t("creator.planner.note")}
          </Text>
        </Card>
      ) : (
        <>
          <Text weight="semibold">{t("creator.planner.label")}</Text>
          <Field large multiline value={text} onChangeText={setText} maxLength={1500} placeholder={t("creator.planner.placeholder")} style={styles.input} textAlignVertical="top" />
          <ChipRow>
            {EXAMPLES.map((key) => (
              <Chip key={key} label={t(key)} onPress={() => setText(t(key))} />
            ))}
          </ChipRow>
          {error && (
            <Text variant="small" color={colors.terra600}>
              {error}
            </Text>
          )}
          <Button tone="brass" size="lg" icon={Sparkles} label={t("creator.planner.go")} busy={starting} disabled={text.trim().length < 8 || quota?.left === 0} onPress={go} />
          {quota && (
            <Text variant="small" color={colors.ink500} align="center">
              {t("creator.planner.left", { n: quota.left })}
            </Text>
          )}
          <Text variant="small" color={colors.ink500} align="center">
            {t("creator.planner.note")}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: "center", marginStart: -8 },
  input: { minHeight: 140 },
  progress: { padding: 28, gap: 14, alignItems: "center", marginTop: 20 },
});
