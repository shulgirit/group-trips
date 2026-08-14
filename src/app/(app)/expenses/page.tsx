"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { addExpense, deleteExpense } from "@/lib/db";
import { useExpenses, useFamilies } from "@/lib/hooks";
import { calcBalances, calcSettlement } from "@/lib/settlement";
import { todayIso } from "@/lib/trip";
import type { Family } from "@/types";

const CURRENCY_SYMBOL = { EUR: "€", ILS: "₪" } as const;

function familyName(families: Family[], id: string): string {
  return families.find((f) => f.id === id)?.name.replace("משפחת ", "") ?? id;
}

function formatAmount(amount: number, currency: "EUR" | "ILS"): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString("he-IL", {
    maximumFractionDigits: 0,
  })}`;
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
  const [payerFamilyId, setPayerFamilyId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "ILS">("EUR");
  const [date, setDate] = useState(todayIso());
  const [everyone, setEveryone] = useState(true);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valid =
    payerFamilyId &&
    description.trim() &&
    Number(amount) > 0 &&
    (everyone || participantIds.length > 0);

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await addExpense({
        payerFamilyId,
        description,
        amount: Number(amount),
        currency,
        date,
        participantFamilyIds: everyone ? null : participantIds,
      });
      setDescription("");
      setAmount("");
      setEveryone(true);
      setParticipantIds([]);
      onClose();
    } catch {
      setError("השמירה נכשלה, נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="הוצאה חדשה 💶">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">מי שילם?</p>
          <div className="flex flex-wrap gap-2">
            {families.map((family) => (
              <button
                key={family.id}
                type="button"
                onClick={() => setPayerFamilyId(family.id)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                  payerFamilyId === family.id
                    ? "bg-sea-600 text-cream-50"
                    : "bg-cream-100 text-ink-700"
                }`}
              >
                {family.name.replace("משפחת ", "")}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-700">
            על מה?
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="למשל: סופר, מסעדה, דלק…"
            className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-ink-700">
              סכום
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-lg font-semibold text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
            />
          </label>
          <div>
            <span className="mb-2 block text-sm font-medium text-ink-700">
              מטבע
            </span>
            <div className="flex gap-1 rounded-2xl bg-cream-100 p-1">
              {(["EUR", "ILS"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`rounded-xl px-4 py-2 text-lg font-semibold transition ${
                    currency === c ? "bg-white shadow-sm" : "text-ink-500"
                  }`}
                >
                  {CURRENCY_SYMBOL[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-700">
            תאריך
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3 text-ink-900 outline-none focus:border-sea-500"
          />
        </label>

        <div>
          <button
            type="button"
            onClick={() => setEveryone(!everyone)}
            className="flex items-center gap-2 text-sm font-medium text-ink-700"
          >
            <span
              aria-hidden
              className={`flex h-6 w-6 items-center justify-center rounded-lg border text-sm ${
                everyone
                  ? "border-sea-600 bg-sea-600 text-cream-50"
                  : "border-cream-300 bg-white"
              }`}
            >
              {everyone ? "✓" : ""}
            </span>
            כולם השתתפו (חלוקה שווה בין 4 המשפחות)
          </button>
          {!everyone && (
            <div className="mt-3 flex flex-wrap gap-2">
              {families.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  onClick={() =>
                    setParticipantIds((current) =>
                      current.includes(family.id)
                        ? current.filter((id) => id !== family.id)
                        : [...current, family.id]
                    )
                  }
                  className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                    participantIds.includes(family.id)
                      ? "bg-terra-500 text-cream-50"
                      : "bg-cream-100 text-ink-700"
                  }`}
                >
                  {family.name.replace("משפחת ", "")}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-terra-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!valid || saving}
          className="w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "שומר…" : "שמור הוצאה"}
        </button>
      </div>
    </BottomSheet>
  );
}

function ExpensesContent() {
  const searchParams = useSearchParams();
  const { expenses, loading } = useExpenses();
  const { families } = useFamilies();
  const [addOpen, setAddOpen] = useState(searchParams.get("add") === "1");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const eurSummary = useMemo(() => {
    if (!expenses || !families) return null;
    const balances = calcBalances(expenses, families, "EUR");
    const total = expenses
      .filter((e) => e.currency === "EUR")
      .reduce((sum, e) => sum + e.amount, 0);
    return { balances, total, transfers: calcSettlement(balances) };
  }, [expenses, families]);

  const ilsTotal = useMemo(
    () =>
      (expenses ?? [])
        .filter((e) => e.currency === "ILS")
        .reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-900">הוצאות</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-2xl bg-terra-500 px-4 py-2.5 text-sm font-semibold text-cream-50 transition active:scale-[0.98]"
        >
          + הוצאה
        </button>
      </div>

      {loading || !families ? (
        <ListSkeleton rows={3} />
      ) : !expenses?.length ? (
        <EmptyState
          emoji="💶"
          title="עוד אין הוצאות"
          description="כל הוצאה משותפת שנרשום כאן תתחלק אוטומטית, ובסוף נדע בדיוק מי חייב למי"
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
            >
              + הוצאה ראשונה
            </button>
          }
        />
      ) : (
        <>
          {/* Summary */}
          {eurSummary && eurSummary.total > 0 && (
            <section className="rounded-3xl bg-gradient-to-b from-sea-600 to-sea-700 p-5 text-cream-50">
              <p className="text-sm text-sea-200">סה״כ הוצאות משותפות</p>
              <p className="mt-1 text-3xl font-bold">
                {formatAmount(eurSummary.total, "EUR")}
                {ilsTotal > 0 && (
                  <span className="ms-2 text-lg font-semibold text-sea-200">
                    + {formatAmount(ilsTotal, "ILS")}
                  </span>
                )}
              </p>
              <div className="mt-4 space-y-1.5">
                {eurSummary.balances.map((balance) => (
                  <div
                    key={balance.familyId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{familyName(families, balance.familyId)}</span>
                    <span className="tabular-nums">
                      שילמו {formatAmount(balance.paid, "EUR")} ·{" "}
                      {balance.balance >= 0 ? (
                        <span className="text-lemon-300">
                          מגיע {formatAmount(balance.balance, "EUR")}
                        </span>
                      ) : (
                        <span className="text-terra-400">
                          חייבים {formatAmount(-balance.balance, "EUR")}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {eurSummary.transfers.length > 0 && (
                <div className="mt-4 rounded-2xl bg-sea-900/40 p-3">
                  <p className="mb-2 text-sm font-semibold">
                    כדי לסגור חשבון:
                  </p>
                  {eurSummary.transfers.map((transfer, i) => (
                    <p key={i} className="text-sm tabular-nums">
                      {familyName(families, transfer.fromFamilyId)} ←{" "}
                      {familyName(families, transfer.toFamilyId)}{" "}
                      <b>{formatAmount(transfer.amount, "EUR")}</b>
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Expense list */}
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center gap-3 rounded-3xl border border-cream-200 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">
                    {expense.description}
                  </p>
                  <p className="text-sm text-ink-500">
                    {familyName(families, expense.payerFamilyId)} ·{" "}
                    {expense.date.slice(8, 10)}.{expense.date.slice(5, 7)}
                    {expense.participantFamilyIds
                      ? ` · ${expense.participantFamilyIds
                          .map((id) => familyName(families, id))
                          .join("+")}`
                      : ""}
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums text-ink-900">
                  {formatAmount(expense.amount, expense.currency)}
                </p>
                {deletingId === expense.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteExpense(expense.id);
                      setDeletingId(null);
                    }}
                    className="rounded-xl bg-terra-600 px-2.5 py-2 text-xs font-semibold text-cream-50"
                  >
                    למחוק
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeletingId(expense.id)}
                    aria-label="מחיקה"
                    className="text-ink-300"
                  >
                    🗑️
                  </button>
                )}
              </li>
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
