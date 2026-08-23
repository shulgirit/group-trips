// Read-only: proves the per-person split change cannot affect existing
// balances. Recomputes every family balance from the LIVE expense docs
// twice — old algorithm (equal per family) and new algorithm (with the
// participantCounts branch) — and compares. Also counts how many docs
// carry participantCounts (expected: 0 before the feature ships).
// Run remotely: gh workflow run admin.yml -f script=verify-expense-balances.mjs
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore(initializeApp({ credential: applicationDefault() }));
const TRIP = "trips/sicily-2026";

const familiesSnap = await db.collection(`${TRIP}/families`).get();
const families = familiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
const expensesSnap = await db.collection(`${TRIP}/expenses`).get();
const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

console.log(`families: ${families.length}, expenses: ${expenses.length}`);
const withCounts = expenses.filter((e) => e.participantCounts);
console.log(`expenses carrying participantCounts: ${withCounts.length}`);

function calcOld(currency) {
  const balances = new Map(
    families.map((f) => [f.id, { paid: 0, share: 0 }])
  );
  for (const expense of expenses) {
    if (expense.currency !== currency) continue;
    const participants =
      expense.participantFamilyIds ?? families.map((f) => f.id);
    const valid = participants.filter((id) => balances.has(id));
    if (!valid.length) continue;
    const payer = balances.get(expense.payerFamilyId);
    if (payer) payer.paid += expense.amount;
    const perFamily = expense.amount / valid.length;
    for (const id of valid) balances.get(id).share += perFamily;
  }
  return balances;
}

function calcNew(currency) {
  const balances = new Map(
    families.map((f) => [f.id, { paid: 0, share: 0 }])
  );
  for (const expense of expenses) {
    if (expense.currency !== currency) continue;
    const participants =
      expense.participantFamilyIds ?? families.map((f) => f.id);
    const valid = participants.filter((id) => balances.has(id));
    if (!valid.length) continue;
    const payer = balances.get(expense.payerFamilyId);
    if (payer) payer.paid += expense.amount;
    const counts = expense.participantCounts;
    const counted = counts
      ? valid
          .map((id) => ({ id, people: counts[id] ?? 0 }))
          .filter((entry) => entry.people > 0)
      : [];
    const totalPeople = counted.reduce((sum, entry) => sum + entry.people, 0);
    if (totalPeople > 0) {
      for (const { id, people } of counted) {
        balances.get(id).share += (expense.amount * people) / totalPeople;
      }
    } else {
      const perFamily = expense.amount / valid.length;
      for (const id of valid) balances.get(id).share += perFamily;
    }
  }
  return balances;
}

let identical = true;
for (const currency of ["EUR", "ILS"]) {
  const before = calcOld(currency);
  const after = calcNew(currency);
  console.log(`== ${currency} ==`);
  for (const family of families) {
    const b = before.get(family.id);
    const a = after.get(family.id);
    const same =
      Math.abs(b.paid - a.paid) < 1e-9 && Math.abs(b.share - a.share) < 1e-9;
    if (!same) identical = false;
    console.log(
      `${family.id}: paid ${b.paid.toFixed(2)} -> ${a.paid.toFixed(2)}, ` +
        `share ${b.share.toFixed(2)} -> ${a.share.toFixed(2)} ` +
        (same ? "IDENTICAL" : "*** DIFFERENT ***")
    );
  }
}
console.log(
  identical
    ? "RESULT: all balances identical — existing payments unaffected"
    : "RESULT: MISMATCH FOUND — do not deploy"
);
if (!identical) process.exit(1);
