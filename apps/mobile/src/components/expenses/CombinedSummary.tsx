import { api } from "@together/backend/api";
import { currencySymbol } from "@together/shared/currency";
import { formatRate, isUsableRate, mainCurrencyOf, rateSource, rateToMain } from "@together/shared/currency-convert";
import { calcCombinedBalances, calcSettlement } from "@together/shared/settlement";
import { todayIso } from "@together/shared/trip";
import { colors } from "@together/shared/tokens";
import type { Expense, Family } from "@together/shared/types";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, RotateCcw } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { formatAmount } from "@/components/expenses/format";
import { shortFamilyName } from "@/components/expenses/SplitEditor";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { fontFor } from "@/lib/fonts";
import { useLocale, useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

const LIGHT = "rgba(241,243,239,0.75)";
const STALE_MS = 12 * 60 * 60 * 1000;

const nameOf = (families: Family[], id: string) => {
  const name = families.find((f) => f.id === id)?.name;
  return name ? shortFamilyName(name) : id;
};

/**
 * "Settle up in {main currency}": every currency used is converted with the live market rate
 * (organizers can edit a rate; it is saved on the trip for everyone), then one combined balance
 * per family and one list of final transfers. Display only — nothing is recorded.
 */
export function CombinedSummary({ expenses, families }: { expenses: Expense[]; families: Family[] }) {
  const t = useT();
  const { locale } = useLocale();
  const { id: tripId, config, isAdmin } = useTrip();
  const setOverride = useMutation(api.trips.setRateOverride);
  const latest = useQuery(api.rates.latest);
  const ensureFresh = useAction(api.rates.ensureFresh);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [settling, setSettling] = useState(false);
  const settleAll = useMutation(api.expenses.settleAll);

  const main = mainCurrencyOf(config);
  const overrides = config.rateOverrides;
  const foreign = useMemo(() => [...new Set(expenses.map((e) => e.currency))].filter((code) => code !== main), [expenses, main]);

  // Market rates are refreshed daily on the server; ask once when the cache is missing or old
  useEffect(() => {
    if (latest !== null && (latest === undefined || Date.now() - latest.updatedAt < STALE_MS)) return;
    ensureFresh().catch(() => setRefreshFailed(true));
  }, [latest, ensureFresh]);

  const rates = useMemo(() => {
    const out: Record<string, number> = { [main]: 1 };
    for (const code of foreign) out[code] = rateToMain(code, main, latest?.ilsPer, overrides);
    return out;
  }, [foreign, main, latest, overrides]);
  const ready = foreign.length > 0 && foreign.every((code) => rates[code] > 0);

  const combined = useMemo(() => {
    if (!ready) return null;
    const balances = calcCombinedBalances(expenses, families, rates);
    return { balances, transfers: calcSettlement(balances) };
  }, [ready, expenses, families, rates]);

  if (!foreign.length) return null;

  async function commit(code: string) {
    const text = typed[code];
    if (text === undefined) return;
    setTyped(({ [code]: _dropped, ...rest }) => rest);
    const value = Number(text.replace(",", "."));
    if (!isUsableRate(value)) return;
    if (Math.abs(value - rates[code]) < 1e-9) return;
    setError("");
    await setOverride({ tripId, code, rate: value }).catch(() => setError(t("common.errors.saveFailed")));
  }

  function confirmSettleAll() {
    Alert.alert(t("money.main.markAllTitle"), t("money.main.markAllText"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("money.main.markAll"),
        onPress: async () => {
          setSettling(true);
          setError("");
          try {
            await settleAll({ tripId, date: todayIso() });
          } catch {
            setError(t("money.main.failed"));
          } finally {
            setSettling(false);
          }
        },
      },
    ]);
  }

  async function reset(code: string) {
    setError("");
    setTyped(({ [code]: _dropped, ...rest }) => rest);
    await setOverride({ tripId, code, rate: null }).catch(() => setError(t("common.errors.saveFailed")));
  }

  const updated =
    latest &&
    new Date(latest.updatedAt).toLocaleDateString(locale === "he" ? "he-IL" : locale === "ar" ? "ar-u-nu-latn" : locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "numeric" });

  return (
    <View style={styles.card}>
      <Text variant="title" color={colors.chart50}>
        {t("money.main.title", { currency: `${currencySymbol(main)} ${main}` })}
      </Text>
      <Text variant="small" color={LIGHT}>
        {t("money.main.sub", { currency: main })}
      </Text>

      <View style={styles.rates}>
        {foreign.map((code) => {
          const source = rateSource(code, main, overrides);
          const value = typed[code] ?? formatRate(rates[code]);
          return (
            <View key={code} style={styles.rateRow}>
              <Text color={colors.chart50} style={{ writingDirection: "ltr" }}>
                {currencySymbol(code) === code ? code : currencySymbol(code)}1 =
              </Text>
              {isAdmin ? (
                <TextInput
                  value={value}
                  onChangeText={(text) => setTyped((all) => ({ ...all, [code]: text.replace(/[^\d.,]/g, "") }))}
                  onBlur={() => commit(code)}
                  onSubmitEditing={() => commit(code)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(241,243,239,0.4)"
                  accessibilityLabel={t("money.main.rate", { currency: code, main })}
                  style={[styles.input, { fontFamily: fontFor(locale, "regular") }]}
                />
              ) : (
                <Text weight="semibold" color={colors.chart50} style={{ writingDirection: "ltr", minWidth: 60, textAlign: "center" }}>
                  {value || "—"}
                </Text>
              )}
              <Text color={colors.chart50} style={{ writingDirection: "ltr" }}>
                {currencySymbol(main) === main ? main : currencySymbol(main)}
              </Text>
              <View style={[styles.badge, source === "edited" && styles.badgeEdited]}>
                <Text variant="caption" weight="medium" color={source === "edited" ? colors.night950 : LIGHT}>
                  {source === "edited" ? t("money.main.edited") : t("money.main.market")}
                </Text>
              </View>
              {isAdmin && typed[code] !== undefined ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t("common.save")} onPress={() => commit(code)} hitSlop={10} style={styles.save}>
                  <Icon icon={Check} size={16} color={colors.night950} />
                </Pressable>
              ) : isAdmin && source === "edited" ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t("money.main.reset")} onPress={() => reset(code)} hitSlop={10}>
                  <Icon icon={RotateCcw} size={16} color={colors.brass300} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text variant="caption" color={LIGHT}>
        {refreshFailed && !latest
          ? t("money.main.unavailable")
          : latest
            ? `${t("money.main.marketLine", { date: updated ?? "" })}${isAdmin ? "" : ` · ${t("money.main.editHint")}`}`
            : t("money.main.loading")}
      </Text>
      {error ? (
        <Text variant="small" color={colors.terra100}>
          {error}
        </Text>
      ) : null}

      {combined ? (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6, display: combined.balances.some((balance) => Math.abs(balance.balance) >= 0.5) ? "flex" : "none" }}>
            <Text variant="caption" color={colors.brass300}>
              {t("money.main.balances")}
            </Text>
            {combined.balances
              .filter((balance) => Math.abs(balance.balance) >= 0.5)
              .map((balance) => (
                <View key={balance.familyId} style={styles.line}>
                  <Text variant="small" color={colors.chart50} style={{ flex: 1 }}>
                    {nameOf(families, balance.familyId)}
                  </Text>
                  {balance.balance >= 0 ? (
                    <Text variant="small" color={colors.brass300}>
                      {t("money.owed")} {formatAmount(balance.balance, main)}
                    </Text>
                  ) : (
                    <Text variant="small" color={colors.terra100}>
                      {t("money.owes")} {formatAmount(-balance.balance, main)}
                    </Text>
                  )}
                </View>
              ))}
          </View>
          {combined.transfers.length > 0 && (
            <View style={styles.transfers}>
              <Text variant="caption" color={colors.brass300}>
                {t("money.main.transfers")}
              </Text>
              {combined.transfers.map((transfer, i) => (
                <View key={`${transfer.fromFamilyId}-${transfer.toFamilyId}-${i}`} style={styles.line}>
                  <View style={[styles.inline, { flex: 1 }]}>
                    <Text variant="small" color={colors.chart50}>
                      {nameOf(families, transfer.fromFamilyId)}
                    </Text>
                    <Icon icon={ArrowRight} size={14} color={colors.chart50} flip />
                    <Text variant="small" color={colors.chart50}>
                      {nameOf(families, transfer.toFamilyId)}
                    </Text>
                  </View>
                  <Text variant="small" weight="semibold" color={colors.chart50}>
                    {formatAmount(transfer.amount, main)}
                  </Text>
                </View>
              ))}
              <Pressable accessibilityRole="button" disabled={settling} onPress={confirmSettleAll} style={[styles.markAll, settling && { opacity: 0.6 }]}>
                <Icon icon={Check} size={16} color={colors.night950} />
                <Text weight="medium" color={colors.night950}>
                  {settling ? t("money.main.marking") : t("money.main.markAll")}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <Text variant="small" color={LIGHT}>
          {t("money.main.enterRate", { currency: main })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.night950, borderRadius: 28, padding: 20, gap: 14 },
  rates: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 14 },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  input: {
    minWidth: 78,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: colors.chart50,
    textAlign: "center",
    fontSize: 16,
    paddingHorizontal: 10,
    writingDirection: "ltr",
  },
  markAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, marginTop: 6, borderRadius: 14, backgroundColor: colors.chart50 },
  save: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brass300, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)" },
  badgeEdited: { backgroundColor: colors.brass300 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  transfers: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 12 },
});
