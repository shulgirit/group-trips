import type { Expense, Family } from "@/types";

export interface FamilyBalance {
  familyId: string;
  paid: number;
  share: number;
  /** positive = owed money, negative = owes */
  balance: number;
}

export interface Transfer {
  fromFamilyId: string;
  toFamilyId: string;
  amount: number;
}

/** Balances for a single currency. */
export function calcBalances(
  expenses: Expense[],
  families: Family[],
  currency: Expense["currency"]
): FamilyBalance[] {
  const balances = new Map<string, FamilyBalance>(
    families.map((f) => [
      f.id,
      { familyId: f.id, paid: 0, share: 0, balance: 0 },
    ])
  );

  for (const expense of expenses) {
    if (expense.currency !== currency) continue;
    const participants =
      expense.participantFamilyIds ?? families.map((f) => f.id);
    const validParticipants = participants.filter((id) => balances.has(id));
    if (!validParticipants.length) continue;

    const payer = balances.get(expense.payerFamilyId);
    if (payer) payer.paid += expense.amount;

    const perFamily = expense.amount / validParticipants.length;
    for (const id of validParticipants) {
      balances.get(id)!.share += perFamily;
    }
  }

  for (const entry of balances.values()) {
    entry.balance = entry.paid - entry.share;
  }
  return [...balances.values()];
}

/** Greedy settlement: fewest sensible transfers to zero out balances. */
export function calcSettlement(balances: FamilyBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.balance < -0.005)
    .map((b) => ({ id: b.familyId, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.balance > 0.005)
    .map((b) => ({ id: b.familyId, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    transfers.push({
      fromFamilyId: debtors[d].id,
      toFamilyId: creditors[c].id,
      amount,
    });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount < 0.005) d++;
    if (creditors[c].amount < 0.005) c++;
  }
  return transfers;
}
