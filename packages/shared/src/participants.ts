import type { Family, Participants } from "./types";
import { tActive } from "@together/i18n/active";

/** Stored family names are Hebrew data ("Mishpachat X") — show just "X". */
const FAMILY_PREFIX = "\u05DE\u05E9\u05E4\u05D7\u05EA ";

export function participantsLabel(
  participants: Participants,
  families: Family[]
): string {
  switch (participants.type) {
    case "all":
      return tActive("common.everyone");
    case "families": {
      const names = participants.familyIds
        .map((id) => families.find((f) => f.id === id)?.name.replace(FAMILY_PREFIX, ""))
        .filter(Boolean);
      return names.length ? names.join(" · ") : tActive("trip.participants.families");
    }
    case "members": {
      const memberNames = families
        .flatMap((f) => f.members)
        .filter((m) => participants.memberIds.includes(m.id))
        .map((m) => m.name);
      if (!memberNames.length) return tActive("trip.participants.members");
      return memberNames.length > 3
        ? `${memberNames.slice(0, 3).join(", ")} +${memberNames.length - 3}`
        : memberNames.join(", ");
    }
  }
}

/** Expands participants to a set of member ids. */
export function expandMemberIds(
  participants: Participants,
  families: Family[]
): Set<string> {
  switch (participants.type) {
    case "all":
      return new Set(families.flatMap((f) => f.members.map((m) => m.id)));
    case "families":
      return new Set(
        families
          .filter((f) => participants.familyIds.includes(f.id))
          .flatMap((f) => f.members.map((m) => m.id))
      );
    case "members":
      return new Set(participants.memberIds);
  }
}

export function participantsIntersect(
  a: Participants,
  b: Participants,
  families: Family[]
): boolean {
  const setA = expandMemberIds(a, families);
  const setB = expandMemberIds(b, families);
  for (const id of setA) if (setB.has(id)) return true;
  return false;
}
