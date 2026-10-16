import type {
  ChatRecord,
  DocumentRecord,
  EventRecord,
  ExpenseRecord,
  FamilyRecord,
  InviteRecord,
  MembershipRecord,
  PlaceRecord,
  PollRecord,
  TripRecord,
  UsageRecord,
  UserRecord,
} from "@together/backend/migrationRecords";
import { LEGACY_PERSONAS } from "@together/shared/legacy-personas";
import { FAMILY_COLORS } from "@together/shared/trip-doc";
import { TRIPS, type TripConfig } from "@together/shared/trips";
import { PLACE_CATEGORIES } from "@together/shared/types";
import type { Data, DocSnap, Snapshot, TripSnap } from "./snapshot";

/**
 * Snapshot → Convex records. Pure and deterministic: the same snapshot
 * always yields the same records, so the load can be repeated. Anything
 * that can't be mapped safely is skipped and reported, never guessed.
 */

export interface Warning {
  kind: string;
  path: string;
  detail?: string;
}

/** A file that must be copied into Convex storage before its record loads. */
export type FileSource = { kind: "path"; path: string } | { kind: "url"; url: string };

export type PendingDocument = Omit<DocumentRecord, "storageId"> & { source: FileSource };
export type PendingChat = Omit<ChatRecord, "messages"> & {
  messages: (Omit<ChatRecord["messages"][number], "imageStorageId"> & { image?: FileSource })[];
};
export type PendingTrip = Omit<TripRecord, "ai"> & {
  ai: Omit<TripRecord["ai"], "avatar"> & { avatar: { kind: "bot"; id: string } | { kind: "file"; source: FileSource } | null };
};

export interface Plan {
  users: UserRecord[];
  trips: PendingTrip[];
  families: FamilyRecord[];
  memberships: MembershipRecord[];
  places: PlaceRecord[];
  events: EventRecord[];
  expenses: ExpenseRecord[];
  polls: PollRecord[];
  documents: PendingDocument[];
  chats: PendingChat[];
  invites: InviteRecord[];
  usage: UsageRecord[];
  warnings: Warning[];
}

export interface TransformOptions {
  /** Absolute origin for legacy hero images (e.g. https://together.app) */
  siteUrl: string;
  /** Who owns the migrated Sicily/Sardinia trips (no owner in Firestore) */
  legacyOwnerUid?: string;
}

// ── field readers ─────────────────────────────────────────────────────

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const bool = (value: unknown): boolean => value === true;
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const obj = (value: unknown): Data => (value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {});
const isoDay = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
const hhmm = (value: unknown) => (typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : undefined);
const nullableNum = (value: unknown): number | null => num(value) ?? null;

const CATEGORIES = new Set(Object.keys(PLACE_CATEGORIES));
const LEGACY = new Map(Object.values(TRIPS).map((trip) => [trip.id, trip]));
const SOCIAL: Record<string, "google" | "apple"> = { "google.com": "google", "apple.com": "apple" };

// ── main ──────────────────────────────────────────────────────────────

export function transform(snapshot: Snapshot, options: TransformOptions): Plan {
  const warnings: Warning[] = [];
  const warn = (kind: string, path: string, detail?: string) => warnings.push({ kind, path, ...(detail ? { detail } : {}) });

  const users = buildUsers(snapshot, warn);
  const knownUser = new Set(users.map((user) => user.firebaseUid));
  const accountUser = new Set(users.filter((user) => user.accounts.length).map((user) => user.firebaseUid));
  const ensureUser = (uid: string | undefined, name: string | undefined, path: string): string | undefined => {
    if (!uid) return undefined;
    if (!knownUser.has(uid)) {
      // Kid / shared-device / deleted identities still authored content
      users.push({ firebaseUid: uid, name: name ?? placeholderName(uid), emailVerified: false, createdAt: snapshot.exportedAt, accounts: [] });
      knownUser.add(uid);
      warn("placeholder_user", path, uid.startsWith("member-") ? "kid" : uid === "trip-member" ? "shared" : "unknown");
    }
    return uid;
  };

  const plan: Plan = {
    users,
    trips: [],
    families: [],
    memberships: [],
    places: [],
    events: [],
    expenses: [],
    polls: [],
    documents: [],
    chats: [],
    invites: [],
    usage: [],
    warnings,
  };

  for (const trip of snapshot.trips) {
    const legacy = LEGACY.get(trip.id);
    const record = legacy ? legacyTrip(trip, legacy, options, accountUser, warn) : selfServeTrip(trip, warn);
    if (!record) continue;
    if (!knownUser.has(record.ownerFirebaseUid)) {
      warn("missing_owner", `trips/${trip.id}`, record.ownerFirebaseUid);
      continue;
    }
    plan.trips.push(record);
    const families = buildFamilies(trip, warn);
    plan.families.push(...families);
    const familyKeys = new Set(families.map((family) => family.key));
    plan.memberships.push(...buildMemberships(trip, record, familyKeys, accountUser, warn));
    const places = buildPlaces(trip, ensureUser, warn);
    plan.places.push(...places);
    const placeIds = new Set(places.map((place) => place.firebaseId));
    plan.events.push(...buildEvents(trip, placeIds, familyKeys, ensureUser, warn));
    plan.expenses.push(...buildExpenses(trip, familyKeys, warn));
    plan.polls.push(...buildPolls(trip, placeIds, ensureUser, warn));
    plan.documents.push(...buildDocuments(trip, ensureUser, warn));
    plan.chats.push(...buildChats(trip, placeIds, ensureUser, warn));
    plan.usage.push(...buildUsage(trip));
  }

  const tripIds = new Set(plan.trips.map((trip) => trip.firebaseId));
  const familyKeysByTrip = new Map<string, Set<string>>();
  for (const family of plan.families) {
    const keys = familyKeysByTrip.get(family.tripFid) ?? new Set<string>();
    keys.add(family.key);
    familyKeysByTrip.set(family.tripFid, keys);
  }
  plan.invites.push(...buildInvites(snapshot.invites, tripIds, familyKeysByTrip, knownUser, warn));
  return plan;
}

function placeholderName(uid: string): string {
  if (uid === "trip-member") return "Group device";
  return "Traveler";
}

// ── users ─────────────────────────────────────────────────────────────

function buildUsers(snapshot: Snapshot, warn: (kind: string, path: string, detail?: string) => void): UserRecord[] {
  const profiles = new Map(snapshot.users.map((doc) => [doc.id, doc.data]));
  const records: UserRecord[] = [];
  for (const auth of snapshot.authUsers) {
    const accounts = auth.providers
      .filter((provider) => SOCIAL[provider.providerId])
      .map((provider) => ({ providerId: SOCIAL[provider.providerId], accountId: provider.uid }));
    const email = str(auth.email) ?? auth.providers.map((provider) => str(provider.email)).find(Boolean);
    const profile = profiles.get(auth.uid) ?? {};
    if (accounts.length && !email) {
      // Better Auth needs an email; Apple "hide my email" still gives a relay address
      warn("account_without_email", `auth/${auth.uid}`);
    }
    if (auth.disabled) warn("disabled_user", `auth/${auth.uid}`);
    const hasAccount = accounts.length > 0 && Boolean(email) && !auth.disabled;
    if (!hasAccount && !profile.displayName && !auth.displayName) continue; // anonymous devices: only if referenced
    records.push({
      firebaseUid: auth.uid,
      name: str(profile.displayName) ?? str(auth.displayName) ?? email?.split("@")[0] ?? "Traveler",
      email: hasAccount ? email : undefined,
      image: str(profile.photoURL) ?? str(auth.photoURL),
      emailVerified: auth.emailVerified,
      createdAt: auth.createdAt,
      accounts: hasAccount ? accounts : [],
    });
  }
  return records;
}

// ── trips ─────────────────────────────────────────────────────────────

type Warn = (kind: string, path: string, detail?: string) => void;

function selfServeTrip(trip: TripSnap, warn: Warn): PendingTrip | null {
  const d = trip.data;
  const path = `trips/${trip.id}`;
  const destination = obj(d.destination);
  const owner = str(d.ownerUid);
  const startDate = isoDay(d.startDate);
  const endDate = isoDay(d.endDate);
  if (!owner || !startDate || !endDate || num(destination.lat) === undefined) {
    warn("invalid_trip", path);
    return null;
  }
  const stops = arr(d.stops)
    .map(obj)
    .map((stop) => ({
      id: str(stop.id) ?? "s1",
      label: str(stop.label) ?? str(destination.label) ?? "",
      ...(str(stop.placeId) ? { placeId: str(stop.placeId) } : {}),
      lat: num(stop.lat) ?? num(destination.lat)!,
      lng: num(stop.lng) ?? num(destination.lng) ?? 0,
      region: str(stop.region) ?? str(destination.region) ?? "",
      ...(str(stop.country) ? { country: str(stop.country) } : {}),
      timezone: str(stop.timezone) ?? str(d.timezone) ?? "UTC",
      currency: str(stop.currency) ?? str(d.currency) ?? "EUR",
      coverImage: str(stop.coverImage) ?? null,
      startDate: isoDay(stop.startDate) ?? startDate,
      endDate: isoDay(stop.endDate) ?? endDate,
    }));
  const ai = obj(d.ai);
  const status = d.status === "draft" || d.status === "archived" ? d.status : "active";
  const homeBase = obj(d.homeBase);
  return {
    firebaseId: trip.id,
    ownerFirebaseUid: owner,
    name: str(d.name) ?? "Trip",
    emoji: str(d.emoji) ?? "sun",
    destination: {
      label: str(destination.label) ?? "",
      ...(str(destination.placeId) ? { placeId: str(destination.placeId) } : {}),
      lat: num(destination.lat)!,
      lng: num(destination.lng) ?? 0,
      region: str(destination.region) ?? "",
      ...(str(destination.country) ? { country: str(destination.country) } : {}),
    },
    stops: stops.length
      ? stops
      : [
          {
            id: "s1",
            label: str(destination.label) ?? "",
            lat: num(destination.lat)!,
            lng: num(destination.lng) ?? 0,
            region: str(destination.region) ?? "",
            timezone: str(d.timezone) ?? "UTC",
            currency: str(d.currency) ?? "EUR",
            coverImage: str(d.coverImage) ?? null,
            startDate,
            endDate,
          },
        ],
    startDate,
    endDate,
    timezone: str(d.timezone) ?? "UTC",
    currency: str(d.currency) ?? "EUR",
    coverImage: str(d.coverImage) ?? null,
    departureAt: str(d.departureAt) ?? null,
    departureNote: str(d.departureNote) ?? "",
    homeBase: str(homeBase.name)
      ? { name: str(homeBase.name)!, address: str(homeBase.address) ?? "", lat: nullableNum(homeBase.lat), lng: nullableNum(homeBase.lng) }
      : null,
    groupKind: d.groupKind === "friends" || d.groupKind === "couple" || d.groupKind === "other" ? d.groupKind : "families",
    groupName: str(d.groupName) ?? "",
    ai: {
      name: str(ai.name) ?? "Guide",
      emoji: str(ai.emoji) ?? "sparkles",
      preset: ai.preset === "pilot" || ai.preset === "buddy" || ai.preset === "guide" || ai.preset === "custom" ? ai.preset : "butler",
      rules: arr(ai.rules).filter((rule): rule is string => typeof rule === "string"),
      customRules: str(ai.customRules) ?? "",
      ...(str(ai.customPrompt) ? { customPrompt: str(ai.customPrompt) } : {}),
      avatar: avatarOf(ai.avatar),
    },
    aboutUs: str(d.aboutUs) ?? "",
    ...(str(d.summary) ? { summary: str(d.summary) } : {}),
    membersCanDeletePlaces: obj(d.settings).membersCanDeletePlaces !== false,
    status,
    createdAt: num(d.createdAt) ?? 0,
    updatedAt: num(d.updatedAt) ?? num(d.createdAt) ?? 0,
  };
}

function avatarOf(value: unknown): PendingTrip["ai"]["avatar"] {
  const text = str(value);
  if (!text) return null;
  if (text.startsWith("bot:")) return { kind: "bot", id: text.slice(4) };
  if (text.startsWith("https://")) return { kind: "file", source: { kind: "url", url: text } };
  return null;
}

function legacyTrip(
  trip: TripSnap,
  config: TripConfig,
  options: TransformOptions,
  accountUser: Set<string>,
  warn: Warn
): PendingTrip | null {
  const path = `trips/${trip.id}`;
  // The organizer is set explicitly; else the earliest signed-in member
  const profiles = trip.collections.users ?? [];
  const owner =
    options.legacyOwnerUid && accountUser.has(options.legacyOwnerUid)
      ? options.legacyOwnerUid
      : [...profiles].sort((a, b) => (num(a.data.createdAt) ?? 0) - (num(b.data.createdAt) ?? 0)).find((p) => accountUser.has(p.id))?.id;
  if (!owner) {
    warn("legacy_without_owner", path);
    return null;
  }
  const key = config.key === "custom" ? undefined : config.key;
  const first = config.stops[0];
  const home = config.homeBase;
  return {
    firebaseId: trip.id,
    ownerFirebaseUid: owner,
    legacyKey: key,
    name: config.name,
    emoji: config.emoji,
    destination: { label: first.label, lat: first.lat, lng: first.lng, region: first.region },
    stops: config.stops.map((stop, index) => ({
      id: `s${index + 1}`,
      label: stop.label,
      lat: stop.lat,
      lng: stop.lng,
      region: stop.region,
      timezone: stop.timezone,
      currency: stop.currency,
      coverImage: index === 0 && config.heroImage ? absolute(config.heroImage, options.siteUrl) : null,
      startDate: stop.startDate,
      endDate: stop.endDate,
    })),
    startDate: config.startDate,
    endDate: config.endDate,
    timezone: config.timezone,
    currency: config.currency,
    coverImage: config.heroImage ? absolute(config.heroImage, options.siteUrl) : null,
    departureAt: config.countdownTarget || null,
    departureNote: config.departureNote,
    homeBase: home ? { name: home.name, address: home.address, lat: home.lat, lng: home.lng } : null,
    groupKind: config.key === "sardinia" ? "friends" : "families",
    groupName: config.key === "sardinia" ? "סרדיניה" : "חבורת מיחא",
    ai: {
      name: config.aiName,
      emoji: config.ai.emoji,
      preset: "custom",
      rules: [],
      customRules: "",
      customPrompt: key ? LEGACY_PERSONAS[key] : undefined,
      avatar: null,
    },
    aboutUs: str(trip.data.aboutUs) ?? "",
    membersCanDeletePlaces: true,
    status: "active",
    createdAt: num(trip.data.createdAt) ?? Date.parse(`${config.startDate}T00:00:00Z`) - 30 * 86_400_000,
    updatedAt: num(trip.data.updatedAt) ?? Date.parse(`${config.endDate}T00:00:00Z`),
  };
}

const absolute = (path: string, siteUrl: string) => (path.startsWith("http") ? path : `${siteUrl.replace(/\/$/, "")}${path}`);

// ── families & memberships ────────────────────────────────────────────

function buildFamilies(trip: TripSnap, warn: Warn): FamilyRecord[] {
  return (trip.collections.families ?? [])
    .map((doc, index): FamilyRecord | null => {
      const name = str(doc.data.name);
      if (!name) {
        warn("family_without_name", `trips/${trip.id}/families/${doc.id}`);
        return null;
      }
      return {
        tripFid: trip.id,
        key: doc.id,
        name,
        color: str(doc.data.color) ?? FAMILY_COLORS[index % FAMILY_COLORS.length],
        order: num(doc.data.order) ?? index,
        members: arr(doc.data.members)
          .map(obj)
          .filter((member) => str(member.id) && str(member.name))
          .map((member) => ({
            key: str(member.id)!,
            name: str(member.name)!,
            ...(bool(member.kid) ? { kid: true } : {}),
            ...(num(member.age) !== undefined ? { age: num(member.age) } : {}),
          })),
      };
    })
    .filter((family): family is FamilyRecord => family !== null);
}

function buildMemberships(
  trip: TripSnap,
  record: PendingTrip,
  familyKeys: Set<string>,
  accountUser: Set<string>,
  warn: Warn
): MembershipRecord[] {
  const members = trip.collections.members ?? [];
  const profiles = new Map((trip.collections.users ?? []).map((doc) => [doc.id, doc.data]));
  // Self-serve trips: members docs. Legacy trips: members (from the multi-trip
  // migration) or, failing that, the per-trip profiles of signed-in people.
  const seats: { uid: string; data: Data }[] = members.length
    ? members.map((doc) => ({ uid: doc.id, data: { ...profiles.get(doc.id), ...doc.data } }))
    : record.legacyKey
      ? [...profiles.entries()].map(([uid, data]) => ({ uid, data }))
      : [];
  const out: MembershipRecord[] = [];
  for (const { uid, data } of seats) {
    if (!accountUser.has(uid)) {
      // Guests, kid tokens and the shared password identity re-join with an invite
      warn("seat_not_migrated", `trips/${trip.id}/members/${uid}`, uid.startsWith("member-") ? "kid" : "no_account");
      continue;
    }
    const role =
      uid === record.ownerFirebaseUid
        ? "owner"
        : data.role === "admin" || data.role === "member" || data.role === "kid"
          ? data.role
          : "member";
    const familyKey = str(data.familyId);
    out.push({
      tripFid: trip.id,
      userFid: uid,
      role,
      displayName: str(data.displayName) ?? "",
      ...(str(data.photoURL) ? { image: str(data.photoURL) } : {}),
      familyKey: familyKey && familyKeys.has(familyKey) ? familyKey : null,
      memberKey: familyKey && familyKeys.has(familyKey) ? (str(data.memberId) ?? null) : null,
      guest: false,
      joinedAt: num(data.joinedAt) ?? num(data.createdAt) ?? record.createdAt,
    });
  }
  if (!out.some((seat) => seat.role === "owner")) {
    out.push({
      tripFid: trip.id,
      userFid: record.ownerFirebaseUid,
      role: "owner",
      displayName: "",
      familyKey: null,
      memberKey: null,
      guest: false,
      joinedAt: record.createdAt,
    });
  }
  return out;
}

// ── content ───────────────────────────────────────────────────────────

type EnsureUser = (uid: string | undefined, name: string | undefined, path: string) => string | undefined;

function buildPlaces(trip: TripSnap, ensureUser: EnsureUser, warn: Warn): PlaceRecord[] {
  return (trip.collections.places ?? []).flatMap((doc): PlaceRecord[] => {
    const d = doc.data;
    const path = `trips/${trip.id}/places/${doc.id}`;
    const name = str(d.name);
    if (!name) {
      warn("place_without_name", path);
      return [];
    }
    const category = typeof d.category === "string" && CATEGORIES.has(d.category) ? d.category : "other";
    if (category !== d.category) warn("place_category_defaulted", path, String(d.category));
    const text = (key: string) => (str(d[key]) ? { [key]: str(d[key]) } : {});
    return [
      {
        tripFid: trip.id,
        firebaseId: doc.id,
        name,
        category: category as PlaceRecord["category"],
        ...text("area"),
        ...text("address"),
        lat: nullableNum(d.lat),
        lng: nullableNum(d.lng),
        ...text("website"),
        ...text("bookingUrl"),
        ...text("imageUrl"),
        ...text("summary"),
        ...text("openingHours"),
        ...text("priceNotes"),
        recommendedDurationMin: nullableNum(d.recommendedDurationMin),
        ...text("tips"),
        ...text("reviewsSummary"),
        ...text("popularDishes"),
        ...(bool(d.favorite) ? { favorite: true } : {}),
        ...(isoDay(d.stayFrom) ? { stayFrom: isoDay(d.stayFrom) } : {}),
        ...(isoDay(d.stayTo) ? { stayTo: isoDay(d.stayTo) } : {}),
        ...text("sourceUrl"),
        creatorFid: ensureUser(str(d.createdByUid), str(d.createdByName), path),
        ...(str(d.createdByName) ? { createdByName: str(d.createdByName) } : {}),
        createdAt: num(d.createdAt) ?? 0,
      },
    ];
  });
}

function buildEvents(
  trip: TripSnap,
  placeIds: Set<string>,
  familyKeys: Set<string>,
  ensureUser: EnsureUser,
  warn: Warn
): EventRecord[] {
  return (trip.collections.events ?? []).flatMap((doc): EventRecord[] => {
    const d = doc.data;
    const path = `trips/${trip.id}/events/${doc.id}`;
    const title = str(d.title);
    const day = isoDay(d.day);
    const startTime = hhmm(d.startTime);
    if (!title || !day || !startTime) {
      warn("invalid_event", path);
      return [];
    }
    const p = obj(d.participants);
    const familyList = arr(p.familyIds).filter((id): id is string => typeof id === "string" && familyKeys.has(id));
    const memberList = arr(p.memberIds).filter((id): id is string => typeof id === "string");
    const participants: EventRecord["participants"] =
      p.type === "families" && familyList.length
        ? { type: "families", familyKeys: familyList }
        : p.type === "members" && memberList.length
          ? { type: "members", memberIds: memberList }
          : { type: "all" };
    const placeFid = str(d.placeId);
    if (placeFid && !placeIds.has(placeFid)) warn("event_place_missing", path, placeFid);
    return [
      {
        tripFid: trip.id,
        firebaseId: doc.id,
        title,
        ...(str(d.emoji) ? { emoji: str(d.emoji) } : {}),
        placeFid: placeFid && placeIds.has(placeFid) ? placeFid : null,
        day,
        startTime,
        durationMin: nullableNum(d.durationMin),
        participants,
        ...(str(d.notes) ? { notes: str(d.notes) } : {}),
        // Past events never re-remind after the move
        ...(num(d.reminderSentAt) !== undefined ? { reminderSentAt: num(d.reminderSentAt) } : {}),
        creatorFid: ensureUser(str(d.createdByUid), str(d.createdByName), path),
        ...(str(d.createdByName) ? { createdByName: str(d.createdByName) } : {}),
        createdAt: num(d.createdAt) ?? 0,
      },
    ];
  });
}

function buildExpenses(trip: TripSnap, familyKeys: Set<string>, warn: Warn): ExpenseRecord[] {
  return (trip.collections.expenses ?? []).flatMap((doc): ExpenseRecord[] => {
    const d = doc.data;
    const path = `trips/${trip.id}/expenses/${doc.id}`;
    const payer = str(d.payerFamilyId);
    const amount = num(d.amount);
    const currency = typeof d.currency === "string" && /^[A-Z]{3}$/.test(d.currency) ? d.currency : undefined;
    const date = isoDay(d.date);
    if (!payer || !familyKeys.has(payer) || !amount || amount <= 0 || !currency || !date) {
      warn("invalid_expense", path);
      return [];
    }
    const participants = Array.isArray(d.participantFamilyIds)
      ? d.participantFamilyIds.filter((id): id is string => typeof id === "string" && familyKeys.has(id))
      : null;
    const counts = obj(d.participantCounts);
    const participantCounts = Object.fromEntries(
      Object.entries(counts).filter(([key, value]) => familyKeys.has(key) && typeof value === "number" && value > 0)
    ) as Record<string, number>;
    return [
      {
        tripFid: trip.id,
        firebaseId: doc.id,
        payerFamilyKey: payer,
        description: str(d.description) ?? "",
        amount,
        currency,
        date,
        participantFamilyKeys: participants && participants.length ? participants : null,
        ...(Object.keys(participantCounts).length ? { participantCounts } : {}),
        ...(d.kind === "settlement" ? { kind: "settlement" as const } : {}),
        ...(str(d.settledByName) ? { settledByName: str(d.settledByName) } : {}),
        createdAt: num(d.createdAt) ?? 0,
      },
    ];
  });
}

function buildPolls(trip: TripSnap, placeIds: Set<string>, ensureUser: EnsureUser, warn: Warn): PollRecord[] {
  return (trip.collections.polls ?? []).flatMap((doc): PollRecord[] => {
    const d = doc.data;
    const path = `trips/${trip.id}/polls/${doc.id}`;
    const question = str(d.question);
    if (!question) {
      warn("poll_without_question", path);
      return [];
    }
    const options = arr(d.options)
      .map(obj)
      .filter((option) => str(option.id) && str(option.label))
      .map((option) => {
        const placeFid = str(option.placeId);
        return { id: str(option.id)!, label: str(option.label)!, placeFid: placeFid && placeIds.has(placeFid) ? placeFid : null };
      });
    const optionIds = new Set(options.map((option) => option.id));
    const votes = Object.entries(obj(d.votes)).flatMap(([uid, raw]) => {
      // Legacy votes were a bare option id
      const optionId = typeof raw === "string" ? raw : str(obj(raw).optionId);
      if (!optionId || !optionIds.has(optionId)) return [];
      const name = typeof raw === "string" ? "" : (str(obj(raw).name) ?? "");
      const userFid = ensureUser(uid, name || undefined, `${path}/votes/${uid}`);
      return userFid ? [{ userFid, optionId, name }] : [];
    });
    return [
      {
        tripFid: trip.id,
        firebaseId: doc.id,
        question,
        options,
        closed: bool(d.closed),
        pinned: bool(d.pinned) || doc.id === "global",
        createdAt: num(d.createdAt) ?? 0,
        votes,
      },
    ];
  });
}

function buildDocuments(trip: TripSnap, ensureUser: EnsureUser, warn: Warn): PendingDocument[] {
  return (trip.collections.documents ?? []).flatMap((doc): PendingDocument[] => {
    const d = doc.data;
    const path = `trips/${trip.id}/documents/${doc.id}`;
    const storagePath = str(d.storagePath);
    const owner = ensureUser(str(d.ownerUid), str(d.ownerName), path);
    if (!storagePath || !owner) {
      warn("invalid_document", path);
      return [];
    }
    return [
      {
        tripFid: trip.id,
        firebaseId: doc.id,
        ownerFid: owner,
        ownerName: str(d.ownerName) ?? "",
        visibility: d.visibility === "private" ? "private" : "shared",
        name: str(d.name) ?? storagePath.split("/").pop() ?? "file",
        contentType: str(d.contentType) ?? "application/octet-stream",
        size: num(d.size) ?? 0,
        createdAt: num(d.createdAt) ?? 0,
        source: { kind: "path", path: storagePath },
      },
    ];
  });
}

function buildChats(trip: TripSnap, placeIds: Set<string>, ensureUser: EnsureUser, warn: Warn): PendingChat[] {
  return (trip.collections.chatSessions ?? []).flatMap((doc): PendingChat[] => {
    const d = doc.data;
    const path = `trips/${trip.id}/chatSessions/${doc.id}`;
    const owner = ensureUser(str(d.ownerUid), undefined, path);
    if (!owner) {
      warn("chat_without_owner", path);
      return [];
    }
    const messages = arr(d.messages)
      .map(obj)
      .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
      .map((message) => {
        const image = str(message.imageUrl);
        const candidates = arr(message.candidates)
          .map(obj)
          .filter((candidate) => str(candidate.name))
          .map((candidate) => {
            const saved = str(candidate.savedPlaceId);
            const text = (key: string) => (str(candidate[key]) ? { [key]: str(candidate[key]) } : {});
            return {
              name: str(candidate.name)!,
              category: str(candidate.category) ?? "other",
              ...text("area"),
              description: str(candidate.description) ?? "",
              why: str(candidate.why) ?? "",
              ...text("address"),
              lat: nullableNum(candidate.lat),
              lng: nullableNum(candidate.lng),
              ...text("priceNotes"),
              ...text("website"),
              ...text("imageUrl"),
              ...(num(candidate.rating) !== undefined ? { rating: num(candidate.rating) } : {}),
              ...(num(candidate.ratingCount) !== undefined ? { ratingCount: num(candidate.ratingCount) } : {}),
              ...(saved && placeIds.has(saved) ? { savedPlaceFid: saved } : {}),
              ...(bool(candidate.dismissed) ? { dismissed: true } : {}),
              ...(bool(candidate.polled) ? { polled: true } : {}),
            };
          });
        return {
          role: message.role as "user" | "assistant",
          content: message.content as string,
          ...(image?.startsWith("https://") ? { image: { kind: "url" as const, url: image } } : {}),
          ...(candidates.length ? { candidates } : {}),
        };
      });
    return [
      {
        tripFid: trip.id,
        firebaseId: doc.id,
        ownerFid: owner,
        title: str(d.title) ?? "",
        createdAt: num(d.createdAt) ?? 0,
        updatedAt: num(d.updatedAt) ?? num(d.createdAt) ?? 0,
        messages,
      },
    ];
  });
}

function buildUsage(trip: TripSnap): UsageRecord[] {
  return (trip.collections.usage ?? [])
    .filter((doc) => /^\d{4}-\d{2}$/.test(doc.id))
    .map((doc) => ({
      tripFid: trip.id,
      month: doc.id,
      aiCalls: num(doc.data.aiCalls) ?? 0,
      bookingImports: num(doc.data.bookingImports) ?? 0,
    }));
}

function buildInvites(
  invites: DocSnap[],
  tripIds: Set<string>,
  familyKeysByTrip: Map<string, Set<string>>,
  knownUser: Set<string>,
  warn: Warn
): InviteRecord[] {
  return invites.flatMap((doc): InviteRecord[] => {
    const d = doc.data;
    const tripFid = str(d.tripId);
    const creator = str(d.createdBy);
    if (!tripFid || !tripIds.has(tripFid) || !creator || !knownUser.has(creator)) {
      warn("invite_skipped", `invites/${doc.id}`);
      return [];
    }
    const family = str(d.familyId);
    return [
      {
        code: doc.id,
        tripFid,
        role: d.role === "admin" || d.role === "kid" ? d.role : "member",
        familyKey: family && familyKeysByTrip.get(tripFid)?.has(family) ? family : null,
        creatorFid: creator,
        expiresAt: num(d.expiresAt) ?? 0,
        maxUses: num(d.maxUses) ?? 0,
        uses: num(d.uses) ?? 0,
        revoked: bool(d.revoked),
        createdAt: num(d.createdAt) ?? 0,
      },
    ];
  });
}
