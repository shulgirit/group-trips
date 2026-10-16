import { v } from "convex/values";

/**
 * Shared field validators. Shapes mirror @together/shared types so the web
 * and mobile apps keep reading the same fields they read from Firestore;
 * references become Convex ids.
 */

export const tripRole = v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("kid"));
export const inviteRole = v.union(v.literal("admin"), v.literal("member"), v.literal("kid"));
export const tripStatus = v.union(v.literal("draft"), v.literal("active"), v.literal("archived"));
export const groupKind = v.union(v.literal("families"), v.literal("friends"), v.literal("couple"), v.literal("other"));
export const aiPreset = v.union(
  v.literal("butler"),
  v.literal("pilot"),
  v.literal("buddy"),
  v.literal("guide"),
  v.literal("custom")
);

export const placeCategory = v.union(
  v.literal("attraction"),
  v.literal("restaurant"),
  v.literal("beach"),
  v.literal("icecream"),
  v.literal("shopping"),
  v.literal("supermarket"),
  v.literal("viewpoint"),
  v.literal("parking"),
  v.literal("accommodation"),
  v.literal("sport"),
  v.literal("other")
);

export const destination = v.object({
  label: v.string(),
  placeId: v.optional(v.string()),
  lat: v.number(),
  lng: v.number(),
  region: v.string(),
  country: v.optional(v.string()),
});

export const stop = v.object({
  id: v.string(),
  label: v.string(),
  placeId: v.optional(v.string()),
  lat: v.number(),
  lng: v.number(),
  region: v.string(),
  country: v.optional(v.string()),
  timezone: v.string(),
  currency: v.string(),
  coverImage: v.union(v.string(), v.null()),
  startDate: v.string(),
  endDate: v.string(),
});

export const homeBase = v.object({
  name: v.string(),
  address: v.string(),
  lat: v.union(v.number(), v.null()),
  lng: v.union(v.number(), v.null()),
});

/** "bot:<id>" built-in robot, or an uploaded image in file storage */
export const avatar = v.union(
  v.object({ kind: v.literal("bot"), id: v.string() }),
  v.object({ kind: v.literal("file"), storageId: v.id("_storage") })
);

export const tripAi = v.object({
  name: v.string(),
  emoji: v.string(),
  avatar: v.optional(v.union(avatar, v.null())),
  preset: aiPreset,
  rules: v.array(v.string()),
  customRules: v.string(),
  customPrompt: v.optional(v.string()),
});

export const familyMember = v.object({
  /** Stable key inside the family; events and memberships refer to it */
  key: v.string(),
  name: v.string(),
  kid: v.optional(v.boolean()),
  age: v.optional(v.union(v.number(), v.null())),
});

export const participants = v.union(
  v.object({ type: v.literal("all") }),
  v.object({ type: v.literal("families"), familyIds: v.array(v.id("families")) }),
  v.object({ type: v.literal("members"), memberIds: v.array(v.string()) })
);

export const pollOption = v.object({
  id: v.string(),
  label: v.string(),
  placeId: v.optional(v.union(v.id("places"), v.null())),
});

export const chatCandidate = v.object({
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
  savedPlaceId: v.optional(v.id("places")),
  dismissed: v.optional(v.boolean()),
  polled: v.optional(v.boolean()),
});

/** Mirrors BookingItemSchema in @together/shared/booking */
export const bookingItem = v.object({
  kind: v.union(
    v.literal("flight"),
    v.literal("lodging"),
    v.literal("car"),
    v.literal("activity"),
    v.literal("restaurant"),
    v.literal("other")
  ),
  title: v.string(),
  startDate: v.string(),
  startTime: v.string(),
  endDate: v.string(),
  endTime: v.string(),
  location: v.string(),
  city: v.string(),
  confirmationCode: v.string(),
  flightNumber: v.string(),
  from: v.string(),
  to: v.string(),
  travelers: v.array(v.string()),
  notes: v.string(),
});

/** Creator wizard / settings payload (structure); business rules are
 *  re-checked with TripInputSchema from @together/shared. */
export const tripInput = v.object({
  name: v.string(),
  emoji: v.string(),
  stops: v.array(stop),
  departureAt: v.optional(v.union(v.string(), v.null())),
  departureNote: v.optional(v.string()),
  homeBase: v.union(homeBase, v.null()),
  groupKind,
  groupName: v.string(),
  aboutUs: v.optional(v.string()),
  families: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      members: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          kid: v.optional(v.boolean()),
          age: v.optional(v.union(v.number(), v.null())),
        })
      ),
    })
  ),
  ai: v.object({
    name: v.string(),
    emoji: v.string(),
    avatar: v.optional(v.union(avatar, v.null())),
    preset: aiPreset,
    rules: v.array(v.string()),
    customRules: v.string(),
  }),
  /** The organizer's own seat: family key + member key */
  me: v.optional(v.union(v.object({ familyId: v.string(), memberId: v.string() }), v.null())),
  status: v.union(v.literal("draft"), v.literal("active")),
});
