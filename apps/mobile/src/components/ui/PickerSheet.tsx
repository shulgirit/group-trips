import { colors, radius } from "@together/shared/tokens";
import { Check, ChevronDown, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Field } from "./Field";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { useT } from "@/lib/i18n";

export interface PickerOption {
  value: string;
  label: string;
  detail?: string;
}

/**
 * A select: a field-like row that opens a searchable sheet of options.
 * `none` adds an empty choice at the top (value "").
 */
export function PickerSheet({
  title,
  value,
  options,
  onChange,
  none,
}: {
  title: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  none?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = useMemo(() => (none ? [{ value: "", label: none }, ...options] : options), [none, options]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
  }, [all, query]);
  const current = all.find((o) => o.value === value);

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => setOpen(true)} style={styles.trigger}>
        <Text color={current?.value ? colors.ink900 : colors.ink500} numberOfLines={1} style={{ flex: 1 }}>
          {current?.label ?? none ?? ""}
        </Text>
        <Icon icon={ChevronDown} size={18} color={colors.ink500} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.head}>
            <Text variant="headline" weight="semibold" style={{ flex: 1 }}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12}>
              <Text weight="medium" color={colors.route700}>
                {t("common.close")}
              </Text>
            </Pressable>
          </View>
          {all.length > 8 && (
            <View style={styles.search}>
              <Icon icon={Search} size={16} color={colors.ink400} />
              <Field value={query} onChangeText={setQuery} placeholder={t("common.search")} style={{ flex: 1, borderWidth: 0, minHeight: 44 }} />
            </View>
          )}
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value || "none"}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === value }}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setQuery("");
                }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.chart100 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text color={item.value ? colors.ink900 : colors.ink500}>{item.label}</Text>
                  {item.detail ? (
                    <Text variant="small" color={colors.ink500} numberOfLines={1}>
                      {item.detail}
                    </Text>
                  ) : null}
                </View>
                {item.value === value && <Icon icon={Check} size={18} color={colors.route700} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
  },
  sheet: { flex: 1, backgroundColor: colors.chart50 },
  head: { flexDirection: "row", alignItems: "center", padding: 20 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingStart: 14,
    borderRadius: radius.field,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.chart200 },
});
