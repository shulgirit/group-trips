"use client";

import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { PollOption } from "@/types";
import { auth, db, isPersonalUser } from "@/lib/firebase/client";
import { notifyGroup } from "@/lib/push-client";
import { formatDayLabel } from "@/lib/trip";
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

/** Normalized name for duplicate detection (case, spacing, punctuation). */
export function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[—–\-·.,'"׳״!?()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when two names refer to the same place ("Terme Segestane" vs
 *  "Terme Segestane — מעיינות חמים"). Single-word names never absorb
 *  longer ones — "Erice" (the town) is not "Erice Adventure Park". */
export function samePlaceName(a: string, b: string): boolean {
  const na = normalizePlaceName(a);
  const nb = normalizePlaceName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  const shorterWords = shorter.split(" ").length;
  return (
    shorterWords >= 2 && shorter.length >= 8 && longer.includes(shorter)
  );
}

export async function addPlace(
  input: PlaceInput
): Promise<{ id: string; existed: boolean }> {
  const parsed = PlaceInputSchema.parse(input);
  // Never create a duplicate — reuse the existing place instead
  const snapshot = await getDocs(collection(db(), `${TRIP_PATH}/places`));
  const existing = snapshot.docs.find((docSnap) =>
    samePlaceName(String(docSnap.data().name ?? ""), parsed.name)
  );
  if (existing) return { id: existing.id, existed: true };

  const ref = await addDoc(
    collection(db(), `${TRIP_PATH}/places`),
    compact({ ...parsed, createdAt: Date.now() })
  );
  return { id: ref.id, existed: false };
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
  const currentUser = auth().currentUser;
  const personal = isPersonalUser(currentUser);
  const ref = await addDoc(
    collection(db(), `${TRIP_PATH}/events`),
    compact({
      ...parsed,
      createdAt: Date.now(),
      createdByUid: personal ? currentUser?.uid : undefined,
      createdByName: personal
        ? (currentUser?.displayName ?? undefined)
        : undefined,
    })
  );
  notifyGroup(
    "event",
    parsed.title,
    `${formatDayLabel(parsed.day)} · ${parsed.startTime}`,
    currentUser?.uid
  );
  return ref.id;
}

export async function updateEvent(
  eventId: string,
  input: EventInput
): Promise<void> {
  const parsed = EventInputSchema.parse(input);
  await updateDoc(doc(db(), `${TRIP_PATH}/events/${eventId}`), {
    title: parsed.title,
    emoji: parsed.emoji ?? null,
    placeId: parsed.placeId ?? null,
    day: parsed.day,
    startTime: parsed.startTime,
    durationMin: parsed.durationMin ?? null,
    participants: parsed.participants,
    notes: parsed.notes ?? "",
    // Time may have moved — let the reminder fire again for the new slot
    reminderSentAt: deleteField(),
  });
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
  notifyGroup("poll", parsed.question, undefined, auth().currentUser?.uid);
  return ref.id;
}

export async function removePollOption(
  pollId: string,
  optionId: string
): Promise<void> {
  const ref = doc(db(), `${TRIP_PATH}/polls/${pollId}`);
  const snapshot = await getDoc(ref);
  const options = (snapshot.data()?.options ?? []) as PollOption[];
  await updateDoc(ref, {
    options: options.filter((option) => option.id !== optionId),
  });
}

export async function votePoll(
  pollId: string,
  voterUid: string,
  optionId: string,
  voterName: string
): Promise<void> {
  await updateDoc(doc(db(), `${TRIP_PATH}/polls/${pollId}`), {
    [`votes.${voterUid}`]: { optionId, name: voterName },
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

export const GLOBAL_POLL_ID = "global";

function newPollOption(label: string, placeId?: string | null): PollOption {
  return {
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    placeId: placeId ?? null,
  };
}

/** Adds an option to any existing poll (dedupes within that poll). */
export async function addOptionToPoll(
  pollId: string,
  label: string,
  placeId?: string | null
): Promise<"added" | "exists"> {
  const ref = doc(db(), `${TRIP_PATH}/polls/${pollId}`);
  const snapshot = await getDoc(ref);
  const options = (snapshot.data()?.options ?? []) as PollOption[];
  if (
    options.some(
      (option) =>
        option.label === label || (placeId && option.placeId === placeId)
    )
  ) {
    return "exists";
  }
  await updateDoc(ref, { options: arrayUnion(newPollOption(label, placeId)) });
  return "added";
}

/** Creates a brand-new poll seeded with one option; notifies the group once. */
export async function createPollWithOption(
  question: string,
  label: string,
  placeId?: string | null
): Promise<string> {
  const ref = await addDoc(collection(db(), `${TRIP_PATH}/polls`), {
    question: question.trim(),
    options: [newPollOption(label, placeId)],
    votes: {},
    closed: false,
    createdAt: Date.now(),
  });
  notifyGroup("poll", question.trim(), undefined, auth().currentUser?.uid);
  return ref.id;
}

/**
 * Adds an option to the always-open group poll (creates the poll on first
 * use). Returns "exists" when the same place/label is already an option.
 */
export async function addOptionToGlobalPoll(
  label: string,
  placeId?: string | null
): Promise<"added" | "exists"> {
  const ref = doc(db(), `${TRIP_PATH}/polls/${GLOBAL_POLL_ID}`);
  const snapshot = await getDoc(ref);
  const options = (snapshot.data()?.options ?? []) as PollOption[];
  if (
    options.some(
      (option) =>
        option.label === label || (placeId && option.placeId === placeId)
    )
  ) {
    return "exists";
  }
  const option: PollOption = {
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    placeId: placeId ?? null,
  };
  if (snapshot.exists()) {
    await updateDoc(ref, { options: arrayUnion(option) });
  } else {
    await setDoc(ref, {
      question: "🗳️ סקר הרעיונות של הקבוצה",
      options: [option],
      votes: {},
      closed: false,
      pinned: true,
      createdAt: Date.now(),
    });
  }
  notifyGroup("poll_option", label, undefined, auth().currentUser?.uid);
  return "added";
}
