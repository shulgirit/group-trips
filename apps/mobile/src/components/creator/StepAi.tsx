import { api } from "@together/backend/api";
import { type CreatorState, primaryPlace, tripEnd, tripStart } from "@together/backend/creator";
import { translate } from "@together/i18n/translate";
import { PRESET_AVATAR } from "@together/shared/avatars";
import { AI_PRESETS, AI_RULES, type AiPreset } from "@together/shared/trip-doc";
import { colors, radius } from "@together/shared/tokens";
import { useAction } from "convex/react";
import { Plus, Send } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { glyphIcon } from "@/lib/glyphs";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { AvatarPicker } from "./AvatarPicker";
import { StepHeader } from "./StepHeader";

const PRESET_ORDER: Exclude<AiPreset, "custom">[] = ["butler", "pilot", "buddy", "guide"];
const SAMPLE_QUESTIONS: TKey[] = ["creator.ai.samples.firstDay", "creator.ai.samples.restaurant", "creator.ai.samples.know"];

/** Every name a preset has shipped with (any language) — renaming keeps custom names. */
const DEFAULT_NAMES = new Set(
  PRESET_ORDER.flatMap((p) => [AI_PRESETS[p].name, translate("he", `creator.ai.presets.${p}.name` as TKey), translate("en", `creator.ai.presets.${p}.name` as TKey)])
);

/** Step 4: the AI guide — persona, face, name, house rules, about us, and a live try-out. */
export function StepAi({ state, update }: { state: CreatorState; update: (patch: Partial<CreatorState>) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const previewGuide = useAction(api.assist.preview);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<{ q: string; a: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { ai } = state;
  const setAi = (patch: Partial<CreatorState["ai"]>) => update({ ai: { ...ai, ...patch } });

  function pickPreset(preset: Exclude<AiPreset, "custom">) {
    const wasDefaultName = DEFAULT_NAMES.has(ai.name) || !ai.name;
    // Follow the persona with its robot, unless a look was chosen on purpose
    const wasDefaultAvatar = !ai.avatar || Object.values(PRESET_AVATAR).some((id) => ai.avatar === `bot:${id}`);
    setAi({
      preset,
      emoji: preset,
      ...(wasDefaultName ? { name: t(`creator.ai.presets.${preset}.name` as TKey) } : {}),
      ...(wasDefaultAvatar ? { avatar: `bot:${PRESET_AVATAR[preset]}` } : {}),
    });
  }

  function toggleRule(id: string) {
    const rules = ai.rules.includes(id)
      ? ai.rules.filter((r) => r !== id)
      : [...ai.rules.filter((r) => !(id === "kids" && r === "adults") && !(id === "adults" && r === "kids")), id];
    setAi({ rules });
  }

  async function ask(text: string) {
    if (!text.trim() || asking || !primaryPlace(state)) return;
    setAsking(true);
    try {
      const answer = await previewGuide({
        draft: {
          destination: state.stops
            .map((stop) => stop.place?.label)
            .filter(Boolean)
            .join(" ← "),
          startDate: tripStart(state),
          endDate: tripEnd(state),
          groupKind: state.groupKind,
          groupName: state.groupName,
          aboutUs: state.aboutUs,
        },
        ai: { name: ai.name.trim() || t("creator.defaults.aiName"), preset: ai.preset, rules: ai.rules, customRules: ai.customRules },
        question: text,
        locale,
      });
      setReply({ q: text, a: answer || "…" });
      setQuestion("");
    } catch {
      setReply({ q: text, a: t("creator.ai.failed") });
    } finally {
      setAsking(false);
    }
  }

  return (
    <View style={{ gap: 28 }}>
      <StepHeader title={t("creator.ai.title")} text={t("creator.ai.text")} />

      <View style={styles.presets}>
        {PRESET_ORDER.map((key) => {
          const active = ai.preset === key;
          return (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => pickPreset(key)} style={[styles.preset, active && styles.presetActive]}>
              <Icon icon={glyphIcon(key)} size={20} color={active ? colors.brass500 : colors.route700} />
              <Text weight="medium">{t(`creator.ai.presets.${key}.label` as TKey)}</Text>
              <Text variant="caption" color={colors.ink500}>
                {t("creator.ai.quote", { text: t(`creator.ai.presets.${key}.sample` as TKey) })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <AvatarPicker tripId={state.tripId} value={ai.avatar} onChange={(avatar, storageId) => setAi({ avatar, avatarStorageId: storageId ?? null })} />

      <View style={{ gap: 6 }}>
        <Text variant="caption" color={colors.ink500}>
          {t("creator.ai.nameLabel")}
        </Text>
        <View style={styles.nameRow}>
          <Icon icon={glyphIcon(ai.emoji)} size={20} color={colors.route700} />
          <Field value={ai.name} onChangeText={(name) => setAi({ name })} maxLength={30} placeholder={t("creator.ai.namePlaceholder")} large style={{ flex: 1 }} />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="small" weight="medium" color={colors.ink700}>
          {t("creator.ai.rulesLabel")}
        </Text>
        <ChipRow>
          {AI_RULES.map((rule) => {
            const key = `creator.ai.rules.${rule.id}` as TKey;
            const label = t(key);
            return <Chip key={rule.id} label={label === key ? rule.id : label} active={ai.rules.includes(rule.id)} onPress={() => toggleRule(rule.id)} />;
          })}
        </ChipRow>
        <Field
          value={ai.customRules}
          onChangeText={(customRules) => setAi({ customRules })}
          placeholder={t("creator.ai.customRulesPlaceholder")}
          maxLength={1500}
          multiline
          style={{ minHeight: 80, textAlignVertical: "top", fontSize: 14 }}
        />
      </View>

      {aboutOpen || state.aboutUs ? (
        <View style={{ gap: 8 }}>
          <Text variant="small" weight="medium" color={colors.ink700}>
            {t("creator.ai.aboutLabel")}{" "}
            <Text variant="small" color={colors.ink400}>
              {t("creator.ai.aboutHint")}
            </Text>
          </Text>
          <Field
            value={state.aboutUs}
            onChangeText={(aboutUs) => update({ aboutUs })}
            placeholder={t("creator.ai.aboutPlaceholder")}
            maxLength={4000}
            autoFocus={aboutOpen && !state.aboutUs}
            multiline
            style={{ minHeight: 96, textAlignVertical: "top", fontSize: 14 }}
          />
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAboutOpen(true)} style={styles.link} hitSlop={6}>
          <Icon icon={Plus} size={16} color={colors.route700} />
          <Text variant="small" weight="medium" color={colors.route700}>
            {t("creator.ai.aboutLabel")}
          </Text>
        </Pressable>
      )}

      <Card style={{ padding: 16, gap: 12 }}>
        <Text variant="caption" weight="medium" color={colors.ink500}>
          {t("creator.ai.tryTitle")}
        </Text>
        {reply && (
          <View style={{ gap: 8 }}>
            <View style={styles.mine}>
              <Text variant="small" color={colors.chart50}>
                {reply.q}
              </Text>
            </View>
            <View style={styles.theirs}>
              <View style={styles.link}>
                <Icon icon={glyphIcon(ai.emoji)} size={14} color={colors.ink500} />
                <Text variant="caption" weight="medium" color={colors.ink500}>
                  {ai.name}
                </Text>
              </View>
              <Text variant="small">{reply.a}</Text>
            </View>
          </View>
        )}
        {asking && (
          <View style={styles.link}>
            <ActivityIndicator size="small" color={colors.ink500} />
            <Text variant="small" color={colors.ink500}>
              {t("creator.ai.typing")}
            </Text>
          </View>
        )}
        <ChipRow scroll>
          {SAMPLE_QUESTIONS.map((sample) => (
            <Chip key={sample} label={t(sample)} onPress={() => ask(t(sample))} />
          ))}
        </ChipRow>
        <View style={styles.nameRow}>
          <Field value={question} onChangeText={setQuestion} placeholder={t("creator.ai.askPlaceholder")} returnKeyType="send" onSubmitEditing={() => ask(question)} style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("creator.ai.send")}
            disabled={asking || !question.trim()}
            onPress={() => ask(question)}
            style={[styles.send, (asking || !question.trim()) && { opacity: 0.5 }]}
          >
            <Icon icon={Send} size={20} color={colors.chart50} flip />
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 4,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  presetActive: { borderColor: colors.route700, borderWidth: 1.5 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  link: { flexDirection: "row", alignItems: "center", gap: 6 },
  mine: { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: colors.route700, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  theirs: { alignSelf: "flex-start", maxWidth: "90%", backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, borderRadius: 16, padding: 12, gap: 4 },
  send: { width: 50, height: 50, borderRadius: radius.field, backgroundColor: colors.ink900, alignItems: "center", justifyContent: "center" },
});
