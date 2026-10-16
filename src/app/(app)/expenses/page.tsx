"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Plus, Trash2, Users, Wallet } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { addExpense, deleteExpense, updateExpenseSplit } from "@/lib/db";
import { useExpenses, useFamilies } from "@/lib/hooks";
import { calcBalances, calcSettlement } from "@/lib/settlement";
import { IlsSettlement } from "@/components/expenses/IlsSettlement";
import { todayIso } from "@/lib/trip";
import type { Expense, Family } from "@/types";
import {
  DEFAULT_SPLIT,
  SplitEditor,
  shortFamilyName,
  splitError,
  splitPayload,
  type SplitState,
} from "@/components/expenses/SplitEditor";
import {
  currencyLabel,
  currencyParen,
  currencySymbol,
  tripCurrencies,
  type Currency,
} from "@/lib/currency";
import { useTrip } from "@/components/providers/TripProvider";
import { STROKE } from "@/components/ui/Icon";
import { useDayLabel, useT } from "@/i18n";
import { activeLocale } from "@/i18n/active";
import { formatNumber, formatShortDate } from "@/i18n/format";

function familyName(families: Family[], id: string): string {
  const name = families.find((f) => f.id === id)?.name;
  return name ? shortFamilyName(name) : id;
}

function formatAmount(amount: number, currency: Currency): string {
  return `${currencySymbol(currency)}${formatNumber(amount, activeLocale())}`;
}

function AddExpenseSheet({
  open,
  onClose,
  families,
}: {
  open: boolean;
  onClose: () => void;
  families: Family[];
}) {
  const { profile } = useFirebase();
  const t = useT();
  const [payerFamilyId, setPayerFamilyId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const trip = useTrip();
  const currencies = tripCurrencies(trip);
  const [currency, setCurrency] = useState<Currency>(
    trip.legacy ? "EUR" : trip.currency
  );
  const [date, setDate] = useState(todayIso());
  const [split, setSplit] = useState<SplitState>(DEFAULT_SPLIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Your own family is the usual payer — pre-select it
  useEffect(() => {
    if (profile?.familyId) {
      setPayerFamilyId((current) => current || profile.familyId!);
    }
  }, [profile]);

  function missingField(): string | null {
    if (!payerFamilyId) return t("money.add.needPayer");
    if (!description.trim()) return t("money.add.needDescription");
    if (!(Number(amount) > 0)) return t("money.add.needAmount");
    return splitError(families, split);
  }

  async function handleSave() {
    if (saving) return;
    const missing = missingField();
    if (missing) {
      setError(missing);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addExpense({
        payerFamilyId,
        description,
        amount: Number(amount),
        currency,
        date,
        ...splitPayload(families, split),
      });
      setDescription("");
      setAmount("");
      setSplit(DEFAULT_SPLIT);
      onClose();
    } catch {
      setError(t("common.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("money.add.title")}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm text-ink-700">{t("money.add.payer")}</p>
          <div className="flex flex-wrap gap-2">
            {families.map((family) => (
              <button
                key={family.id}
                type="button"
                onClick={() => setPayerFamilyId(family.id)}
                className={`rounded-2xl border px-4 py-2.5 text-sm transition ${
                  payerFamilyId === family.id
                    ? "border-sea-700 bg-sea-700 text-cream-50"
                    : "border-cream-200 bg-white text-ink-700"
                }`}
              >
                {shortFamilyName(family.name)}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm text-ink-700">
            {t("money.add.what")}
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("money.add.whatPlaceholder")}
            className="field"
          />
        </label>

        <div className="flex gap-3">
          <label className="min-w-0 flex-1">
            <span className="mb-2 block text-sm text-ink-700">
              {t("money.add.amount")}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="field numerals text-lg"
            />
          </label>
          <div>
            <span className="mb-2 block text-sm text-ink-700">
              {t("money.add.currency")}
            </span>
            <div className="no-scrollbar flex max-w-[11rem] gap-1 overflow-x-auto rounded-2xl border border-cream-200 bg-cream-50 p-1">
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  title={c}
                  className={`shrink-0 rounded-xl px-3 py-2 text-lg transition ${
                    currency === c
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-500"
                  }`}
                >
                  {currencySymbol(c)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm text-ink-700">
            {t("money.add.date")}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field"
          />
        </label>

        <SplitEditor
          families={families}
          split={split}
          onChange={setSplit}
          amount={Number(amount) > 0 ? Number(amount) : undefined}
          currency={currency}
        />

        {error && (
          <p role="alert" className="text-sm text-terra-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3.5 text-base"
        >
          {saving ? t("common.saving") : t("money.add.save")}
        </button>
      </div>
    </BottomSheet>
  );
}

function EditSplitSheet({
  expense,
  families,
  onClose,
}: {
  expense: Expense;
  families: Family[];
  onClose: () => void;
}) {
  const [split, setSplit] = useState<SplitState>(() => ({
    everyone: expense.participantFamilyIds === null,
    participantIds: expense.participantFamilyIds ?? [],
    byPeople: Boolean(expense.participantCounts),
    counts: expense.participantCounts ?? {},
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = useT();

  async function handleSave() {
    if (saving) return;
    const invalid = splitError(families, split);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateExpenseSplit(expense.id, splitPayload(families, split));
      onClose();
    } catch {
      setError(t("common.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={t("money.editSplit.title")}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-cream-200 bg-cream-50 px-4 py-3">
          <p className="text-ink-900"><bdi>{expense.description}</bdi></p>
          <p className="text-sm text-ink-500">
            {t("money.paidBy", { name: familyName(families, expense.payerFamilyId) })}{" "}
            <span dir="ltr" className="numerals tabular-nums">
              {formatAmount(expense.amount, expense.currency)}
            </span>
          </p>
        </div>

        <SplitEditor
          families={families}
          split={split}
          onChange={setSplit}
          amount={expense.amount}
          currency={expense.currency}
        />

        {error && (
          <p role="alert" className="text-sm text-terra-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3.5 text-base"
        >
          {saving ? t("common.saving") : t("money.editSplit.save")}
        </button>
      </div>
    </BottomSheet>
  );
}

function ExpensesContent() {
  const searchParams = useSearchParams();
  const { expenses, loading } = useExpenses();
  const { families } = useFamilies();
  const t = useT();
  const dayLabel = useDayLabel();
  const [addOpen, setAddOpen] = useState(searchParams.get("add") === "1");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Full split + settlement for EACH currency that has expenses
  const summaries = useMemo(() => {
    if (!expenses || !families) return [];
    // Every currency that has expenses, most used first
    const used = [...new Set(expenses.map((e) => e.currency))].sort(
      (a, b) =>
        expenses.filter((e) => e.currency === b).length -
        expenses.filter((e) => e.currency === a).length
    );
    return used.map((currency) => {
      const list = expenses.filter((e) => e.currency === currency);
      if (!list.length) return null;
      const balances = calcBalances(expenses, families, currency);
      return {
        currency,
        total: list.reduce((sum, e) => sum + e.amount, 0),
        balances,
        transfers: calcSettlement(balances),
      };
    }).filter(Boolean) as {
      currency: Currency;
      total: number;
      balances: ReturnType<typeof calcBalances>;
      transfers: ReturnType<typeof calcSettlement>;
    }[];
  }, [expenses, families]);

  // Date tabs for the list
  const [dateFilter, setDateFilter] = useState<string>("all");
  const expenseDates = useMemo(
    () => [...new Set((expenses ?? []).map((e) => e.date))],
    [expenses]
  );
  const visibleExpenses = useMemo(
    () =>
      dateFilter === "all"
        ? (expenses ?? [])
        : (expenses ?? []).filter((e) => e.date === dateFilter),
    [expenses, dateFilter]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="kicker text-ink-500">{t("money.kicker")}</p>
          <h1 className="font-display text-3xl font-light tracking-tight text-ink-900">
            {t("money.title")}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="btn-accent gap-1.5 px-4 py-2.5 text-sm"
        >
          <Plus size={16} strokeWidth={STROKE} aria-hidden />
          {t("money.addShort")}
        </button>
      </div>

      {loading || !families ? (
        <ListSkeleton rows={3} />
      ) : !expenses?.length ? (
        <EmptyState
          icon={Wallet}
          title={t("money.emptyTitle")}
          description={t("money.emptyDescription")}
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="btn-primary gap-1.5 px-5 py-2.5 text-sm"
            >
              <Plus size={16} strokeWidth={STROKE} aria-hidden />
              {t("money.firstExpense")}
            </button>
          }
        />
      ) : (
        <>
          {/* Summary — full split per currency */}
          {summaries.length > 0 && (
            <section className="rounded-[1.75rem] bg-sea-800 p-6 text-white shadow-[var(--shadow-card)]">
              <p className="kicker text-sea-100">{t("money.totalShared")}</p>
              <p className="numerals mt-2 font-display text-4xl font-light tabular-nums">
                {summaries.map((s, i) => (
                  <Fragment key={s.currency}>
                    {i > 0 && <span className="mx-2 text-sea-200">+</span>}
                    <bdi dir="ltr">{formatAmount(s.total, s.currency)}</bdi>
                  </Fragment>
                ))}
              </p>

              {summaries.map((summary) => (
                <div key={summary.currency} className="mt-5">
                  {summaries.length > 1 && (
                    <p className="kicker mb-2 text-lemon-200">
                      {currencyLabel(summary.currency)}
                    </p>
                  )}
                  <div className="divide-y divide-white/10">
                    {summary.balances.map((balance) => (
                      <div
                        key={balance.familyId}
                        className="flex items-center justify-between py-1.5 text-sm"
                      >
                        <span>{familyName(families, balance.familyId)}</span>
                        <span className="text-sea-100">
                          {t("money.paid")}{" "}
                          <bdi dir="ltr" className="numerals tabular-nums">
                            {formatAmount(balance.paid, summary.currency)}
                          </bdi>
                          {" · "}
                          {balance.balance >= 0 ? (
                            <span className="text-lemon-200">
                              {t("money.owed")}{" "}
                              <bdi dir="ltr" className="numerals tabular-nums">
                                {formatAmount(balance.balance, summary.currency)}
                              </bdi>
                            </span>
                          ) : (
                            <span className="text-terra-100">
                              {t("money.owes")}{" "}
                              <bdi dir="ltr" className="numerals tabular-nums">
                                {formatAmount(-balance.balance, summary.currency)}
                              </bdi>
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {summary.transfers.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-white/15 p-4">
                      <p className="kicker mb-2 text-lemon-200">
                        {t("money.settleUp")}
                        {summaries.length > 1
                          ? ` ${currencyParen(summary.currency)}`
                          : ""}
                      </p>
                      {summary.transfers.map((transfer, i) => (
                        <p
                          key={i}
                          className="flex items-center justify-between py-0.5 text-sm"
                        >
                          <span className="flex items-center gap-1.5">
                            {familyName(families, transfer.fromFamilyId)}
                            <ArrowRight
                              size={14}
                              strokeWidth={STROKE}
                              aria-label={t("money.pays")}
                              className="rtl:rotate-180"
                            />
                            {familyName(families, transfer.toFamilyId)}
                          </span>
                          <b dir="ltr" className="numerals font-medium tabular-nums">
                            {formatAmount(transfer.amount, summary.currency)}
                          </b>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <IlsSettlement expenses={expenses ?? []} families={families} />
            </section>
          )}

          {/* Date tabs */}
          {expenseDates.length > 1 && (
            <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
              <div className="flex w-max gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => setDateFilter("all")}
                  className={`chip ${dateFilter === "all" ? "chip-active" : ""}`}
                >
                  {t("common.all")}
                </button>
                {expenseDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setDateFilter(date)}
                    className={`chip ${dateFilter === date ? "chip-active" : ""}`}
                  >
                    {dayLabel(date)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expense list, grouped by day */}
          <ul className="space-y-2">
            {visibleExpenses.map((expense, index) => (
              <Fragment key={expense.id}>
                {dateFilter === "all" &&
                  (index === 0 ||
                    visibleExpenses[index - 1].date !== expense.date) && (
                    <li className="kicker pb-1 pt-3 text-ink-500">
                      {dayLabel(expense.date)}
                    </li>
                  )}
              <li
                className="flex items-center gap-3 rounded-3xl border border-cream-200 bg-white px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-ink-900">
                    <bdi>{expense.description}</bdi>
                  </p>
                  <p className="text-sm text-ink-500">
                    {familyName(families, expense.payerFamilyId)} ·{" "}
                    {formatShortDate(expense.date)}
                    {expense.participantFamilyIds
                      ? ` · ${expense.participantFamilyIds
                          .map((id) => familyName(families, id))
                          .join("+")}`
                      : ""}
                  </p>
                  {expense.participantCounts && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400">
                      <Users size={12} strokeWidth={STROKE} aria-hidden />
                      {t("money.byPeopleList")}{" "}
                      {families
                        .filter(
                          (f) => (expense.participantCounts![f.id] ?? 0) > 0
                        )
                        .map(
                          (f) =>
                            `${shortFamilyName(f.name)} ${
                              expense.participantCounts![f.id]
                            }`
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <p dir="ltr" className="numerals text-lg tabular-nums text-ink-900">
                  {formatAmount(expense.amount, expense.currency)}
                </p>
                <button
                  type="button"
                  onClick={() => setEditingExpense(expense)}
                  aria-label={t("money.editSplit.title")}
                  className="p-1 text-ink-300"
                >
                  <Users size={16} strokeWidth={STROKE} aria-hidden />
                </button>
                {deletingId === expense.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteExpense(expense.id);
                      setDeletingId(null);
                    }}
                    className="rounded-xl bg-terra-600 px-2.5 py-2 text-xs text-cream-50"
                  >
                    {t("money.confirmDelete")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeletingId(expense.id)}
                    aria-label={t("common.delete")}
                    className="p-1 text-ink-300"
                  >
                    <Trash2 size={16} strokeWidth={STROKE} aria-hidden />
                  </button>
                )}
              </li>
              </Fragment>
            ))}
          </ul>
        </>
      )}

      {families && (
        <AddExpenseSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          families={families}
        />
      )}
      {families && editingExpense && (
        <EditSplitSheet
          key={editingExpense.id}
          expense={editingExpense}
          families={families}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesContent />
    </Suspense>
  );
}
