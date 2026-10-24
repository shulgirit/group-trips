import { api } from "@together/backend/api";
import { type CreatorFamily, type CreatorState, peopleCounts, shortId } from "@together/backend/creator";
import type { Id } from "@together/backend/dataModel";
import type { GroupKind } from "@together/shared/trip-doc";
import { colors, familyColors, radius } from "@together/shared/tokens";
import { useConvex } from "convex/react";
import { Baby, Heart, History, Luggage, Plus, Trash2, UserRound, Users, Wine, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PickerSheet } from "@/components/ui/PickerSheet";
import { Text } from "@/components/ui/Text";
import { fontFor } from "@/lib/fonts";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { StepHeader } from "./StepHeader";

const KIND_ORDER: GroupKind[] = ["families", "friends", "couple", "other"];
const KIND_ICON: Record<GroupKind, LucideIcon> = { families: Users, friends: Wine, couple: Heart, other: Luggage };
const UNIT_COLORS = Object.values(familyColors);

type Member = CreatorFamily["members"][number];

function MemberRow({
  member,
  isMe,
  autoFocus,
  onChange,
  onRemove,
  onMakeMe,
}: {
  member: Member;
  isMe: boolean;
  autoFocus?: boolean;
  onChange: (patch: Partial<Member>) => void;
  onRemove: () => void;
  onMakeMe: () => void;
}) {
  const t = useT();
  return (
    <View style={styles.member}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={member.kid ? t("creator.who.member.kidToggle") : t("creator.who.member.adultToggle")}
        onPress={() => onChange({ kid: !member.kid })}
        style={[styles.kind, member.kid ? styles.kindKid : null]}
      >
        <Icon icon={member.kid ? Baby : UserRound} size={18} color={member.kid ? colors.route700 : colors.ink700} />
        <Text variant="caption" weight="medium" color={member.kid ? colors.route700 : colors.ink700} numberOfLines={1}>
          {member.kid ? t("creator.who.member.child") : t("creator.who.member.adult")}
        </Text>
      </Pressable>
      <Field
        value={member.name}
        onChangeText={(name) => onChange({ name })}
        placeholder={member.kid ? t("creator.who.member.kidName") : t("creator.who.member.name")}
        maxLength={30}
        autoFocus={autoFocus}
        style={{ flex: 1, minHeight: 44, paddingVertical: 8, paddingHorizontal: 12 }}
      />
      {member.kid && (
        <Field
          value={member.age === null ? "" : String(member.age)}
          onChangeText={(text) => {
            const age = Number.parseInt(text, 10);
            onChange({ age: Number.isFinite(age) ? Math.min(Math.max(age, 0), 17) : null });
          }}
          keyboardType="number-pad"
          placeholder={t("creator.who.member.age")}
          style={{ width: 56, minHeight: 44, paddingHorizontal: 4, textAlign: "center" }}
        />
      )}
      <Pressable accessibilityRole="button" accessibilityState={{ selected: isMe }} onPress={onMakeMe} style={[styles.me, isMe && styles.meActive]}>
        <Text variant="caption" weight="medium" color={isMe ? colors.chart50 : colors.ink400}>
          {t("creator.who.member.me")}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("creator.who.member.remove")} onPress={onRemove} style={styles.remove} hitSlop={4}>
        <Icon icon={Trash2} size={16} color={colors.ink300} />
      </Pressable>
    </View>
  );
}

/** Step 2: who's coming — group kind, families/units with adults and kids, and which one is me. */
export function StepWho({
  state,
  update,
  previousTrips,
}: {
  state: CreatorState;
  update: (patch: Partial<CreatorState>) => void;
  previousTrips: { id: string; name: string }[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const convex = useConvex();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [groupNameOpen, setGroupNameOpen] = useState(false);
  const kind = state.groupKind;
  const singles = kind === "friends" || kind === "couple";
  const { people, kids } = peopleCounts(state);

  const setFamilies = (families: CreatorFamily[]) => update({ families });
  const updateFamily = (id: string, patch: Partial<CreatorFamily>) => setFamilies(state.families.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  function addFamily() {
    const memberId = shortId("m");
    setFocusId(memberId);
    setFamilies([...state.families, { id: shortId("f"), name: "", members: [{ id: memberId, name: "", kid: false, age: null }] }]);
  }

  function addMember(familyId: string, kid: boolean) {
    const memberId = shortId("m");
    setFocusId(memberId);
    setFamilies(state.families.map((f) => (f.id === familyId ? { ...f, members: [...f.members, { id: memberId, name: "", kid, age: null }] } : f)));
  }

  function removeMember(familyId: string, memberId: string) {
    const families = state.families
      .map((f) => (f.id === familyId ? { ...f, members: f.members.filter((m) => m.id !== memberId) } : f))
      .filter((f) => f.members.length > 0);
    update({ families, ...(state.me?.memberId === memberId ? { me: null } : {}) });
  }

  async function copyFrom(tripId: string) {
    if (!tripId) return;
    setCopying(true);
    try {
      const sourceId = tripId as Id<"trips">;
      const [rows, { trip }] = await Promise.all([convex.query(api.families.list, { tripId: sourceId }), convex.query(api.trips.get, { tripId: sourceId })]);
      const families: CreatorFamily[] = rows.map((row) => ({
        id: shortId("f"),
        name: row.name,
        members: row.members.map((m) => ({ id: shortId("m"), name: m.name, kid: Boolean(m.kid), age: m.age ?? null })),
      }));
      if (families.length) {
        update({
          families,
          me: null,
          groupKind: trip.groupKind,
          groupName: trip.groupName,
          aboutUs: trip.aboutUs ?? state.aboutUs,
          ai: {
            name: trip.ai.name,
            emoji: trip.ai.emoji,
            // uploaded pictures live with the old trip — only gallery robots carry over
            avatar: trip.ai.avatar?.kind === "bot" ? `bot:${trip.ai.avatar.id}` : null,
            avatarStorageId: null,
            preset: trip.ai.preset,
            rules: trip.ai.rules,
            customRules: trip.ai.customRules,
          },
        });
      }
    } finally {
      setCopying(false);
    }
  }

  const memberRow = (family: CreatorFamily, member: Member) => (
    <MemberRow
      key={member.id}
      member={member}
      autoFocus={focusId === member.id}
      isMe={state.me?.memberId === member.id}
      onMakeMe={() => update({ me: { familyId: family.id, memberId: member.id } })}
      onRemove={() => removeMember(family.id, member.id)}
      onChange={(patch) =>
        updateFamily(family.id, {
          // A single person's unit is named after them
          ...(singles && patch.name !== undefined && family.members.length === 1 ? { name: patch.name } : {}),
          members: family.members.map((m) => (m.id === member.id ? { ...m, ...patch } : m)),
        })
      }
    />
  );

  return (
    <View style={{ gap: 28 }}>
      <StepHeader title={t("creator.who.title")} text={t("creator.who.text")} />

      {previousTrips.length > 0 && (
        <Card style={styles.copy}>
          <Icon icon={History} size={20} color={colors.route500} />
          <Text variant="small" color={colors.ink700} style={{ flex: 1 }}>
            {t("creator.who.sameGroup")}
          </Text>
          <View style={{ maxWidth: "50%" }}>
            <PickerSheet
              title={t("creator.who.copyFrom")}
              value=""
              none={copying ? t("creator.who.copying") : t("creator.who.copyFrom")}
              options={previousTrips.map((trip) => ({ value: trip.id, label: trip.name }))}
              onChange={copyFrom}
            />
          </View>
        </Card>
      )}

      <View style={{ gap: 8 }}>
        <Text variant="small" weight="medium" color={colors.ink700}>
          {t("creator.who.kindLabel")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {KIND_ORDER.map((key) => {
            const active = kind === key;
            return (
              <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => update({ groupKind: key })} style={[styles.kindTile, active && styles.kindTileActive]}>
                <Icon icon={KIND_ICON[key]} size={20} color={active ? colors.chart50 : colors.ink700} />
                <Text variant="small" weight="medium" color={active ? colors.chart50 : colors.ink700} align="center" numberOfLines={1}>
                  {t(`creator.who.kinds.${key}` as TKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {groupNameOpen || state.groupName ? (
        <View style={{ gap: 8 }}>
          <Text variant="small" weight="medium" color={colors.ink700}>
            {t("creator.who.groupName")}{" "}
            <Text variant="small" color={colors.ink400}>
              {t("creator.who.optional")}
            </Text>
          </Text>
          <Field
            value={state.groupName}
            onChangeText={(groupName) => update({ groupName })}
            autoFocus={groupNameOpen && !state.groupName}
            placeholder={singles ? t("creator.who.groupPlaceholderSingles") : t("creator.who.groupPlaceholder")}
            maxLength={40}
          />
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setGroupNameOpen(true)} style={styles.link} hitSlop={6}>
          <Icon icon={Plus} size={16} color={colors.route700} />
          <Text variant="small" weight="medium" color={colors.route700}>
            {t("creator.wizard.addGroupName")}
          </Text>
        </Pressable>
      )}

      {singles ? (
        <View style={{ gap: 12 }}>
          <Text variant="small" weight="medium" color={colors.ink700}>
            {t("creator.who.participants")}
          </Text>
          <Card style={{ padding: 12, gap: 10 }}>{state.families.flatMap((family) => family.members.map((member) => memberRow(family, member)))}</Card>
          <Pressable accessibilityRole="button" onPress={addFamily} style={styles.add}>
            <Icon icon={Plus} size={16} color={colors.ink700} />
            <Text variant="small" weight="medium" color={colors.ink700}>
              {t("creator.who.addParticipant")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {state.families.map((family, index) => (
            <Card key={family.id} style={{ padding: 12, gap: 10 }}>
              <View style={styles.familyHead}>
                <View style={[styles.dot, { backgroundColor: UNIT_COLORS[index % UNIT_COLORS.length] }]} />
                <TextInput
                  value={family.name}
                  onChangeText={(name) => updateFamily(family.id, { name })}
                  placeholder={t(`creator.who.units.${kind}.placeholder` as TKey)}
                  placeholderTextColor={colors.ink300}
                  maxLength={40}
                  style={[styles.familyName, { fontFamily: fontFor(locale, "medium") }]}
                />
              </View>
              {family.members.map((member) => memberRow(family, member))}
              <View style={{ flexDirection: "row", gap: 4 }}>
                <Pressable accessibilityRole="button" onPress={() => addMember(family.id, false)} style={styles.link} hitSlop={4}>
                  <Icon icon={Plus} size={14} color={colors.route700} />
                  <Text variant="small" weight="medium" color={colors.route700}>
                    {t("creator.who.adult")}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => addMember(family.id, true)} style={[styles.link, { marginStart: 16 }]} hitSlop={4}>
                  <Icon icon={Plus} size={14} color={colors.route700} />
                  <Text variant="small" weight="medium" color={colors.route700}>
                    {t("creator.who.kid")}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))}
          <Pressable accessibilityRole="button" onPress={addFamily} style={styles.add}>
            <Icon icon={Plus} size={16} color={colors.ink700} />
            <Text variant="small" weight="medium" color={colors.ink700}>
              {t(`creator.who.units.${kind}.add` as TKey)}
            </Text>
          </Pressable>
        </View>
      )}

      <Text variant="small" weight="medium" color={colors.ink700} align="center">
        {[
          t("creator.who.summaryPeople", { count: people }),
          ...(kids ? [t("creator.who.summaryKids", { count: kids })] : []),
          t(`creator.who.units.${kind}.count` as TKey, { count: state.families.length }),
        ].join(" · ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  kindTile: {
    flex: 1,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  kindTileActive: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.chart300,
  },
  member: { flexDirection: "row", alignItems: "center", gap: 6 },
  kind: { width: 60, height: 52, borderRadius: 16, gap: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.chart100, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200 },
  kindKid: { backgroundColor: colors.route100, borderColor: colors.route300 },
  me: { minHeight: 34, paddingHorizontal: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, alignItems: "center", justifyContent: "center" },
  meActive: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
  remove: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  familyHead: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.chart200, paddingBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, marginStart: 4 },
  familyName: { flex: 1, minHeight: 44, fontSize: 19, color: colors.ink900, textAlign: "auto" },
});
