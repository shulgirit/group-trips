"use client";

import { tActive } from "@/i18n/active";
import type { AiPreset, GroupKind } from "@/lib/trip-doc";
import type { TripInput } from "@/lib/trip-schemas";

export interface CreatorDestination {
  label: string;
  placeId: string;
  lat: number;
  lng: number;
  region: string;
  country: string;
  timezone: string;
  /** ISO 4217 local currency */
  currency: string;
  coverImage: string | null;
}

/** One leg of the itinerary while editing (place may still be unpicked). */
export interface CreatorStop {
  id: string;
  place: CreatorDestination | null;
  startDate: string;
  endDate: string;
}

export interface CreatorMember {
  id: string;
  name: string;
  kid: boolean;
  age: number | null;
}

export interface CreatorFamily {
  id: string;
  name: string;
  members: CreatorMember[];
}

export interface CreatorState {
  tripId: string | null;
  status: "draft" | "active" | "archived";
  name: string;
  emoji: string;
  /** Ordered itinerary — one entry for a single-destination trip */
  stops: CreatorStop[];
  /** "HH:mm" local departure time on the first day, optional */
  departureTime: string;
  groupKind: GroupKind;
  groupName: string;
  families: CreatorFamily[];
  me: { familyId: string; memberId: string } | null;
  ai: {
    name: string;
    emoji: string;
    preset: AiPreset;
    rules: string[];
    customRules: string;
  };
  aboutUs: string;
  homeBase: TripInput["homeBase"];
}

export const DRAFT_KEY = "creator-draft-v2";

/** First day of the trip (first stop's start). */
export function tripStart(state: CreatorState): string {
  return state.stops[0]?.startDate ?? "";
}

/** Last day of the trip (last stop's end). */
export function tripEnd(state: CreatorState): string {
  return state.stops[state.stops.length - 1]?.endDate ?? "";
}

/** The first picked destination — cover, AI preview, defaults. */
export function primaryPlace(state: CreatorState): CreatorDestination | null {
  return state.stops.find((s) => s.place)?.place ?? null;
}

export function shortId(prefix: string): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

export function initialState(displayName: string | null): CreatorState {
  const [first = "", ...rest] = (displayName ?? "").trim().split(/\s+/);
  const last = rest.join(" ");
  const familyId = shortId("f");
  const memberId = shortId("m");
  return {
    tripId: null,
    status: "draft",
    name: "",
    emoji: "plane",
    stops: [{ id: shortId("s"), place: null, startDate: "", endDate: "" }],
    departureTime: "",
    groupKind: "families",
    groupName: "",
    families: [
      {
        id: familyId,
        name: last
          ? tActive("creator.defaults.familyOf", { name: last })
          : tActive("creator.defaults.myFamily"),
        members: [
          { id: memberId, name: first || tActive("creator.defaults.me"), kid: false, age: null },
        ],
      },
    ],
    me: { familyId, memberId },
    ai: {
      name: tActive("creator.ai.presets.butler.name"),
      emoji: "butler",
      preset: "butler",
      rules: [],
      customRules: "",
    },
    aboutUs: "",
    homeBase: null,
  };
}

/** Departure as an ISO instant (device's offset — departures are from home). */
function departureIso(state: CreatorState): string | null {
  const startDate = tripStart(state);
  if (!state.departureTime || !startDate) return null;
  const local = new Date(`${startDate}T${state.departureTime}:00`);
  if (Number.isNaN(local.getTime())) return null;
  const offsetMin = -local.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${startDate}T${state.departureTime}:00${sign}${hh}:${mm}`;
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

/** " (stop 2)" suffix for validation messages on multi-stop trips. */
function stopSuffix(multi: boolean, index: number): string {
  return multi ? tActive("creator.validation.stopSuffix", { n: index + 1 }) : "";
}

/** Wizard state → API payload. */
export function toTripInput(
  state: CreatorState,
  status: "draft" | "active"
): TripInput {
  const families = state.families
    .map((family) => ({
      ...family,
      name: family.name.trim(),
      members: family.members
        .filter((m) => m.name.trim())
        .map((m) => ({ id: m.id, name: m.name.trim(), kid: m.kid, age: m.age })),
    }))
    .filter((family) => family.name && family.members.length);
  const meValid =
    state.me &&
    families.some(
      (f) => f.id === state.me!.familyId && f.members.some((m) => m.id === state.me!.memberId)
    );
  const departureAt = departureIso(state);
  return {
    name: state.name.trim(),
    emoji: state.emoji || "plane",
    stops: state.stops
      .filter((stop) => stop.place)
      .map((stop) => ({
        id: stop.id,
        label: stop.place!.label,
        ...(stop.place!.placeId ? { placeId: stop.place!.placeId } : {}),
        lat: stop.place!.lat,
        lng: stop.place!.lng,
        region: stop.place!.region,
        ...(stop.place!.country ? { country: stop.place!.country } : {}),
        timezone: stop.place!.timezone,
        currency: stop.place!.currency,
        coverImage: stop.place!.coverImage,
        startDate: stop.startDate,
        endDate: stop.endDate,
      })),
    departureAt,
    departureNote: departureAt
      ? tActive("creator.defaults.departureNote", {
          date: shortDate(tripStart(state)),
          time: state.departureTime,
        })
      : "",
    homeBase: state.homeBase,
    groupKind: state.groupKind,
    groupName: state.groupName.trim(),
    aboutUs: state.aboutUs,
    families,
    ai: { ...state.ai, name: state.ai.name.trim() || tActive("creator.defaults.aiName") },
    me: meValid ? state.me : null,
    status,
  };
}

export function peopleCounts(state: CreatorState) {
  let people = 0;
  let kids = 0;
  for (const family of state.families) {
    for (const member of family.members) {
      if (!member.name.trim()) continue;
      people++;
      if (member.kid) kids++;
    }
  }
  return { people, kids };
}

/** Steps 1–2 are enough to create the draft trip. */
export function basicsValid(state: CreatorState): string | null {
  const multi = state.stops.length > 1;
  for (const [index, stop] of state.stops.entries()) {
    const which = stopSuffix(multi, index);
    if (!stop.place) return tActive("creator.validation.pickDestination", { which });
    if (!stop.startDate || !stop.endDate) return tActive("creator.validation.pickDates", { which });
    if (stop.endDate < stop.startDate) return tActive("creator.validation.endBeforeStart", { which });
    const previous = state.stops[index - 1];
    if (previous && stop.startDate < previous.endDate) {
      return tActive("creator.validation.overlap", { n: index + 1 });
    }
  }
  const days = (Date.parse(tripEnd(state)) - Date.parse(tripStart(state))) / 86_400_000;
  if (days > 120) return tActive("creator.validation.maxDays");
  if (!state.name.trim()) return tActive("creator.validation.name");
  return null;
}

export function groupValid(state: CreatorState): string | null {
  if (!peopleCounts(state).people) return tActive("creator.validation.people");
  return null;
}
