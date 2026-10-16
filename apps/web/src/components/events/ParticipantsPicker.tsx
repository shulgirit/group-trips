"use client";

import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import type { Family, Participants } from "@/types";
import { useT } from "@/i18n";

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
  const { group } = useTrip();
  const t = useT();
  const modes = [
    { type: "all", label: t("common.everyone") },
    { type: "families", label: group.unitLabel },
    { type: "members", label: t("trip.participants.custom") },
  ] as const;

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
        {modes.map((mode) => (
          <button
            key={mode.type}
            type="button"
            onClick={() => switchMode(mode.type)}
            className={`chip ${value.type === mode.type ? "chip-active" : ""}`}
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
              className={`rounded-xl border px-4 py-2.5 text-sm transition ${
                value.familyIds.includes(family.id)
                  ? "border-sea-900 bg-sea-900 text-cream-50"
                  : "border-cream-200 bg-white text-ink-700"
              }`}
            >
              <bdi>{family.name}</bdi>
            </button>
          ))}
        </div>
      )}

      {value.type === "members" && (
        <div className="mt-3 space-y-3">
          {families.map((family) => (
            <div key={family.id}>
              <p className="mb-1.5 text-sm text-ink-500">
                <bdi>{family.name}</bdi>
              </p>
              <div className="flex flex-wrap gap-2">
                {family.members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={`rounded-full border px-3.5 py-2 text-sm transition ${
                      value.memberIds.includes(member.id)
                        ? "border-sea-900 bg-sea-900 text-cream-50"
                        : "border-cream-200 bg-white text-ink-700"
                    }`}
                  >
                    <bdi>{member.name}</bdi>
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
