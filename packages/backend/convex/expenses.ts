import { ExpenseInputSchema, ExpenseSplitInputSchema } from "@together/shared/schemas";
import { calcBalances, calcSettlement } from "@together/shared/settlement";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { toExpense, toFamily } from "../client/shapes";
import { fail } from "./lib/authz";
import { tripMutation, tripQuery } from "./lib/functions";

const split = {
  participantFamilyIds: v.union(v.array(v.id("families")), v.null()),
  participantCounts: v.optional(v.record(v.string(), v.number())),
};

async function assertFamilies(ctx: MutationCtx, tripId: Id<"trips">, ids: (Id<"families"> | null)[]) {
  for (const id of ids) {
    if (!id) continue;
    const family = await ctx.db.get(id);
    if (!family || family.tripId !== tripId) fail("invalid", "family");
  }
}

export const list = tripQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("expenses")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
      .collect(),
});

export const add = tripMutation({
  args: {
    payerFamilyId: v.id("families"),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    date: v.string(),
    ...split,
  },
  handler: async (ctx, args) => {
    const parsed = ExpenseInputSchema.safeParse(args);
    if (!parsed.success) fail("invalid", parsed.error.issues[0]?.message);
    await assertFamilies(ctx, ctx.tripId, [args.payerFamilyId, ...(args.participantFamilyIds ?? [])]);
    return ctx.db.insert("expenses", {
      tripId: ctx.tripId,
      payerFamilyId: args.payerFamilyId,
      description: parsed.data.description,
      amount: args.amount,
      currency: args.currency,
      date: args.date,
      participantFamilyIds: args.participantFamilyIds,
      participantCounts: args.participantCounts,
      createdBy: ctx.user._id,
      createdAt: Date.now(),
    });
  },
});

/** Changes only how an expense is split — never amount or payer. */
export const updateSplit = tripMutation({
  args: { expenseId: v.id("expenses"), ...split },
  handler: async (ctx, { expenseId, ...value }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense || expense.tripId !== ctx.tripId) fail("not_found");
    if (!ExpenseSplitInputSchema.safeParse(value).success) fail("invalid", "split");
    await assertFamilies(ctx, ctx.tripId, value.participantFamilyIds ?? []);
    await ctx.db.patch(expenseId, {
      participantFamilyIds: value.participantFamilyIds,
      participantCounts: value.participantCounts,
    });
  },
});

/**
 * One family paid another back ("mark as paid"). Stored with the expenses
 * so every balance settles through the same math.
 */
export const recordSettlement = tripMutation({
  args: {
    fromFamilyId: v.id("families"),
    toFamilyId: v.id("families"),
    amount: v.number(),
    currency: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const amount = Math.round(args.amount * 100) / 100;
    if (!(amount > 0) || args.fromFamilyId === args.toFamilyId) fail("invalid", "settlement");
    await assertFamilies(ctx, ctx.tripId, [args.fromFamilyId, args.toFamilyId]);
    return ctx.db.insert("expenses", {
      tripId: ctx.tripId,
      kind: "settlement",
      payerFamilyId: args.fromFamilyId,
      participantFamilyIds: [args.toFamilyId],
      description: "settlement",
      amount,
      currency: args.currency,
      date: args.date,
      settledByName: ctx.member.displayName || undefined,
      createdBy: ctx.user._id,
      createdAt: Date.now(),
    });
  },
});

/**
 * "Everything is paid": the group closed the account in one transfer (the combined settle-up in the
 * main currency), so record the repayments that bring every currency's balances to zero.
 */
export const settleAll = tripMutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const [rows, familyRows] = await Promise.all([
      ctx.db
        .query("expenses")
        .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
        .collect(),
      ctx.db
        .query("families")
        .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId))
        .collect(),
    ]);
    const expenses = rows.map(toExpense);
    const families = familyRows.map(toFamily);
    let recorded = 0;
    for (const currency of new Set(expenses.map((e) => e.currency))) {
      for (const transfer of calcSettlement(calcBalances(expenses, families, currency))) {
        const amount = Math.round(transfer.amount * 100) / 100;
        if (!(amount > 0)) continue;
        await ctx.db.insert("expenses", {
          tripId: ctx.tripId,
          kind: "settlement",
          payerFamilyId: transfer.fromFamilyId as Id<"families">,
          participantFamilyIds: [transfer.toFamilyId as Id<"families">],
          description: "settlement",
          amount,
          currency,
          date,
          settledByName: ctx.member.displayName || undefined,
          createdBy: ctx.user._id,
          createdAt: Date.now(),
        });
        recorded++;
      }
    }
    return { recorded };
  },
});

export const remove = tripMutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense || expense.tripId !== ctx.tripId) fail("not_found");
    await ctx.db.delete(expenseId);
  },
});
