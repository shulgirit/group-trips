import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { Lightbulb, Plus, Vote, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { usePolls, useTrip } from "@/lib/trip";
import { Sheet } from "@/components/ui/Sheet";

/**
 * "Add to poll" chooser: an existing open poll, the standing ideas poll, or a
 * brand-new poll seeded with this option.
 */
export function AddToPollSheet({
  open,
  onClose,
  label,
  placeId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  placeId?: string | null;
  onAdded?: () => void;
}) {
  const t = useT();
  const { id: tripId } = useTrip();
  const polls = usePolls();
  const addToIdeas = useMutation(api.polls.addToIdeas);
  const addOption = useMutation(api.polls.addOption);
  const create = useMutation(api.polls.create);
  const [target, setTarget] = useState<string>("ideas");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const place = placeId ? (placeId as Id<"places">) : null;
  const openPolls = (polls ?? []).filter((poll) => !poll.closed && !poll.pinned);

  async function confirm() {
    if (busy) return;
    if (target === "new" && !question.trim()) {
      setMessage(t("polls.sheet.needQuestion"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      let result: "added" | "exists" = "added";
      if (target === "new") await create({ tripId, question, options: [{ label, placeId: place }] });
      else if (target === "ideas") result = await addToIdeas({ tripId, label, placeId: place });
      else result = await addOption({ tripId, pollId: target as Id<"polls">, label, placeId: place });
      if (result === "exists") {
        setMessage(t("polls.sheet.exists", { label }));
        return;
      }
      onAdded?.();
      onClose();
      setQuestion("");
      setTarget("ideas");
    } catch {
      setMessage(t("polls.sheet.failed"));
    } finally {
      setBusy(false);
    }
  }

  const choice = (key: string, icon: LucideIcon, title: string, hint: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: target === key }}
      onPress={() => setTarget(key)}
      style={[styles.choice, target === key && styles.chosen]}
    >
      <Icon icon={icon} size={18} color={target === key ? colors.route700 : colors.ink500} />
      <View style={{ flex: 1 }}>
        <Text weight="medium" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color={colors.ink500}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t("polls.sheet.title")}>
      <View style={styles.adding}>
        <Text variant="small" color={colors.ink700}>
          {t("polls.sheet.adding")} <Text variant="small" weight="semibold">{label}</Text>
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {choice("ideas", Lightbulb, t("polls.sheet.ideasTitle"), t("polls.sheet.ideasHint"))}
        {openPolls.map((poll) => choice(poll.id, Vote, poll.question, t("polls.sheet.optionsCount", { count: poll.options.length })))}
        {choice("new", Plus, t("polls.sheet.newTitle"), t("polls.sheet.newHint"))}
        {target === "new" && <Field value={question} onChangeText={setQuestion} autoFocus placeholder={t("polls.sheet.questionPlaceholder")} />}
      </View>
      {message ? (
        <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
          {message}
        </Text>
      ) : null}
      <Button
        size="lg"
        busy={busy}
        label={target === "new" ? t("polls.sheet.createAndAdd") : t("polls.sheet.add")}
        onPress={confirm}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  adding: { backgroundColor: colors.chart100, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 12 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  chosen: { borderColor: colors.route500, backgroundColor: colors.route100 },
});
