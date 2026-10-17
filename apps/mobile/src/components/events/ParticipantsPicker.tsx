import type { Family, Participants } from "@together/shared/types";
import { colors } from "@together/shared/tokens";
import { View } from "react-native";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Text } from "@/components/ui/Text";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Who comes: everyone, some families/units, or picked people. */
export function ParticipantsPicker({ value, onChange, families }: { value: Participants; onChange: (next: Participants) => void; families: Family[] }) {
  const t = useT();
  const { config, me } = useTrip();
  const modes = [
    { type: "all", label: t("common.everyone") },
    { type: "families", label: config.group.unitLabel },
    { type: "members", label: t("trip.participants.custom") },
  ] as const;

  function switchMode(type: Participants["type"]) {
    if (type === value.type) return;
    if (type === "all") onChange({ type: "all" });
    if (type === "families") onChange({ type: "families", familyIds: [] });
    // Start with yourself when your seat is linked to a roster member
    if (type === "members") onChange({ type: "members", memberIds: me.memberKey ? [me.memberKey] : [] });
  }
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <View style={{ gap: 12 }}>
      <ChipRow>
        {modes.map((mode) => (
          <Chip key={mode.type} label={mode.label} active={value.type === mode.type} onPress={() => switchMode(mode.type)} />
        ))}
      </ChipRow>
      {value.type === "families" && (
        <ChipRow>
          {families.map((family) => (
            <Chip
              key={family.id}
              label={family.name}
              active={value.familyIds.includes(family.id)}
              onPress={() => onChange({ type: "families", familyIds: toggle(value.familyIds, family.id) })}
            />
          ))}
        </ChipRow>
      )}
      {value.type === "members" &&
        families.map((family) => (
          <View key={family.id} style={{ gap: 6 }}>
            <Text variant="small" color={colors.ink500}>
              {family.name}
            </Text>
            <ChipRow>
              {family.members.map((member) => (
                <Chip
                  key={member.id}
                  label={member.name}
                  active={value.memberIds.includes(member.id)}
                  onPress={() => onChange({ type: "members", memberIds: toggle(value.memberIds, member.id) })}
                />
              ))}
            </ChipRow>
          </View>
        ))}
    </View>
  );
}
