import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { formatDayLabel, formatShortDate } from "@together/i18n/format";
import { currencyLabel, currencyParen, type Currency } from "@together/shared/currency";
import { calcBalances, calcSettlement } from "@together/shared/settlement";
import { todayIso } from "@together/shared/trip";
import type { Expense, Family } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { type Href, router } from "expo-router";
import { ArrowRight, Check, Plus, Trash2, Users, Wallet } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { EditSplitSheet } from "@/components/expenses/EditSplitSheet";
import { formatAmount } from "@/components/expenses/format";
import { shortFamilyName } from "@/components/expenses/SplitEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";
import { useExpenses, useFamilies, useTrip } from "@/lib/trip";

const LIGHT = "rgba(241,243,239,0.75)";

function familyName(families: Family[], id: string) {
  const name = families.find((f) => f.id === id)?.name;
  return name ? shortFamilyName(name) : id;
}

/** Shared expenses: totals and balances per currency, settle-up, and the list by day. */
export default function Expenses() {
  const t = useT();
  const { locale } = useLocale();
  const { id: tripId, config } = useTrip();
  const expenses = useExpenses();
  const families = useFamilies();
  const remove = useMutation(api.expenses.remove);
  const recordSettlement = useMutation(api.expenses.recordSettlement);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [settleError, setSettleError] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const add = () => router.push(`/t/${tripId}/expense/new` as Href);

  // Money paid back moves balances but isn't spending
  const spending = useMemo(() => (expenses ?? []).filter((e) => e.kind !== "settlement"), [expenses]);
  const settlements = useMemo(
    () => (expenses ?? []).filter((e) => e.kind === "settlement").sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [expenses]
  );
  const summaries = useMemo(() => {
    if (!expenses || !families) return [];
    const count = (c: string) => spending.filter((e) => e.currency === c).length;
    const used = [...new Set(spending.map((e) => e.currency))].sort((a, b) => count(b) - count(a));
    return used.map((currency) => {
      const balances = calcBalances(expenses, families, currency);
      const spent = calcBalances(spending, families, currency);
      return {
        currency: currency as Currency,
        total: spending.filter((e) => e.currency === currency).reduce((sum, e) => sum + e.amount, 0),
        balances: balances.map((b) => ({ ...b, paid: spent.find((s) => s.familyId === b.familyId)?.paid ?? 0 })),
        transfers: calcSettlement(balances),
      };
    });
  }, [expenses, families, spending]);
  const openTransfers = summaries.reduce((sum, s) => sum + s.transfers.length, 0);
  const settleTime = todayIso() >= config.endDate;
  const dates = useMemo(() => [...new Set(spending.map((e) => e.date))], [spending]);
  const visible = dateFilter === "all" ? spending : spending.filter((e) => e.date === dateFilter);

  async function markPaid(currency: Currency, transfer: { fromFamilyId: string; toFamilyId: string; amount: number }, key: string) {
    setMarking(key);
    setSettleError("");
    try {
      await recordSettlement({
        tripId,
        fromFamilyId: transfer.fromFamilyId as Id<"families">,
        toFamilyId: transfer.toFamilyId as Id<"families">,
        amount: transfer.amount,
        currency,
        date: todayIso(),
      });
    } catch {
      setSettleError(t("money.settle.failed"));
    } finally {
      setMarking(null);
    }
  }

  function confirmDelete(expense: Expense) {
    Alert.alert(t("common.delete"), expense.description, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("money.confirmDelete"), style: "destructive", onPress: () => remove({ tripId, expenseId: expense.id as Id<"expenses"> }).catch(() => undefined) },
    ]);
  }

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 48 }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="small" color={colors.ink500}>
            {t("money.kicker")}
          </Text>
          <Text variant="display">{t("money.title")}</Text>
        </View>
        <Button tone="brass" icon={Plus} label={t("money.addShort")} onPress={add} />
      </View>

      {expenses === undefined || !families ? (
        <ActivityIndicator color={colors.ink500} style={{ marginTop: 32 }} />
      ) : spending.length === 0 ? (
        <Card style={styles.empty}>
          <Icon icon={Wallet} size={28} color={colors.ink400} />
          <Text variant="headline" weight="medium" align="center">
            {t("money.emptyTitle")}
          </Text>
          <Text variant="small" color={colors.ink500} align="center">
            {t("money.emptyDescription")}
          </Text>
          <Button icon={Plus} label={t("money.firstExpense")} onPress={add} />
        </Card>
      ) : (
        <>
          {openTransfers > 0 && settleTime && (
            <View style={styles.nudge}>
              <View style={styles.nudgeDot} />
              <View style={{ flex: 1 }}>
                <Text weight="medium">{t("money.settle.timeTitle")}</Text>
                <Text variant="small" color={colors.ink700}>
                  {openTransfers === 1 ? t("money.settle.timeTextOne") : t("money.settle.timeText", { count: openTransfers })}
                </Text>
              </View>
            </View>
          )}
          {openTransfers === 0 && settlements.length > 0 && (
            <View style={styles.settled}>
              <Icon icon={Check} size={18} color={colors.route700} />
              <Text variant="small" weight="medium" color={colors.route700}>
                {t("money.settle.allSettled")}
              </Text>
            </View>
          )}

          {/* Totals and balances per currency */}
          <View style={styles.summary}>
            <Text variant="small" color={LIGHT}>
              {t("money.totalShared")}
            </Text>
            <Text variant="display" color={colors.chart50} style={{ writingDirection: "ltr" }}>
              {summaries.map((s) => formatAmount(s.total, s.currency)).join(" + ")}
            </Text>
            {summaries.map((summary) => (
              <View key={summary.currency} style={{ gap: 4 }}>
                {summaries.length > 1 && (
                  <Text variant="caption" color={colors.brass300}>
                    {currencyLabel(summary.currency)}
                  </Text>
                )}
                {summary.balances.map((balance) => {
                  const even = Math.abs(balance.balance) < 0.005;
                  return (
                    <View key={balance.familyId} style={styles.balanceRow}>
                      <Text variant="small" color={colors.chart50} style={{ flex: 1 }}>
                        {familyName(families, balance.familyId)}
                      </Text>
                      <Text variant="small" color={LIGHT}>
                        {t("money.paid")} {formatAmount(balance.paid, summary.currency)}
                        {even ? "" : " · "}
                        {even ? null : balance.balance >= 0 ? (
                          <Text variant="small" color={colors.brass300}>
                            {t("money.owed")} {formatAmount(balance.balance, summary.currency)}
                          </Text>
                        ) : (
                          <Text variant="small" color={colors.terra100}>
                            {t("money.owes")} {formatAmount(-balance.balance, summary.currency)}
                          </Text>
                        )}
                      </Text>
                    </View>
                  );
                })}
                {summary.transfers.length > 0 && (
                  <View style={styles.transfers}>
                    <Text variant="caption" color={colors.brass300}>
                      {t("money.settleUp")}
                      {summaries.length > 1 ? ` ${currencyParen(summary.currency)}` : ""}
                    </Text>
                    {summary.transfers.map((transfer) => {
                      const key = `${summary.currency}-${transfer.fromFamilyId}-${transfer.toFamilyId}`;
                      return (
                        <View key={key} style={{ gap: 8, paddingVertical: 6 }}>
                          <View style={styles.balanceRow}>
                            <View style={[styles.inline, { flex: 1 }]}>
                              <Text variant="small" color={colors.chart50}>
                                {familyName(families, transfer.fromFamilyId)}
                              </Text>
                              <Icon icon={ArrowRight} size={14} color={colors.chart50} flip />
                              <Text variant="small" color={colors.chart50}>
                                {familyName(families, transfer.toFamilyId)}
                              </Text>
                            </View>
                            <Text variant="small" weight="medium" color={colors.chart50}>
                              {formatAmount(transfer.amount, summary.currency)}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            disabled={marking !== null}
                            onPress={() => markPaid(summary.currency, transfer, key)}
                            style={[styles.markPaid, marking !== null && { opacity: 0.6 }]}
                          >
                            <Icon icon={Check} size={15} color={colors.night950} />
                            <Text variant="small" weight="medium" color={colors.night950}>
                              {marking === key ? t("money.settle.marking") : t("money.settle.markPaid")}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                    {settleError ? (
                      <Text variant="small" color={colors.terra100}>
                        {settleError}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Repayments, never mixed into the expense rows */}
          {settlements.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text variant="small" weight="medium" color={colors.ink500}>
                {t("money.settle.settledTitle")}
              </Text>
              <Card>
                {settlements.map((s, i) => (
                  <View key={s.id} style={[styles.settlementRow, i > 0 && styles.divider]}>
                    <View style={styles.checkDot}>
                      <Icon icon={Check} size={15} color={colors.route700} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="small">
                        {t("money.settle.line", { from: familyName(families, s.payerFamilyId), to: familyName(families, s.participantFamilyIds?.[0] ?? "") })}
                      </Text>
                      <Text variant="caption" color={colors.ink500}>
                        {formatShortDate(s.date)}
                        {s.settledByName ? ` · ${t("money.settle.by", { name: s.settledByName })}` : ""}
                      </Text>
                    </View>
                    <Text variant="small" weight="medium">
                      {formatAmount(s.amount, s.currency)}
                    </Text>
                    <Pressable accessibilityRole="button" onPress={() => remove({ tripId, expenseId: s.id as Id<"expenses"> }).catch(() => undefined)} hitSlop={6}>
                      <Text variant="caption" weight="medium" color={colors.ink500}>
                        {t("money.settle.undo")}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {dates.length > 1 && (
            <ChipRow scroll>
              <Chip label={t("common.all")} active={dateFilter === "all"} onPress={() => setDateFilter("all")} />
              {dates.map((date) => (
                <Chip key={date} label={formatDayLabel(date, locale)} active={dateFilter === date} onPress={() => setDateFilter(date)} />
              ))}
            </ChipRow>
          )}

          <View style={{ gap: 8 }}>
            {visible.map((expense, index) => (
              <Fragment key={expense.id}>
                {dateFilter === "all" && (index === 0 || visible[index - 1].date !== expense.date) && (
                  <Text variant="caption" weight="medium" color={colors.ink500} style={{ paddingTop: 8 }}>
                    {formatDayLabel(expense.date, locale)}
                  </Text>
                )}
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text>{expense.description}</Text>
                    <Text variant="small" color={colors.ink500}>
                      {familyName(families, expense.payerFamilyId)} · {formatShortDate(expense.date)}
                      {expense.participantFamilyIds ? ` · ${expense.participantFamilyIds.map((id) => familyName(families, id)).join("+")}` : ""}
                    </Text>
                    {expense.participantCounts && (
                      <View style={styles.inline}>
                        <Icon icon={Users} size={12} color={colors.ink400} />
                        <Text variant="caption" color={colors.ink400} style={{ flex: 1 }}>
                          {t("money.byPeopleList")}{" "}
                          {families
                            .filter((f) => (expense.participantCounts![f.id] ?? 0) > 0)
                            .map((f) => `${shortFamilyName(f.name)} ${expense.participantCounts![f.id]}`)
                            .join(" · ")}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text variant="headline">{formatAmount(expense.amount, expense.currency)}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("money.editSplit.title")} onPress={() => setEditing(expense)} hitSlop={6} style={{ padding: 4 }}>
                    <Icon icon={Users} size={16} color={colors.ink300} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("common.delete")} onPress={() => confirmDelete(expense)} hitSlop={6} style={{ padding: 4 }}>
                    <Icon icon={Trash2} size={16} color={colors.ink300} />
                  </Pressable>
                </View>
              </Fragment>
            ))}
          </View>
        </>
      )}

      {families && editing && <EditSplitSheet key={editing.id} expense={editing} families={families} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  empty: { padding: 24, gap: 10, alignItems: "center" },
  nudge: { flexDirection: "row", gap: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.brass300, backgroundColor: colors.brass100, padding: 14 },
  nudgeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brass500, marginTop: 6 },
  settled: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.card, backgroundColor: colors.route100, padding: 14 },
  summary: { borderRadius: 28, backgroundColor: colors.route700, padding: 22, gap: 16 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  transfers: { borderRadius: radius.card, borderWidth: 1, borderColor: "rgba(241,243,239,0.18)", padding: 14, marginTop: 8, gap: 4 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  markPaid: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: colors.chart50, paddingHorizontal: 14, paddingVertical: 7 },
  settlementRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart200 },
  checkDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.route100, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
