import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  bookingItem,
  chatCandidate,
  destination,
  familyMember,
  groupKind,
  homeBase,
  inviteRole,
  participants,
  placeCategory,
  pollOption,
  stop,
  tripAi,
  tripRole,
  tripStatus,
} from "./lib/validators";

/**
 * App data. Identity (users, accounts, sessions) lives in the Better Auth
 * component (convex/betterAuth); `users` here is the app profile, linked by
 * `authId`. Every table migrated from Firestore keeps `firebaseId` so the
 * import is idempotent and old links (/t/<firebaseTripId>) still resolve.
 */
export default defineSchema({
  users: defineTable({
    /** Better Auth user id */
    authId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    /** Anonymous Better Auth user (guest / kid device) */
    guest: v.boolean(),
    locale: v.optional(v.string()),
    firebaseUid: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authId", ["authId"])
    .index("by_firebaseUid", ["firebaseUid"]),

  trips: defineTable({
    name: v.string(),
    emoji: v.string(),
    destination,
    stops: v.array(stop),
    startDate: v.string(),
    endDate: v.string(),
    timezone: v.string(),
    currency: v.string(),
    coverImage: v.union(v.string(), v.null()),
    coverTriedAt: v.optional(v.number()),
    departureAt: v.optional(v.union(v.string(), v.null())),
    departureNote: v.optional(v.string()),
    homeBase: v.union(homeBase, v.null()),
    groupKind,
    groupName: v.string(),
    ai: tripAi,
    aboutUs: v.optional(v.string()),
    summary: v.optional(v.string()),
    membersCanDeletePlaces: v.boolean(),
    status: tripStatus,
    ownerId: v.id("users"),
    plan: v.literal("free"),
    /** Migrated Sicily/Sardinia trips: their static hero/persona config key */
    legacyKey: v.optional(v.string()),
    firebaseId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_firebaseId", ["firebaseId"])
    .index("by_status", ["status"]),

  /** Replaces members/{uid}, trips/*\/users/{uid}, users.tripIds and the `t` claim */
  memberships: defineTable({
    tripId: v.id("trips"),
    userId: v.id("users"),
    role: tripRole,
    displayName: v.string(),
    image: v.optional(v.string()),
    familyId: v.union(v.id("families"), v.null()),
    memberKey: v.union(v.string(), v.null()),
    guest: v.boolean(),
    joinedAt: v.number(),
    lastOpenedAt: v.optional(v.number()),
  })
    .index("by_trip", ["tripId"])
    .index("by_user", ["userId"])
    .index("by_trip_user", ["tripId", "userId"]),

  families: defineTable({
    tripId: v.id("trips"),
    /** Client-chosen stable id (creator wizard); migrated = Firestore doc id */
    key: v.string(),
    name: v.string(),
    color: v.string(),
    order: v.number(),
    members: v.array(familyMember),
  })
    .index("by_trip", ["tripId", "order"])
    .index("by_trip_key", ["tripId", "key"]),

  invites: defineTable({
    /** Public code in /j/<code>; migrated codes are kept so old links work */
    code: v.string(),
    tripId: v.id("trips"),
    role: inviteRole,
    familyId: v.union(v.id("families"), v.null()),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    maxUses: v.number(),
    uses: v.number(),
    revoked: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_trip", ["tripId"]),

  places: defineTable({
    tripId: v.id("trips"),
    name: v.string(),
    category: placeCategory,
    area: v.optional(v.string()),
    address: v.optional(v.string()),
    lat: v.optional(v.union(v.number(), v.null())),
    lng: v.optional(v.union(v.number(), v.null())),
    website: v.optional(v.string()),
    bookingUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    photoTriedAt: v.optional(v.number()),
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
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
    firebaseId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_creator", ["createdBy"])
    .index("by_firebaseId", ["tripId", "firebaseId"]),

  events: defineTable({
    tripId: v.id("trips"),
    title: v.string(),
    emoji: v.optional(v.string()),
    placeId: v.union(v.id("places"), v.null()),
    /** YYYY-MM-DD in the trip's time zone */
    day: v.string(),
    /** HH:mm */
    startTime: v.string(),
    durationMin: v.union(v.number(), v.null()),
    participants,
    notes: v.optional(v.string()),
    /** Scheduled reminder push (cancelled/rescheduled when the event moves) */
    reminderJobId: v.optional(v.id("_scheduled_functions")),
    reminderSentAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
    firebaseId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trip_day", ["tripId", "day", "startTime"])
    .index("by_place", ["placeId"])
    .index("by_creator", ["createdBy"])
    .index("by_firebaseId", ["tripId", "firebaseId"]),

  expenses: defineTable({
    tripId: v.id("trips"),
    payerFamilyId: v.id("families"),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    date: v.string(),
    /** null = every family */
    participantFamilyIds: v.union(v.array(v.id("families")), v.null()),
    /** familyId → people who took part */
    participantCounts: v.optional(v.record(v.string(), v.number())),
    kind: v.optional(v.literal("settlement")),
    settledByName: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    firebaseId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId", "date"])
    .index("by_firebaseId", ["tripId", "firebaseId"]),

  polls: defineTable({
    tripId: v.id("trips"),
    question: v.string(),
    options: v.array(pollOption),
    closed: v.boolean(),
    pinned: v.boolean(),
    createdBy: v.optional(v.id("users")),
    firebaseId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_firebaseId", ["tripId", "firebaseId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    tripId: v.id("trips"),
    userId: v.id("users"),
    optionId: v.string(),
    /** Denormalized for the "who voted" list */
    name: v.string(),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_user", ["pollId", "userId"])
    .index("by_trip_user", ["tripId", "userId"]),

  documents: defineTable({
    tripId: v.id("trips"),
    ownerId: v.id("users"),
    ownerName: v.string(),
    visibility: v.union(v.literal("shared"), v.literal("private")),
    name: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    size: v.number(),
    firebaseId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trip_visibility", ["tripId", "visibility"])
    .index("by_trip_owner", ["tripId", "ownerId"]),

  chatSessions: defineTable({
    tripId: v.id("trips"),
    ownerId: v.id("users"),
    title: v.string(),
    firebaseId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_trip_owner", ["tripId", "ownerId", "updatedAt"])
    .index("by_trip", ["tripId"]),

  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    /** pending → the AI action is still writing this message */
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("error")),
    imageStorageId: v.optional(v.id("_storage")),
    candidates: v.optional(v.array(chatCandidate)),
    createdAt: v.number(),
  }).index("by_session", ["sessionId", "createdAt"]),

  locations: defineTable({
    tripId: v.id("trips"),
    userId: v.id("users"),
    name: v.string(),
    familyId: v.union(v.id("families"), v.null()),
    lat: v.number(),
    lng: v.number(),
    accuracy: v.optional(v.number()),
    updatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_trip_user", ["tripId", "userId"])
    .index("by_expires", ["expiresAt"]),

  imports: defineTable({
    tripId: v.id("trips"),
    createdBy: v.id("users"),
    fileName: v.string(),
    storageId: v.union(v.id("_storage"), v.null()),
    contentType: v.string(),
    size: v.number(),
    status: v.union(v.literal("processing"), v.literal("review"), v.literal("applied"), v.literal("failed")),
    items: v.array(bookingItem),
    error: v.optional(v.string()),
    createdAt: v.number(),
    appliedAt: v.optional(v.number()),
  })
    .index("by_trip", ["tripId"])
    .index("by_trip_creator", ["tripId", "createdBy"]),

  /** Platform owners (the admin panel). Granted only with the CLI: `npx convex run admin:grantAdmin '{"email":"…"}'` */
  platformAdmins: defineTable({
    userId: v.id("users"),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Append-only record of everything an admin changed */
  adminAudit: defineTable({
    adminId: v.id("users"),
    action: v.string(),
    target: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  /** Remote content & flags the apps read at runtime (banners, feature flags, defaults) — no app update needed */
  appConfig: defineTable({
    key: v.string(),
    value: v.any(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  /** One row per AI reply: latency and cost for the admin dashboard (no message text) */
  aiRuns: defineTable({
    tripId: v.id("trips"),
    ok: v.boolean(),
    totalMs: v.number(),
    llmMs: v.number(),
    toolMs: v.number(),
    decorateMs: v.number(),
    rounds: v.number(),
    firstEffort: v.string(),
    tools: v.array(v.string()),
    promptTokens: v.number(),
    completionTokens: v.number(),
    model: v.string(),
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_created", ["createdAt"]),

  /** Monthly AI quota per trip */
  usage: defineTable({
    tripId: v.id("trips"),
    month: v.string(),
    aiCalls: v.number(),
    bookingImports: v.number(),
  }).index("by_trip_month", ["tripId", "month"]),

  /** Web-push subscriptions for the web app during the transition */
  webPushSubscriptions: defineTable({
    tripId: v.id("trips"),
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    locale: v.string(),
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_trip_user", ["tripId", "userId"])
    .index("by_endpoint", ["endpoint"]),

  /** Expo push tokens of the native app — per device, following its signed-in user */
  appPushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    locale: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  /** Exchange-rate cache (EUR base), refreshed by a cron */
  rates: defineTable({
    base: v.string(),
    rates: v.record(v.string(), v.number()),
    fetchedAt: v.number(),
  }).index("by_base", ["base"]),
});
