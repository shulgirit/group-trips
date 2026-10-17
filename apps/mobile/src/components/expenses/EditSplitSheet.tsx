import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import type { Expense, Family } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { useState } from "react";
import { View } from "react-native";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";
import { formatAmount } from "./format";
import { shortFamilyName, SplitEditor, splitPayload, splitProblem, type SplitState } from "./SplitEditor";

/** Changes only who shares an expense — never amount or payer. */
export function EditSplitSheet({ expense, families, onClose }: { expense: Expense; families: Family[]; onClose: () => void }) {
  const t = useT();
  const { id: tripId, config } = useTrip();
  const update = useMutation(api.expenses.updateSplit);
  const [split, setSplit] = useState<SplitState>(() => ({
    everyone: expense.participantFamilyIds === null,
    participantIds: expense.participantFamilyIds ?? [],
    byPeople: Boolean(expense.participantCounts),
    counts: expense.participantCounts ?? {},
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const payer = families.find((f) => f.id === expense.payerFamilyId);

  async function save() {
    if (saving) return;
    const problem = splitProblem(families, split);
    if (problem) {
      setError(problem === "pick" ? config.group.splitPickLabel : t("money.split.needPerson"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = splitPayload(families, split);
      await update({
        tripId,
        expenseId: expense.id as Id<"expenses">,
        participantFamilyIds: payload.participantFamilyIds as Id<"families">[] | null,
        ...(payload.participantCounts ? { participantCounts: payload.participantCounts } : {}),
      });
      onClose();
    } catch {
      setError(t("common.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={t("money.editSplit.title")}>
      <View style={{ borderRadius: radius.card, backgroundColor: colors.paper, padding: 14, gap: 2 }}>
        <Text>{expense.description}</Text>
        <Text variant="small" color={colors.ink500}>
          {t("money.paidBy", { name: payer ? shortFamilyName(payer.name) : "" })} {formatAmount(expense.amount, expense.currency)}
        </Text>
      </View>
      <SplitEditor families={families} split={split} onChange={setSplit} amount={expense.amount} currency={expense.currency} />
      {error ? (
        <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
          {error}
        </Text>
      ) : null}
      <Button size="lg" busy={saving} label={saving ? t("common.saving") : t("money.editSplit.save")} onPress={save} />
    </Sheet>
  );
}
