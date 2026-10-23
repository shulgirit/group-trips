import { POPULAR_CURRENCIES, currencySymbol } from "@together/shared/currency";
import { colors } from "@together/shared/tokens";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/lib/i18n";

const MAX = 8;

/** Names for the offered currencies (Hermes has no Intl.DisplayNames). */
const NAMES: Record<string, { he: string; en: string }> = {
  ILS: { he: "שקל", en: "Shekel" }, USD: { he: "דולר", en: "US dollar" }, EUR: { he: "אירו", en: "Euro" },
  GBP: { he: "לירה שטרלינג", en: "Pound" }, AED: { he: "דירהם (דובאי)", en: "Dirham (Dubai)" }, JPY: { he: "ין", en: "Yen" },
  MXN: { he: "פסו מקסיקני", en: "Mexican peso" }, THB: { he: "באט", en: "Baht" }, CHF: { he: "פרנק שווייצרי", en: "Swiss franc" },
  TRY: { he: "לירה טורקית", en: "Turkish lira" }, CAD: { he: "דולר קנדי", en: "Canadian dollar" }, AUD: { he: "דולר אוסטרלי", en: "Australian dollar" },
  CZK: { he: "קורונה צ׳כית", en: "Czech koruna" }, PLN: { he: "זלוטי", en: "Zloty" }, HUF: { he: "פורינט", en: "Forint" },
  EGP: { he: "לירה מצרית", en: "Egyptian pound" }, JOD: { he: "דינר ירדני", en: "Jordanian dinar" }, INR: { he: "רופי", en: "Rupee" },
  CNY: { he: "יואן", en: "Yuan" }, KRW: { he: "וון", en: "Won" }, BRL: { he: "ריאל", en: "Real" }, ZAR: { he: "ראנד", en: "Rand" },
  SEK: { he: "כתר שוודי", en: "Swedish krona" }, NOK: { he: "כתר נורווגי", en: "Norwegian krone" }, DKK: { he: "כתר דני", en: "Danish krone" },
  RON: { he: "לאו רומני", en: "Romanian leu" }, GEL: { he: "לארי", en: "Lari" }, MAD: { he: "דירהם מרוקאי", en: "Moroccan dirham" },
  SGD: { he: "דולר סינגפורי", en: "Singapore dollar" }, HKD: { he: "דולר הונג קונגי", en: "Hong Kong dollar" }, VND: { he: "דונג", en: "Dong" },
  IDR: { he: "רופיה", en: "Rupiah" }, ARS: { he: "פסו ארגנטינאי", en: "Argentine peso" }, COP: { he: "פסו קולומביאני", en: "Colombian peso" },
  PEN: { he: "סול", en: "Sol" },
};

/** Pick the currencies a trip's expenses use (1–8). Organizer only. */
export function CurrencyPicker({
  open,
  initial,
  onClose,
  onSave,
  single = false,
  title,
  hint,
}: {
  open: boolean;
  initial: string[];
  onClose: () => void;
  onSave: (codes: string[]) => Promise<void>;
  /** Choose exactly one (the main currency) instead of up to 8 */
  single?: boolean;
  title?: string;
  hint?: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [selected, setSelected] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const options = [...new Set([...initial, ...POPULAR_CURRENCIES])];

  function toggle(code: string) {
    setError("");
    setSelected((current) => (single ? [code] : current.includes(code) ? current.filter((c) => c !== code) : current.length >= MAX ? current : [...current, code]));
  }

  async function save() {
    if (!selected.length || saving) return;
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } catch {
      setError(t("common.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.head}>
          <Text variant="title">{title ?? t("settings.trip.currency")}</Text>
          <Text variant="small" color={colors.ink500}>
            {hint ?? t("settings.trip.currencyHint", { max: MAX })}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          {options.map((code) => {
            const on = selected.includes(code);
            const name = NAMES[code]?.[locale === "he" ? "he" : "en"] ?? "";
            return (
              <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => toggle(code)} style={[styles.item, on && styles.itemOn]}>
                <Text variant="headline" weight="semibold" color={on ? colors.chart50 : colors.ink900} style={{ minWidth: 34, writingDirection: "ltr" }}>
                  {currencySymbol(code) === code ? "¤" : currencySymbol(code)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text weight="medium" color={on ? colors.chart50 : colors.ink900}>
                    {code}
                  </Text>
                  {name ? (
                    <Text variant="caption" color={on ? "rgba(241,243,239,0.75)" : colors.ink500} numberOfLines={1}>
                      {name}
                    </Text>
                  ) : null}
                </View>
                {on ? <Icon icon={Check} size={16} color={colors.chart50} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        {error ? (
          <Text variant="small" color={colors.terra600} style={{ paddingHorizontal: 20 }}>
            {error}
          </Text>
        ) : null}
        <View style={styles.foot}>
          <Button label={t("settings.trip.currencySave")} onPress={save} busy={saving} disabled={!selected.length} />
          <Button tone="soft" label={t("common.cancel")} onPress={onClose} disabled={saving} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chart50 },
  head: { padding: 20, gap: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  item: { width: "48%", flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200 },
  itemOn: { backgroundColor: colors.night950, borderColor: colors.night950 },
  foot: { padding: 20, gap: 10 },
});
