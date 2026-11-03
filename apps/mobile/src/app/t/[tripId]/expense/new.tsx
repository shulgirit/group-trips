import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { formatDayLabel } from "@together/i18n/format";
import { currencySymbol, tripCurrencies, type Currency } from "@together/shared/currency";
import { todayIso, tripDays } from "@together/shared/trip";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { DEFAULT_SPLIT, shortFamilyName, SplitEditor, splitPayload, splitProblem, type SplitState } from "@/components/expenses/SplitEditor";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Field } from "@/components/ui/Field";
import { Labeled } from "@/components/ui/Label";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";
import { useFamilies, useTrip } from "@/lib/trip";

/** Add an expense (modal): who paid, what, how much, when, and who shares it. */
export default function NewExpense() {
  const t = useT();
  const { locale } = useLocale();
  const { id: tripId, config, me } = useTrip();
  const families = useFamilies();
  const add = useMutation(api.expenses.add);
  const currencies = tripCurrencies(config);
  const today = todayIso();
  const days = tripDays(config);
  const dates = days.includes(today) ? days : [today, ...days];

  const [payer, setPayer] = useState<string>(me.familyId ?? "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(currencies.includes(config.currency) ? config.currency : (currencies[0] ?? config.currency));
  const [date, setDate] = useState(today);
  const [split, setSplit] = useState<SplitState>(DEFAULT_SPLIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const value = Number(amount.replace(",", "."));

  if (!families) return <ActivityIndicator color={colors.ink500} style={{ marginTop: 48 }} />;

  async function save() {
    if (saving || !families) return;
    const problem = splitProblem(families, split);
    const missing = !payer
      ? t("money.add.needPayer")
      : !description.trim()
        ? t("money.add.needDescription")
        : !(value > 0)
          ? t("money.add.needAmount")
          : problem === "pick"
            ? config.group.splitPickLabel
            : problem === "person"
              ? t("money.split.needPerson")
              : null;
    if (missing) {
      setError(missing);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = splitPayload(families, split);
      await add({
        tripId,
        payerFamilyId: payer as Id<"families">,
        description: description.trim(),
        amount: value,
        currency,
        date,
        participantFamilyIds: payload.participantFamilyIds as Id<"families">[] | null,
        ...(payload.participantCounts ? { participantCounts: payload.participantCounts } : {}),
      });
      router.back();
    } catch {
      setError(t("common.errors.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 48 }}>
      <Labeled label={t("money.add.payer")}>
        <ChipRow>
          {families.map((family) => (
            <Chip key={family.id} label={shortFamilyName(family.name)} active={payer === family.id} onPress={() => setPayer(family.id)} />
          ))}
        </ChipRow>
      </Labeled>
      <Labeled label={t("money.add.what")}>
        <Field value={description} onChangeText={setDescription} placeholder={t("money.add.whatPlaceholder")} />
      </Labeled>
      <Labeled label={t("money.add.amount")}>
        <Field value={amount} onChangeText={(text) => setAmount(text.replace(/[^\d.,]/g, ""))} keyboardType="decimal-pad" placeholder="0" large style={{ writingDirection: "ltr", textAlign: "left" }} />
      </Labeled>
      {currencies.length > 1 && (
        <Labeled label={t("money.add.currency")}>
          <View style={styles.currencies}>
            {currencies.map((code) => (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityLabel={code}
                accessibilityState={{ selected: currency === code }}
                onPress={() => setCurrency(code)}
                style={[styles.currency, currency === code && styles.currencyOn]}
              >
                <Text weight="semibold" color={currency === code ? colors.ink900 : colors.ink500} style={{ writingDirection: "ltr" }}>
                  {currencySymbol(code) === code ? code : `${currencySymbol(code)} ${code}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </Labeled>
      )}
      <Labeled label={t("money.add.date")}>
        <ChipRow scroll>
          {dates.map((d) => (
            <Chip key={d} label={`${formatDayLabel(d, locale)}${d === today ? ` · ${t("common.today")}` : ""}`} active={date === d} onPress={() => setDate(d)} />
          ))}
        </ChipRow>
      </Labeled>
      <SplitEditor families={families} split={split} onChange={setSplit} amount={value > 0 ? value : undefined} currency={currency} />
      {error ? (
        <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
          {error}
        </Text>
      ) : null}
      <Button size="lg" busy={saving} label={saving ? t("common.saving") : t("money.add.save")} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  currencies: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  currency: { minHeight: 42, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, backgroundColor: colors.chart50 },
  currencyOn: { backgroundColor: colors.paper, borderColor: colors.ink900 },
});
