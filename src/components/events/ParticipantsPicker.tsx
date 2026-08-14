"use client";

import { useFirebase } from "@/components/providers/FirebaseProvider";
import type { Family, Participants } from "@/types";

const MODES = [
  { type: "all", label: "כולם" },
  { type: "families", label: "משפחות" },
  { type: "members", label: "מותאם אישית" },
] as const;

export function ParticipantsPicker({
  value,
  onChange,
  families,
}: {
  value: Participants;
  onChange: (next: Participants) => void;
  families: Family[];
}) {
  const { profile } = useFirebase();

  function switchMode(type: Participants["type"]) {
    if (type === value.type) return;
    if (type === "all") onChange({ type: "all" });
    if (type === "families") onChange({ type: "families", familyIds: [] });
    if (type === "members") {
      // Start with yourself when you've linked your family member
      onChange({
        type: "members",
        memberIds: profile?.memberId ? [profile.memberId] : [],
      });
    }
  }

  function toggleFamily(familyId: string) {
    if (value.type !== "families") return;
    const familyIds = value.familyIds.includes(familyId)
      ? value.familyIds.filter((id) => id !== familyId)
      : [...value.familyIds, familyId];
    onChange({ type: "families", familyIds });
  }

  function toggleMember(memberId: string) {
    if (value.type !== "members") return;
    const memberIds = value.memberIds.includes(memberId)
      ? value.memberIds.filter((id) => id !== memberId)
      : [...value.memberIds, memberId];
    onChange({ type: "members", memberIds });
  }

  return (
    <div>
      <div className="flex gap-2">
        {MODES.map((mode) => (
          <button
            key={mode.type}
            type="button"
            onClick={() => switchMode(mode.type)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              value.type === mode.type
                ? "bg-sea-600 text-cream-50"
                : "bg-cream-100 text-ink-500"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {value.type === "families" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {families.map((family) => (
            <button
              key={family.id}
              type="button"
              onClick={() => toggleFamily(family.id)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                value.familyIds.includes(family.id)
                  ? "bg-terra-500 text-cream-50"
                  : "bg-cream-100 text-ink-700"
              }`}
            >
              {family.name}
            </button>
          ))}
        </div>
      )}

      {value.type === "members" && (
        <div className="mt-3 space-y-3">
          {families.map((family) => (
            <div key={family.id}>
              <p className="mb-1.5 text-sm font-medium text-ink-500">
                {family.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {family.members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={`rounded-full px-3.5 py-2 text-sm transition ${
                      value.memberIds.includes(member.id)
                        ? "bg-terra-500 font-medium text-cream-50"
                        : "bg-cream-100 text-ink-700"
                    }`}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
