/** Convex rows → the shapes both apps render (id instead of _id, TripDoc for tripConfigFromDoc). */
import type { Doc } from "../convex/_generated/dataModel";
import type { TripDoc } from "@together/shared/trip-doc";
import type { Expense, Family, FamilyMember, Place, Poll, TripEvent } from "@together/shared/types";

export function toPlace(row: Doc<"places">): Place {
  const { _id, _creationTime, tripId, createdBy, firebaseId, photoTriedAt, ...fields } = row;
  void _creationTime;
  void tripId;
  void firebaseId;
  void photoTriedAt;
  return { id: _id, ...fields, createdByUid: createdBy };
}

export function toEvent(row: Doc<"events">): TripEvent {
  return {
    id: row._id,
    title: row.title,
    emoji: row.emoji,
    placeId: row.placeId,
    day: row.day,
    startTime: row.startTime,
    durationMin: row.durationMin,
    participants: row.participants,
    notes: row.notes,
    createdAt: row.createdAt,
    createdByUid: row.createdBy,
    createdByName: row.createdByName,
  };
}

export function toExpense(row: Doc<"expenses">): Expense {
  return {
    id: row._id,
    payerFamilyId: row.payerFamilyId,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    date: row.date,
    participantFamilyIds: row.participantFamilyIds,
    ...(row.participantCounts ? { participantCounts: row.participantCounts } : {}),
    createdAt: row.createdAt,
    ...(row.kind ? { kind: row.kind } : {}),
    ...(row.settledByName ? { settledByName: row.settledByName } : {}),
  };
}

export type FamilyMemberRow = FamilyMember & { kid?: boolean; age?: number | null };

export function toFamily(row: Doc<"families">): Family & { members: FamilyMemberRow[] } {
  return {
    id: row._id,
    name: row.name,
    color: row.color,
    order: row.order,
    members: row.members.map((member) => ({ id: member.key, name: member.name, kid: member.kid, age: member.age })),
  };
}

type PollRow = Doc<"polls"> & { votes: { userId: string; optionId: string; name: string }[] };

export function toPoll(row: PollRow): Poll {
  return {
    id: row._id,
    question: row.question,
    options: row.options.map((option) => ({ id: option.id, label: option.label, placeId: option.placeId ?? null })),
    votes: Object.fromEntries(row.votes.map((vote) => [vote.userId, { optionId: vote.optionId, name: vote.name }])),
    closed: row.closed,
    pinned: row.pinned,
    createdAt: row.createdAt,
  };
}

/**
 * A Convex trip in the TripDoc shape that tripConfigFromDoc and the web
 * pages already understand (the web app is retired after the store launch,
 * so it adapts here instead of being rewritten).
 */
export function toTripDoc(trip: Doc<"trips">, avatarUrl: string | null): TripDoc {
  const avatar = trip.ai.avatar;
  return {
    name: trip.name,
    emoji: trip.emoji,
    destination: trip.destination,
    stops: trip.stops,
    startDate: trip.startDate,
    endDate: trip.endDate,
    timezone: trip.timezone,
    currency: trip.currency,
    coverImage: trip.coverImage,
    departureAt: trip.departureAt ?? null,
    departureNote: trip.departureNote,
    homeBase: trip.homeBase,
    groupKind: trip.groupKind,
    groupName: trip.groupName,
    ai: {
      name: trip.ai.name,
      emoji: trip.ai.emoji,
      avatar: avatar?.kind === "bot" ? `bot:${avatar.id}` : avatarUrl,
      preset: trip.ai.preset,
      rules: trip.ai.rules,
      customRules: trip.ai.customRules,
      ...(trip.ai.customPrompt ? { customPrompt: trip.ai.customPrompt } : {}),
    },
    aboutUs: trip.aboutUs,
    summary: trip.summary,
    settings: { membersCanDeletePlaces: trip.membersCanDeletePlaces },
    status: trip.status,
    ownerUid: trip.ownerId,
    plan: trip.plan,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}
