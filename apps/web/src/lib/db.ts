"use client";

import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import type { EventInput, ExpenseInput, ExpenseSplitInput, PlaceInput, PollInput } from "@together/shared/schemas";
import type { Place } from "@together/shared/types";
import { activeTrip } from "@/lib/active-trip";
import { convex } from "@/lib/convex";

/**
 * Trip writes, called from event handlers. Each is a Convex mutation on the
 * active trip; validation, permissions and the single group notification
 * per action happen on the server.
 */

export { normalizePlaceName, samePlaceName } from "@together/shared/place-name";

const tripId = () => activeTrip().id as Id<"trips">;
const placeRef = (id: string | null | undefined) => (id ? (id as Id<"places">) : null);

type PlaceArgs = typeof api.places.add._args.input;

function placeArgs(input: Partial<PlaceInput> | Partial<Place>): Partial<PlaceArgs> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    // Convex rejects undefined fields; empty strings clear nothing either
    if (value === undefined || key === "id" || key === "createdAt" || key === "createdByUid" || key === "createdByName") continue;
    out[key] = value;
  }
  return out as Partial<PlaceArgs>;
}

export async function addPlace(input: PlaceInput): Promise<{ id: string; existed: boolean }> {
  return convex.mutation(api.places.add, { tripId: tripId(), input: placeArgs(input) as PlaceArgs });
}

export async function updatePlace(placeId: string, partial: Partial<Place>): Promise<void> {
  await convex.mutation(api.places.update, { tripId: tripId(), placeId: placeId as Id<"places">, patch: placeArgs(partial) });
}

export async function deletePlace(placeId: string): Promise<void> {
  await convex.mutation(api.places.remove, { tripId: tripId(), placeId: placeId as Id<"places"> });
}

function eventArgs(input: EventInput) {
  const participants =
    input.participants.type === "families"
      ? { type: "families" as const, familyIds: input.participants.familyIds as Id<"families">[] }
      : input.participants;
  return {
    title: input.title,
    ...(input.emoji ? { emoji: input.emoji } : {}),
    placeId: placeRef(input.placeId),
    day: input.day,
    startTime: input.startTime,
    durationMin: input.durationMin ?? null,
    participants,
    ...(input.notes ? { notes: input.notes } : {}),
  };
}

export async function addEvent(input: EventInput): Promise<string> {
  return convex.mutation(api.events.add, { tripId: tripId(), input: eventArgs(input) });
}

export async function updateEvent(eventId: string, input: EventInput): Promise<void> {
  await convex.mutation(api.events.update, { tripId: tripId(), eventId: eventId as Id<"events">, input: eventArgs(input) });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await convex.mutation(api.events.remove, { tripId: tripId(), eventId: eventId as Id<"events"> });
}

const familyIds = (ids: string[] | null) => (ids ? (ids as Id<"families">[]) : null);

export async function addExpense(input: ExpenseInput): Promise<string> {
  return convex.mutation(api.expenses.add, {
    tripId: tripId(),
    payerFamilyId: input.payerFamilyId as Id<"families">,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    participantFamilyIds: familyIds(input.participantFamilyIds),
    ...(input.participantCounts ? { participantCounts: input.participantCounts } : {}),
  });
}

/** Changes only how an expense is split — never amount/payer. */
export async function updateExpenseSplit(expenseId: string, input: ExpenseSplitInput): Promise<void> {
  await convex.mutation(api.expenses.updateSplit, {
    tripId: tripId(),
    expenseId: expenseId as Id<"expenses">,
    participantFamilyIds: familyIds(input.participantFamilyIds),
    ...(input.participantCounts ? { participantCounts: input.participantCounts } : {}),
  });
}

/** One family paid another back ("mark as paid"). */
export async function recordSettlement(input: {
  fromFamilyId: string;
  toFamilyId: string;
  amount: number;
  currency: string;
  date: string;
}): Promise<string> {
  return convex.mutation(api.expenses.recordSettlement, {
    tripId: tripId(),
    fromFamilyId: input.fromFamilyId as Id<"families">,
    toFamilyId: input.toFamilyId as Id<"families">,
    amount: input.amount,
    currency: input.currency,
    date: input.date,
  });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await convex.mutation(api.expenses.remove, { tripId: tripId(), expenseId: expenseId as Id<"expenses"> });
}

export async function addPoll(input: PollInput): Promise<string> {
  return convex.mutation(api.polls.create, {
    tripId: tripId(),
    question: input.question,
    options: input.options.map((option) => ({ label: option.label, placeId: placeRef(option.placeId) })),
  });
}

export async function removePollOption(pollId: string, optionId: string): Promise<void> {
  await convex.mutation(api.polls.removeOption, { tripId: tripId(), pollId: pollId as Id<"polls">, optionId });
}

/** The voter is always the signed-in person (the server ignores anything else). */
export async function votePoll(pollId: string, optionId: string): Promise<void> {
  await convex.mutation(api.polls.vote, { tripId: tripId(), pollId: pollId as Id<"polls">, optionId });
}

export async function setPollClosed(pollId: string, closed: boolean): Promise<void> {
  await convex.mutation(api.polls.setClosed, { tripId: tripId(), pollId: pollId as Id<"polls">, closed });
}

export async function deletePoll(pollId: string): Promise<void> {
  await convex.mutation(api.polls.remove, { tripId: tripId(), pollId: pollId as Id<"polls"> });
}

/** Adds an option to any existing poll (dedupes within that poll). */
export async function addOptionToPoll(pollId: string, label: string, placeId?: string | null): Promise<"added" | "exists"> {
  return convex.mutation(api.polls.addOption, { tripId: tripId(), pollId: pollId as Id<"polls">, label, placeId: placeRef(placeId) });
}

/** Creates a brand-new poll seeded with one option; notifies the group once. */
export async function createPollWithOption(question: string, label: string, placeId?: string | null): Promise<string> {
  return convex.mutation(api.polls.create, { tripId: tripId(), question, options: [{ label, placeId: placeRef(placeId) }] });
}

/** Adds an option to the always-open group ideas poll (created on first use). */
export async function addOptionToGlobalPoll(label: string, placeId?: string | null): Promise<"added" | "exists"> {
  return convex.mutation(api.polls.addToIdeas, { tripId: tripId(), label, placeId: placeRef(placeId) });
}
