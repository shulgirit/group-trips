import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import type { Place, Poll } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import { BookOpen, CalendarPlus, Check, ChevronDown, Lightbulb, Lock, Trash2, Trophy, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { categoryIcon } from "@/lib/glyphs";
import { useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

interface Vote {
  voterKey: string;
  optionId: string;
  name: string;
}

/** Per-person votes; legacy family-keyed strings are shown under "Traveler". */
function votesOf(poll: Poll, fallback: string): Vote[] {
  return Object.entries(poll.votes ?? {}).map(([voterKey, vote]) =>
    typeof vote === "string" ? { voterKey, optionId: vote, name: fallback } : { voterKey, optionId: vote.optionId, name: vote.name || fallback }
  );
}

/** Option → its place (by id, else by name) so options show real photos. */
function placeFor(option: Poll["options"][number], places: Place[]): Place | null {
  return (
    (option.placeId ? places.find((p) => p.id === option.placeId) : null) ??
    places.find((p) => option.label === p.name || option.label.includes(p.name) || p.name.includes(option.label)) ??
    null
  );
}

export function PollCard({ poll, places }: { poll: Poll; places: Place[] }) {
  const t = useT();
  const { id: tripId, me, isAdmin } = useTrip();
  const vote = useMutation(api.polls.vote);
  const setClosed = useMutation(api.polls.setClosed);
  const remove = useMutation(api.polls.remove);
  const removeOption = useMutation(api.polls.removeOption);
  const [votersOpen, setVotersOpen] = useState(false);
  const pollId = poll.id as Id<"polls">;

  const votes = votesOf(poll, t("polls.traveler"));
  const myVote = votes.find((v) => v.voterKey === me.userId)?.optionId;
  const voterName = me.displayName || t("polls.traveler");
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  const winners = poll.options.filter((o) => max > 0 && counts.get(o.id) === max);
  const winner = poll.closed && winners.length === 1 ? winners[0] : null;
  const schedule = (label: string, placeId?: string | null) =>
    router.push(`/t/${tripId}/event/new?title=${encodeURIComponent(label)}${placeId ? `&placeId=${placeId}` : ""}` as Href);

  function confirmRemoveOption(option: Poll["options"][number]) {
    Alert.alert(t("polls.removeOptionLabel", { label: option.label }), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("polls.remove"), style: "destructive", onPress: () => removeOption({ tripId, pollId, optionId: option.id }).catch(() => undefined) },
    ]);
  }

  function confirmDelete() {
    Alert.alert(t("polls.deletePoll"), poll.question, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("polls.confirmDelete"), style: "destructive", onPress: () => remove({ tripId, pollId }).catch(() => undefined) },
    ]);
  }

  return (
    <Card style={{ overflow: "hidden" }}>
      <View style={styles.top}>
        <View style={styles.meta}>
          {poll.closed ? (
            <View style={[styles.badge, { backgroundColor: colors.chart100 }]}>
              <Icon icon={Lock} size={12} color={colors.ink500} />
              <Text variant="caption" weight="medium" color={colors.ink500}>
                {t("polls.closed")}
              </Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.route100 }]}>
              <View style={styles.dot} />
              <Text variant="caption" weight="medium" color={colors.route700}>
                {t("polls.open")}
              </Text>
            </View>
          )}
          {poll.pinned && (
            <View style={styles.inline}>
              <Icon icon={Lightbulb} size={13} color={colors.ink500} />
              <Text variant="caption" color={colors.ink500}>
                {t("polls.sheet.ideasTitle")}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Text variant="caption" color={colors.ink500}>
            {votes.length ? t("polls.votes", { count: votes.length }) : t("polls.noVotes")}
          </Text>
        </View>
        <Text variant="title">{poll.question}</Text>

        {winner && (
          <View style={styles.winner}>
            <View style={styles.trophy}>
              <Icon icon={Trophy} size={18} color={colors.brass600} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.ink500}>
                {t("polls.decided")}
              </Text>
              <Text weight="medium" numberOfLines={2}>
                {winner.label}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => schedule(winner.label, winner.placeId)} style={styles.darkButton}>
              <Icon icon={CalendarPlus} size={16} color={colors.chart50} />
              <Text variant="small" weight="medium" color={colors.chart50}>
                {t("polls.setAsEvent")}
              </Text>
            </Pressable>
          </View>
        )}

        {!poll.closed && (
          <View style={styles.inline}>
            {myVote && <Icon icon={Check} size={15} color={colors.brass600} />}
            <Text variant="small" color={colors.ink500} style={{ flex: 1 }}>
              {myVote ? t("polls.votedHint", { name: voterName }) : t("polls.voteHint", { name: voterName })}
            </Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 12, gap: 8 }}>
        {poll.options.map((option) => {
          const count = counts.get(option.id) ?? 0;
          const percent = votes.length ? Math.round((count / votes.length) * 100) : 0;
          const isWinner = poll.closed && winners.some((w) => w.id === option.id);
          const isMine = !poll.closed && myVote === option.id;
          const highlighted = isMine || isWinner;
          const place = placeFor(option, places);
          const voters = votes.filter((v) => v.optionId === option.id);
          return (
            <View key={option.id} style={[styles.option, highlighted && styles.optionOn]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isMine, disabled: poll.closed }}
                disabled={poll.closed}
                onPress={() => vote({ tripId, pollId, optionId: option.id }).catch(() => undefined)}
                style={({ pressed }) => [styles.optionMain, pressed && { backgroundColor: colors.chart100 }]}
              >
                <View style={styles.thumb}>
                  {place?.imageUrl ? (
                    <Image source={place.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Icon icon={place ? categoryIcon(place.category) : Lightbulb} size={20} color={colors.route700} />
                  )}
                  {highlighted && (
                    <View style={styles.mark} accessibilityLabel={isWinner ? t("polls.winner") : t("polls.yourVote")}>
                      <Icon icon={isWinner ? Trophy : Check} size={11} color={colors.paper} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={styles.inline}>
                    <Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                      {option.label}
                    </Text>
                    <Text variant="small" color={colors.ink700} style={{ fontVariant: ["tabular-nums"] }}>
                      {count}
                    </Text>
                  </View>
                  <View style={styles.inline}>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: highlighted ? colors.brass500 : colors.route500 }]} />
                    </View>
                    <Text variant="caption" color={colors.ink500} style={{ width: 36, textAlign: "right", writingDirection: "ltr" }}>
                      {percent}%
                    </Text>
                  </View>
                </View>
              </Pressable>
              <View style={styles.optionFoot}>
                <View style={styles.faces}>
                  {voters.slice(0, 4).map((v, i) => (
                    <View key={v.voterKey} style={[styles.face, i > 0 && { marginStart: -6 }]}>
                      <Text variant="caption" weight="medium" color={colors.ink700}>
                        {v.name.slice(0, 1)}
                      </Text>
                    </View>
                  ))}
                  {voters.length > 4 && (
                    <Text variant="caption" color={colors.ink500} style={{ marginStart: 4 }}>
                      {t("polls.moreVoters", { count: voters.length - 4 })}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }} />
                {place && (
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/t/${tripId}/place/${place.id}` as Href)} style={styles.footAction}>
                    <Icon icon={BookOpen} size={14} color={colors.route700} />
                    <Text variant="caption" weight="medium" color={colors.route700}>
                      {t("polls.readAbout")}
                    </Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" onPress={() => schedule(option.label, place?.id)} style={styles.footAction}>
                  <Icon icon={CalendarPlus} size={14} color={colors.ink700} />
                  <Text variant="caption" weight="medium" color={colors.ink700}>
                    {t("polls.schedule")}
                  </Text>
                </Pressable>
                {!poll.closed && (
                  <Pressable accessibilityRole="button" accessibilityLabel={t("polls.removeOptionLabel", { label: option.label })} onPress={() => confirmRemoveOption(option)} style={styles.footIcon}>
                    <Icon icon={X} size={15} color={colors.ink300} />
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {votes.length > 0 && (
        <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: votersOpen }} onPress={() => setVotersOpen(!votersOpen)} style={[styles.inline, { minHeight: 40 }]}>
            <Text variant="small" color={colors.ink500}>
              {t("polls.whoVoted")}
            </Text>
            <View style={votersOpen ? { transform: [{ rotate: "180deg" }] } : null}>
              <Icon icon={ChevronDown} size={15} color={colors.ink500} />
            </View>
          </Pressable>
          {votersOpen && (
            <View style={styles.voters}>
              {poll.options.map((option) => {
                const voters = votes.filter((v) => v.optionId === option.id);
                if (!voters.length) return null;
                return (
                  <View key={option.id} style={{ gap: 6 }}>
                    <Text variant="caption" weight="medium" color={colors.ink500}>
                      {option.label}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {voters.map((v) => (
                        <View key={v.voterKey} style={styles.voterChip}>
                          <Text variant="caption" color={colors.ink700}>
                            {v.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {isAdmin && (
        <View style={styles.foot}>
          <Pressable accessibilityRole="button" onPress={() => setClosed({ tripId, pollId, closed: !poll.closed }).catch(() => undefined)} style={styles.soft}>
            <Text variant="small" weight="medium" color={colors.ink700}>
              {poll.closed ? t("polls.reopen") : t("polls.closePoll")}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={t("polls.deletePoll")} onPress={confirmDelete} style={styles.footIcon}>
            <Icon icon={Trash2} size={17} color={colors.ink300} />
          </Pressable>
        </View>
      )}
      {!isAdmin && <View style={{ height: 14 }} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { padding: 18, paddingBottom: 14, gap: 10 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.route500 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  winner: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", backgroundColor: colors.brass100, borderRadius: radius.card, padding: 12 },
  trophy: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  darkButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: radius.field, backgroundColor: colors.ink900 },
  option: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, backgroundColor: colors.paper, overflow: "hidden" },
  optionOn: { borderColor: colors.brass300, backgroundColor: "rgba(243,235,222,0.4)" },
  optionMain: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8 },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  mark: { position: "absolute", bottom: 4, end: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brass500, alignItems: "center", justifyContent: "center" },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.chart100, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  optionFoot: { flexDirection: "row", alignItems: "center", gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart100, paddingHorizontal: 8 },
  faces: { flexDirection: "row", alignItems: "center" },
  face: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.paper, backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  footAction: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8 },
  footIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  voters: { gap: 12, backgroundColor: colors.chart50, borderRadius: 12, padding: 12, marginBottom: 4 },
  voterChip: { backgroundColor: colors.paper, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  foot: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.chart100, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  soft: { minHeight: 42, justifyContent: "center", paddingHorizontal: 16, borderRadius: radius.field, backgroundColor: colors.chart100 },
});
