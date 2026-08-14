"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { TRIP_PATH } from "@/lib/hooks";
import {
  PlaceInputSchema,
  EventInputSchema,
  ExpenseInputSchema,
  PollInputSchema,
  type PlaceInput,
  type EventInput,
  type ExpenseInput,
  type PollInput,
} from "@/lib/schemas";
import type { Place } from "@/types";

/** Removes undefined values — Firestore rejects them. */
function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as T;
}

export async function addPlace(input: PlaceInput): Promise<string> {
  const parsed = PlaceInputSchema.parse(input);
  const ref = await addDoc(
    collection(db(), `${TRIP_PATH}/places`),
    compact({ ...parsed, createdAt: Date.now() })
  );
  return ref.id;
}

export async function updatePlace(
  placeId: string,
  partial: Partial<Place>
): Promise<void> {
  await updateDoc(doc(db(), `${TRIP_PATH}/places/${placeId}`), compact(partial));
}

export async function deletePlace(placeId: string): Promise<void> {
  await deleteDoc(doc(db(), `${TRIP_PATH}/places/${placeId}`));
}

export async function addEvent(input: EventInput): Promise<string> {
  const parsed = EventInputSchema.parse(input);
  const ref = await addDoc(
    collection(db(), `${TRIP_PATH}/events`),
    compact({ ...parsed, createdAt: Date.now() })
  );
  return ref.id;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db(), `${TRIP_PATH}/events/${eventId}`));
}

export async function addExpense(input: ExpenseInput): Promise<string> {
  const parsed = ExpenseInputSchema.parse(input);
  const ref = await addDoc(
    collection(db(), `${TRIP_PATH}/expenses`),
    compact({ ...parsed, createdAt: Date.now() })
  );
  return ref.id;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await deleteDoc(doc(db(), `${TRIP_PATH}/expenses/${expenseId}`));
}

export async function addPoll(input: PollInput): Promise<string> {
  const parsed = PollInputSchema.parse(input);
  const ref = await addDoc(
    collection(db(), `${TRIP_PATH}/polls`),
    compact({ ...parsed, votes: {}, closed: false, createdAt: Date.now() })
  );
  return ref.id;
}

export async function votePoll(
  pollId: string,
  familyId: string,
  optionId: string
): Promise<void> {
  await updateDoc(doc(db(), `${TRIP_PATH}/polls/${pollId}`), {
    [`votes.${familyId}`]: optionId,
  });
}

export async function setPollClosed(
  pollId: string,
  closed: boolean
): Promise<void> {
  await updateDoc(doc(db(), `${TRIP_PATH}/polls/${pollId}`), { closed });
}

export async function deletePoll(pollId: string): Promise<void> {
  await deleteDoc(doc(db(), `${TRIP_PATH}/polls/${pollId}`));
}
