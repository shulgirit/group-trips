import type { Doc } from "@together/backend/dataModel";
import type { TripDoc } from "@together/shared/trip-doc";

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
