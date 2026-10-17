import type { Id } from "@together/backend/dataModel";
import type { Participants } from "@together/shared/types";

/** Screen state → Convex mutation arguments (ids are plain strings in the render shapes). */

export interface EventDraft {
  title: string;
  emoji?: string;
  placeId: string | null;
  day: string;
  startTime: string;
  durationMin: number | null;
  participants: Participants;
  notes?: string;
}

export function eventArgs(input: EventDraft) {
  const participants =
    input.participants.type === "families"
      ? { type: "families" as const, familyIds: input.participants.familyIds as Id<"families">[] }
      : input.participants;
  return {
    title: input.title.trim(),
    ...(input.emoji ? { emoji: input.emoji } : {}),
    placeId: input.placeId ? (input.placeId as Id<"places">) : null,
    day: input.day,
    startTime: input.startTime,
    durationMin: input.durationMin ?? null,
    participants,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
}

/** A ConvexError's code/detail, for picking the message to show. */
export function errorReason(err: unknown): string {
  const data = (err as { data?: { detail?: string; code?: string } }).data;
  return data?.detail ?? data?.code ?? "";
}
