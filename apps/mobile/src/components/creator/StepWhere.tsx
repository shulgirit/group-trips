import { api } from "@together/backend/api";
import { type CreatorDestination, type CreatorState, type CreatorStop, primaryPlace, shortId, tripEnd, tripStart } from "@together/backend/creator";
import { tripCurrencies } from "@together/shared/currency";
import { colors, radius } from "@together/shared/tokens";
import { useAction } from "convex/react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowDown, ArrowUp, Clock, Coins, MapPin, Plus, Search, Sparkles, Trash2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CurrencyPicker } from "@/components/more/CurrencyPicker";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ChipRow } from "@/components/ui/ChipRow";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { TimeField } from "@/components/ui/TimeField";
import { TRIP_GLYPHS, glyphIcon } from "@/lib/glyphs";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { StepHeader } from "./StepHeader";

interface Suggestion {
  placeId: string;
  label: string;
  secondary: string;
}

function nights(start: string, end: string): number | null {
  if (!start || !end || end < start) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Destination search (Places autocomplete → resolved destination with time zone and currency). */
function DestinationSearch({ onPick, placeholder }: { onPick: (destination: CreatorDestination) => void; placeholder: string }) {
  const t = useT();
  const autocomplete = useAction(api.destinations.autocomplete);
  const resolve = useAction(api.destinations.resolve);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await autocomplete({ q });
        if (id === requestId.current) setSuggestions(found);
      } catch {
        // keep typing
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, autocomplete]);

  const shown = query.trim().length < 2 ? [] : suggestions;

  async function pick(suggestion: Suggestion) {
    setResolving(true);
    setError("");
    setSuggestions([]);
    setQuery("");
    try {
      const destination = await resolve({ placeId: suggestion.placeId });
      if (!destination) throw new Error("not_found");
      onPick({ ...destination, label: destination.label || suggestion.label });
    } catch {
      setError(t("creator.where.loadFailed"));
    } finally {
      setResolving(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.search}>
        <Icon icon={Search} size={20} color={colors.ink300} />
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          accessibilityLabel={t("creator.where.searchLabel")}
          autoCorrect={false}
          editable={!resolving}
          large
          returnKeyType="search"
          onSubmitEditing={() => shown[0] && pick(shown[0])}
          style={{ flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 8 }}
        />
      </View>
      {(resolving || (searching && shown.length === 0)) && (
        <Text variant="small" color={colors.ink500} style={{ paddingHorizontal: 8 }}>
          {resolving ? t("creator.where.loading") : t("creator.where.searching")}
        </Text>
      )}
      {shown.map((suggestion) => (
        <Pressable key={suggestion.placeId} accessibilityRole="button" onPress={() => pick(suggestion)} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.chart100 }]}>
          <Icon icon={MapPin} size={18} color={colors.route500} />
          <View style={{ flex: 1 }}>
            <Text weight="medium">{suggestion.label}</Text>
            <Text variant="caption" color={colors.ink500} numberOfLines={1}>
              {suggestion.secondary}
            </Text>
          </View>
        </Pressable>
      ))}
      {error ? (
        <Text variant="small" color={colors.terra600}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function StopCard({
  stop,
  index,
  count,
  minDate,
  onChange,
  onMove,
  onRemove,
}: {
  stop: CreatorStop;
  index: number;
  count: number;
  minDate: string;
  onChange: (patch: Partial<CreatorStop>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const multi = count > 1;
  const stopNights = nights(stop.startDate, stop.endDate);
  return (
    <View style={styles.stopRow}>
      <View style={styles.rail}>
        <View style={styles.railLine} />
        <View style={[styles.node, stop.place ? styles.nodeDone : styles.nodeOpen]}>
          <Text variant="caption" weight="medium" color={stop.place ? colors.chart50 : colors.route700}>
            {index + 1}
          </Text>
        </View>
      </View>
      <Card style={{ flex: 1, overflow: "hidden" }}>
        {stop.place ? (
          <View style={styles.cover}>
            {stop.place.coverImage ? <Image source={stop.place.coverImage} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <LinearGradient colors={["transparent", "rgba(7,12,22,0.8)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.coverText}>
              <View style={{ flex: 1 }}>
                <Text variant="title" color={colors.chart50} numberOfLines={1}>
                  {stop.place.label}
                </Text>
                <Text variant="caption" color="rgba(241,243,239,0.8)" style={{ writingDirection: "ltr" }}>
                  {stop.place.timezone} · {stop.place.currency}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => onChange({ place: null })} style={styles.change}>
                <Text variant="caption" weight="medium">
                  {t("creator.where.change")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ padding: 14, paddingBottom: 0, gap: 6 }}>
            {multi && (
              <Text variant="small" weight="medium" color={colors.ink700}>
                {t("creator.where.stopN", { n: index + 1 })}
              </Text>
            )}
            <DestinationSearch placeholder={index === 0 ? t("creator.where.firstPlaceholder") : t("creator.where.nextPlaceholder")} onPick={(place) => onChange({ place })} />
          </View>
        )}
        <View style={{ padding: 14, gap: 8 }}>
          <DateRangeField
            start={stop.startDate}
            end={stop.endDate}
            min={minDate}
            startLabel={index === 0 ? t("creator.where.depart") : t("creator.where.arrive")}
            endLabel={index === count - 1 ? t("creator.where.return") : t("creator.where.moveOn")}
            onChange={(startDate, endDate) => onChange({ startDate, endDate })}
          />
          <View style={styles.stopFoot}>
            <Text variant="small" color={colors.ink500} style={{ flex: 1 }}>
              {stopNights !== null ? (stopNights === 0 ? t("creator.where.oneDay") : t("creator.where.nights", { count: stopNights })) : ""}
            </Text>
            {multi && (
              <>
                <IconButton icon={ArrowUp} label={t("creator.where.moveUp")} disabled={index === 0} onPress={() => onMove(-1)} />
                <IconButton icon={ArrowDown} label={t("creator.where.moveDown")} disabled={index === count - 1} onPress={() => onMove(1)} />
                <IconButton icon={Trash2} label={t("creator.where.removeStop")} onPress={onRemove} />
              </>
            )}
          </View>
        </View>
      </Card>
    </View>
  );
}

export function IconButton({ icon, label, onPress, disabled }: { icon: typeof Plus; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && { opacity: 0.3 }]}>
      <Icon icon={icon} size={17} color={colors.ink500} />
    </Pressable>
  );
}

/** Step 1: the route (one or more stops with dates), departure time, trip name and icon. */
export function StepWhere({ state, update }: { state: CreatorState; update: (patch: Partial<CreatorState>) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const suggest = useAction(api.assist.names);
  const [names, setNames] = useState<{ name: string; emoji: string }[]>([]);
  const [naming, setNaming] = useState(false);
  const [departureOpen, setDepartureOpen] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const { stops } = state;
  const start = tripStart(state);
  const end = tripEnd(state);
  const firstPlace = primaryPlace(state);

  function changeStop(index: number, patch: Partial<CreatorStop>) {
    const next = stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop));
    // A stop's new end date pulls an empty/overlapping next start along
    if (patch.endDate && next[index + 1] && (!next[index + 1].startDate || next[index + 1].startDate < patch.endDate)) {
      next[index + 1] = {
        ...next[index + 1],
        startDate: patch.endDate,
        ...(next[index + 1].endDate && next[index + 1].endDate < patch.endDate ? { endDate: patch.endDate } : {}),
      };
    }
    // Default trip name from the first destination
    const extra: Partial<CreatorState> = {};
    if (patch.place && !state.name.trim()) {
      const year = (next[0].startDate || "").slice(0, 4);
      extra.name = `${patch.place.label}${year ? ` ${year}` : ""}`;
    }
    update({ stops: next, ...extra });
  }

  function addStop() {
    const last = stops[stops.length - 1];
    update({
      stops: [...stops, { id: shortId("s"), place: null, startDate: last?.endDate ?? "", endDate: last?.endDate ? plusDays(last.endDate, 3) : "" }],
    });
  }

  function moveStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    // Swap the places, keep the date slots in order
    const next = stops.map((stop) => ({ ...stop }));
    [next[index].place, next[target].place] = [next[target].place, next[index].place];
    update({ stops: next });
  }

  async function suggestNames() {
    if (!firstPlace || naming) return;
    setNaming(true);
    try {
      const found = await suggest({
        draft: {
          destination: stops
            .map((s) => s.place?.label)
            .filter(Boolean)
            .join(" ← "),
          startDate: start,
          endDate: end,
          groupKind: state.groupKind,
          groupName: state.groupName,
        },
        locale,
      });
      setNames(found);
    } catch {
      // optional nicety
    } finally {
      setNaming(false);
    }
  }

  const tripNights = nights(start, end);
  const countries = new Set(stops.map((s) => s.place?.country).filter(Boolean));
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const showDeparture = departureOpen || Boolean(state.departureTime);

  return (
    <View style={{ gap: 28 }}>
      <StepHeader title={t("creator.where.title")} text={t("creator.where.text")} />

      <View style={{ gap: 12 }}>
        {stops.map((stop, index) => (
          <StopCard
            key={stop.id}
            stop={stop}
            index={index}
            count={stops.length}
            minDate={stops[index - 1]?.endDate ?? ""}
            onChange={(patch) => changeStop(index, patch)}
            onMove={(direction) => moveStop(index, direction)}
            onRemove={() => update({ stops: stops.filter((_, i) => i !== index) })}
          />
        ))}
        {stops.length < 12 && (
          <Pressable
            accessibilityRole="button"
            disabled={!stops[stops.length - 1]?.place}
            onPress={addStop}
            style={[styles.addStop, !stops[stops.length - 1]?.place && { opacity: 0.4 }]}
          >
            <Icon icon={Plus} size={16} color={colors.ink700} />
            <Text variant="small" weight="medium" color={colors.ink700}>
              {t("creator.where.addStop")}
            </Text>
          </Pressable>
        )}
        <View style={styles.summary}>
          <Text variant="small" weight="medium" color={colors.ink700} style={{ flexShrink: 1 }}>
            {tripNights !== null
              ? [
                  t("creator.where.days", { count: tripNights + 1 }),
                  ...(stops.length > 1 ? [t("creator.where.stops", { count: stops.length })] : []),
                  ...(countries.size > 1 ? [t("creator.where.countries", { count: countries.size })] : []),
                ].join(" · ")
              : ""}
          </Text>
          {showDeparture ? (
            <View style={styles.inline}>
              <Icon icon={Clock} size={16} color={colors.ink500} />
              <Text variant="small" color={colors.ink500}>
                {t("creator.where.departureTime")}
              </Text>
              <TimeField label={t("creator.where.departureTime")} value={state.departureTime || "08:00"} onChange={(departureTime) => update({ departureTime })} />
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setDepartureOpen(true)} style={styles.inline} hitSlop={6}>
              <Icon icon={Clock} size={16} color={colors.route700} />
              <Text variant="small" weight="medium" color={colors.route700}>
                {t("creator.wizard.addDeparture")}
              </Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={() => setCurrencyOpen(true)} style={styles.inline} hitSlop={6}>
            <Icon icon={Coins} size={16} color={colors.route700} />
            <Text variant="small" weight="medium" color={colors.route700}>
              {`${t("settings.trip.currency")}: ${tripCurrencies({ legacy: false, stops: stops.flatMap((s) => (s.place ? [{ currency: s.place.currency }] : [])), currencies: state.currencies }).join(" · ")}`}
            </Text>
          </Pressable>
          <CurrencyPicker
            key={String(currencyOpen)}
            open={currencyOpen}
            initial={tripCurrencies({ legacy: false, stops: stops.flatMap((s) => (s.place ? [{ currency: s.place.currency }] : [])), currencies: state.currencies })}
            onClose={() => setCurrencyOpen(false)}
            onSave={async (codes) => update({ currencies: codes })}
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={[styles.inline, { justifyContent: "space-between" }]}>
          <Text variant="small" weight="medium" color={colors.ink700}>
            {t("creator.where.nameLabel")}
          </Text>
          {firstPlace && (
            <Pressable accessibilityRole="button" onPress={suggestNames} disabled={naming} style={styles.inline} hitSlop={6}>
              {naming ? <ActivityIndicator size="small" color={colors.route700} /> : <Icon icon={Sparkles} size={16} color={colors.route700} />}
              <Text variant="small" weight="medium" color={colors.route700}>
                {naming ? t("creator.where.thinking") : t("creator.where.suggest")}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.nameRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("creator.where.iconLabel")}
            accessibilityState={{ expanded: iconsOpen }}
            onPress={() => setIconsOpen((open) => !open)}
            style={styles.iconPick}
          >
            <Icon icon={glyphIcon(state.emoji)} size={18} color={colors.ink700} />
          </Pressable>
          <Field
            value={state.name}
            onChangeText={(name) => update({ name })}
            placeholder={t("creator.where.namePlaceholder")}
            maxLength={60}
            large
            style={{ flex: 1 }}
          />
        </View>
        {names.length > 0 && (
          <ChipRow>
            {names.map((option) => (
              <Chip
                key={option.name}
                label={option.name}
                onPress={() => {
                  update({ name: option.name });
                  setNames([]);
                }}
              />
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => setNames([])} style={styles.iconButton}>
              <Icon icon={X} size={16} color={colors.ink500} />
            </Pressable>
          </ChipRow>
        )}
        {iconsOpen && (
          <View style={styles.glyphs} accessibilityRole="radiogroup">
            {TRIP_GLYPHS.map(({ key, Icon: Glyph }) => {
              const active = state.emoji === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={t(`creator.where.icons.${key}` as TKey)}
                  onPress={() => {
                    update({ emoji: key });
                    setIconsOpen(false);
                  }}
                  style={[styles.glyph, active && styles.glyphActive]}
                >
                  <Icon icon={Glyph} size={18} color={active ? colors.chart50 : colors.ink500} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingStart: 14,
    minHeight: 56,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12 },
  stopRow: { flexDirection: "row", gap: 10 },
  rail: { width: 28, alignItems: "center" },
  railLine: { position: "absolute", top: 40, bottom: -18, width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.route300 },
  node: { width: 28, height: 28, borderRadius: 14, marginTop: 12, alignItems: "center", justifyContent: "center" },
  nodeDone: { backgroundColor: colors.route500 },
  nodeOpen: { borderWidth: 2, borderColor: colors.route300, backgroundColor: colors.chart50 },
  cover: { height: 112, backgroundColor: colors.night900, justifyContent: "flex-end" },
  coverText: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 14 },
  change: { backgroundColor: "rgba(241,243,239,0.92)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  stopFoot: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  addStop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    marginStart: 38,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.chart300,
  },
  summary: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingStart: 38, minHeight: 44 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconPick: { width: 52, height: 52, borderRadius: radius.field, backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  glyphs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  glyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  glyphActive: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
});
