import { type Infer, v } from "convex/values";
import { destination, groupKind, homeBase, placeCategory, stop, tripRole, tripStatus } from "./validators";

/**
 * The normalized records the migration tool (scripts/migrate) produces from
 * a Firestore snapshot. References are Firestore ids/uids; the load
 * mutations resolve them through the firebaseId indexes, so every step can
 * be re-run safely.
 */

export const userRecord = v.object({
  firebaseUid: v.string(),
  name: v.string(),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerified: v.boolean(),
  createdAt: v.number(),
  /** Google/Apple identities; empty = a placeholder for kid/shared-device content */
  accounts: v.array(v.object({ providerId: v.union(v.literal("google"), v.literal("apple")), accountId: v.string() })),
});

export const tripRecord = v.object({
  firebaseId: v.string(),
  ownerFirebaseUid: v.string(),
  legacyKey: v.optional(v.string()),
  name: v.string(),
  emoji: v.string(),
  destination,
  stops: v.array(stop),
  startDate: v.string(),
  endDate: v.string(),
  timezone: v.string(),
  currency: v.string(),
  coverImage: v.union(v.string(), v.null()),
  departureAt: v.union(v.string(), v.null()),
  departureNote: v.string(),
  homeBase: v.union(homeBase, v.null()),
  groupKind,
  groupName: v.string(),
  ai: v.object({
    name: v.string(),
    emoji: v.string(),
    preset: v.union(v.literal("butler"), v.literal("pilot"), v.literal("buddy"), v.literal("guide"), v.literal("custom")),
    rules: v.array(v.string()),
    customRules: v.string(),
    customPrompt: v.optional(v.string()),
    /** Robot id, or a storage file the loader already copied */
    avatar: v.union(v.object({ kind: v.literal("bot"), id: v.string() }), v.object({ kind: v.literal("file"), storageId: v.id("_storage") }), v.null()),
  }),
  aboutUs: v.string(),
  summary: v.optional(v.string()),
  membersCanDeletePlaces: v.boolean(),
  status: tripStatus,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const familyRecord = v.object({
  tripFid: v.string(),
  key: v.string(),
  name: v.string(),
  color: v.string(),
  order: v.number(),
  members: v.array(v.object({ key: v.string(), name: v.string(), kid: v.optional(v.boolean()), age: v.optional(v.union(v.number(), v.null())) })),
});

export const membershipRecord = v.object({
  tripFid: v.string(),
  userFid: v.string(),
  role: tripRole,
  displayName: v.string(),
  image: v.optional(v.string()),
  familyKey: v.union(v.string(), v.null()),
  memberKey: v.union(v.string(), v.null()),
  guest: v.boolean(),
  joinedAt: v.number(),
});

const placeFields = {
  name: v.string(),
  category: placeCategory,
  area: v.optional(v.string()),
  address: v.optional(v.string()),
  lat: v.optional(v.union(v.number(), v.null())),
  lng: v.optional(v.union(v.number(), v.null())),
  website: v.optional(v.string()),
  bookingUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  summary: v.optional(v.string()),
  openingHours: v.optional(v.string()),
  priceNotes: v.optional(v.string()),
  recommendedDurationMin: v.optional(v.union(v.number(), v.null())),
  tips: v.optional(v.string()),
  reviewsSummary: v.optional(v.string()),
  popularDishes: v.optional(v.string()),
  favorite: v.optional(v.boolean()),
  stayFrom: v.optional(v.string()),
  stayTo: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
};

export const placeRecord = v.object({
  tripFid: v.string(),
  firebaseId: v.string(),
  creatorFid: v.optional(v.string()),
  createdByName: v.optional(v.string()),
  createdAt: v.number(),
  ...placeFields,
});

export const eventRecord = v.object({
  tripFid: v.string(),
  firebaseId: v.string(),
  title: v.string(),
  emoji: v.optional(v.string()),
  placeFid: v.union(v.string(), v.null()),
  day: v.string(),
  startTime: v.string(),
  durationMin: v.union(v.number(), v.null()),
  participants: v.union(
    v.object({ type: v.literal("all") }),
    v.object({ type: v.literal("families"), familyKeys: v.array(v.string()) }),
    v.object({ type: v.literal("members"), memberIds: v.array(v.string()) })
  ),
  notes: v.optional(v.string()),
  reminderSentAt: v.optional(v.number()),
  creatorFid: v.optional(v.string()),
  createdByName: v.optional(v.string()),
  createdAt: v.number(),
});

export const expenseRecord = v.object({
  tripFid: v.string(),
  firebaseId: v.string(),
  payerFamilyKey: v.string(),
  description: v.string(),
  amount: v.number(),
  currency: v.string(),
  date: v.string(),
  participantFamilyKeys: v.union(v.array(v.string()), v.null()),
  /** family key → people */
  participantCounts: v.optional(v.record(v.string(), v.number())),
  kind: v.optional(v.literal("settlement")),
  settledByName: v.optional(v.string()),
  createdAt: v.number(),
});

export const pollRecord = v.object({
  tripFid: v.string(),
  firebaseId: v.string(),
  question: v.string(),
  options: v.array(v.object({ id: v.string(), label: v.string(), placeFid: v.union(v.string(), v.null()) })),
  closed: v.boolean(),
  pinned: v.boolean(),
  createdAt: v.number(),
  votes: v.array(v.object({ userFid: v.string(), optionId: v.string(), name: v.string() })),
});

export const documentRecord = v.object({
  tripFid: v.string(),
  firebaseId: v.string(),
  ownerFid: v.string(),
  ownerName: v.string(),
  visibility: v.union(v.literal("shared"), v.literal("private")),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  createdAt: v.number(),
  storageId: v.id("_storage"),
});

export const chatRecord = v.object({
  tripFid: v.string(),
  firebaseId: v.string(),
  ownerFid: v.string(),
  title: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  messages: v.array(
    v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      imageStorageId: v.optional(v.id("_storage")),
      candidates: v.optional(
        v.array(
          v.object({
            name: v.string(),
            category: v.string(),
            area: v.optional(v.string()),
            description: v.string(),
            why: v.string(),
            address: v.optional(v.string()),
            lat: v.optional(v.union(v.number(), v.null())),
            lng: v.optional(v.union(v.number(), v.null())),
            priceNotes: v.optional(v.string()),
            website: v.optional(v.string()),
            imageUrl: v.optional(v.string()),
            rating: v.optional(v.number()),
            ratingCount: v.optional(v.number()),
            savedPlaceFid: v.optional(v.string()),
            dismissed: v.optional(v.boolean()),
            polled: v.optional(v.boolean()),
          })
        )
      ),
    })
  ),
});

export const inviteRecord = v.object({
  code: v.string(),
  tripFid: v.string(),
  role: v.union(v.literal("admin"), v.literal("member"), v.literal("kid")),
  familyKey: v.union(v.string(), v.null()),
  creatorFid: v.string(),
  expiresAt: v.number(),
  maxUses: v.number(),
  uses: v.number(),
  revoked: v.boolean(),
  createdAt: v.number(),
});

export const usageRecord = v.object({
  tripFid: v.string(),
  month: v.string(),
  aiCalls: v.number(),
  bookingImports: v.number(),
});

export type UserRecord = Infer<typeof userRecord>;
export type TripRecord = Infer<typeof tripRecord>;
export type FamilyRecord = Infer<typeof familyRecord>;
export type MembershipRecord = Infer<typeof membershipRecord>;
export type PlaceRecord = Infer<typeof placeRecord>;
export type EventRecord = Infer<typeof eventRecord>;
export type ExpenseRecord = Infer<typeof expenseRecord>;
export type PollRecord = Infer<typeof pollRecord>;
export type DocumentRecord = Infer<typeof documentRecord>;
export type ChatRecord = Infer<typeof chatRecord>;
export type InviteRecord = Infer<typeof inviteRecord>;
export type UsageRecord = Infer<typeof usageRecord>;
