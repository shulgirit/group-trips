import type { Family, Participants } from "@/types";

export function participantsLabel(
  participants: Participants,
  families: Family[]
): string {
  switch (participants.type) {
    case "all":
      return "כולם";
    case "families": {
      const names = participants.familyIds
        .map((id) => families.find((f) => f.id === id)?.name.replace("משפחת ", ""))
        .filter(Boolean);
      return names.length ? names.join(" · ") : "משפחות";
    }
    case "members": {
      const memberNames = families
        .flatMap((f) => f.members)
        .filter((m) => participants.memberIds.includes(m.id))
        .map((m) => m.name);
      if (!memberNames.length) return "משתתפים";
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
