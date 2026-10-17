import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { colors, radius } from "@together/shared/tokens";
import { useMutation } from "convex/react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Check, Lightbulb, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Labeled } from "@/components/ui/Label";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { categoryIcon } from "@/lib/glyphs";
import { useT } from "@/lib/i18n";
import { usePlaces, useTrip } from "@/lib/trip";

interface Draft {
  key: string;
  label: string;
  placeId: string | null;
}

let counter = 0;

/** New poll (modal): a question, saved places as options and free-text options. */
export default function NewPoll() {
  const t = useT();
  const { id: tripId } = useTrip();
  const places = usePlaces();
  const create = useMutation(api.polls.create);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Draft[]>([]);
  const [freeText, setFreeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = new Set(options.map((o) => o.placeId).filter(Boolean));

  function togglePlace(placeId: string, name: string) {
    setOptions((current) =>
      selected.has(placeId) ? current.filter((o) => o.placeId !== placeId) : [...current, { key: `o${counter++}`, label: name, placeId }]
    );
  }

  function addFree() {
    const label = freeText.trim();
    if (!label) return;
    setOptions((current) => [...current, { key: `o${counter++}`, label, placeId: null }]);
    setFreeText("");
  }

  async function submit() {
    if (saving || !question.trim() || options.length < 2) return;
    setSaving(true);
    setError("");
    try {
      await create({
        tripId,
        question,
        options: options.map((o) => ({ label: o.label, placeId: o.placeId ? (o.placeId as Id<"places">) : null })),
      });
      router.back();
    } catch {
      setError(t("common.errors.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 48 }}>
      <Labeled label={t("polls.new.questionLabel")}>
        <Field value={question} onChangeText={setQuestion} large autoFocus placeholder={t("polls.new.questionPlaceholder")} />
      </Labeled>

      {(places?.length ?? 0) > 0 && (
        <View style={{ gap: 8 }}>
          <Text variant="small" weight="medium" color={colors.ink700}>
            {t("polls.new.pickPlaces")}
          </Text>
          <Text variant="caption" color={colors.ink500}>
            {t("polls.new.pickPlacesHint")}
          </Text>
          <View style={styles.grid}>
            {places!.map((place) => {
              const on = selected.has(place.id);
              return (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => togglePlace(place.id, place.name)}
                  style={[styles.tile, on && styles.tileOn]}
                >
                  <View style={styles.tilePhoto}>
                    {place.imageUrl ? (
                      <Image source={place.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Icon icon={categoryIcon(place.category)} size={24} color={colors.route700} />
                    )}
                    <View style={[styles.tick, on && { backgroundColor: colors.ink900 }]}>
                      <Icon icon={on ? Check : Plus} size={15} color={on ? colors.chart50 : colors.ink500} />
                    </View>
                  </View>
                  <Text variant="small" weight="medium" numberOfLines={1} style={{ padding: 10 }}>
                    {place.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Labeled label={t("polls.new.freeOption")}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field
            value={freeText}
            onChangeText={setFreeText}
            onSubmitEditing={addFree}
            returnKeyType="done"
            blurOnSubmit={false}
            placeholder={t("polls.new.freePlaceholder")}
            style={{ flex: 1 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={t("polls.new.addOption")} disabled={!freeText.trim()} onPress={addFree} style={[styles.add, !freeText.trim() && { opacity: 0.4 }]}>
            <Icon icon={Plus} size={18} />
          </Pressable>
        </View>
      </Labeled>

      <View style={{ gap: 8 }}>
        <Text variant="small" weight="medium" color={colors.ink700}>
          {t("polls.new.optionsCount", { count: options.length })}
        </Text>
        {options.length === 0 ? (
          <Text variant="small" color={colors.ink500} style={styles.empty}>
            {t("polls.new.optionsEmpty")}
          </Text>
        ) : (
          options.map((option) => (
            <View key={option.key} style={styles.optionRow}>
              <Icon icon={option.placeId ? categoryIcon(places?.find((p) => p.id === option.placeId)?.category) : Lightbulb} size={16} color={colors.route700} />
              <Text style={{ flex: 1 }} numberOfLines={1}>
                {option.label}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("polls.new.removeOption", { label: option.label })}
                onPress={() => setOptions((current) => current.filter((o) => o.key !== option.key))}
                hitSlop={8}
              >
                <Icon icon={X} size={16} color={colors.ink400} />
              </Pressable>
            </View>
          ))
        )}
        {options.length === 1 && (
          <Text variant="caption" color={colors.ink500}>
            {t("polls.new.minOptions")}
          </Text>
        )}
      </View>

      {error ? (
        <Text accessibilityRole="alert" variant="small" color={colors.terra600}>
          {error}
        </Text>
      ) : null}
      <Button size="lg" busy={saving} disabled={!question.trim() || options.length < 2} label={saving ? t("polls.new.creating") : t("polls.new.submit")} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47%", flexGrow: 1, borderRadius: 12, overflow: "hidden", backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200 },
  tileOn: { borderWidth: 2, borderColor: colors.ink900 },
  tilePhoto: { aspectRatio: 4 / 3, backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  tick: { position: "absolute", top: 8, end: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  add: { width: 50, height: 50, borderRadius: radius.field, backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  empty: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.chart300, borderRadius: radius.card, padding: 16 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper, borderRadius: radius.field, paddingHorizontal: 14, paddingVertical: 12 },
});
