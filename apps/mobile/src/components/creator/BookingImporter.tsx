import { api } from "@together/backend/api";
import type { Doc, Id } from "@together/backend/dataModel";
import type { BookingItem } from "@together/shared/booking";
import { colors, radius } from "@together/shared/tokens";
import { useAction, useMutation } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import { BedDouble, CarFront, Check, ClipboardPaste, FileText, FileUp, MapPin, Plane, Ticket, Trash2, Utensils, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { TimeField } from "@/components/ui/TimeField";
import { convex } from "@/lib/convex";
import { errorReason } from "@/lib/convert";
import { fontFor } from "@/lib/fonts";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { uploadToTrip } from "@/lib/upload";

const KIND_ICON: Record<BookingItem["kind"], LucideIcon> = { flight: Plane, lodging: BedDouble, car: CarFront, activity: Ticket, restaurant: Utensils, other: MapPin };
const MAX_BYTES = 15 * 1024 * 1024;

interface PendingImport {
  key: string;
  label: string;
  status: "uploading" | "reading" | "review" | "applying" | "applied" | "failed";
  importId?: Id<"imports">;
  items: (BookingItem & { include: boolean })[];
  message?: string;
}

/** Resolves once the AI has read the import (it leaves "processing"). */
function untilRead(tripId: Id<"trips">, importId: Id<"imports">): Promise<Doc<"imports">> {
  return new Promise((resolve, reject) => {
    const watch = convex.watchQuery(api.imports.get, { tripId, importId });
    const unsubscribe = watch.onUpdate(() => {
      try {
        const row = watch.localQueryResult();
        if (row && row.status !== "processing") {
          unsubscribe();
          resolve(row);
        }
      } catch (error) {
        unsubscribe();
        reject(error);
      }
    });
  });
}

/**
 * Flight tickets, hotel and attraction confirmations (PDF, photo or pasted
 * email): the AI extracts each reservation, the organizer reviews and
 * confirms, then events, places and the home base are created.
 */
export function BookingImporter({ tripId, onApplied }: { tripId: string; onApplied?: (summary: { events: number; places: number; homeBase: boolean }) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const fromFile = useMutation(api.imports.fromFile);
  const fromText = useMutation(api.imports.fromText);
  const applyImport = useAction(api.imports.apply);
  const [imports, setImports] = useState<PendingImport[]>([]);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const id = tripId as Id<"trips">;

  const patch = (key: string, value: Partial<PendingImport>) => setImports((current) => current.map((e) => (e.key === key ? { ...e, ...value } : e)));

  async function extract(key: string, start: () => Promise<Id<"imports">>) {
    patch(key, { status: "reading" });
    try {
      const importId = await start();
      const row = await untilRead(id, importId);
      const items = row.items.map((item) => ({ ...item, include: true }));
      patch(key, {
        status: items.length ? "review" : "failed",
        importId,
        items,
        message: items.length ? undefined : row.error === "none_found" ? t("creator.booking.errors.noneFound") : t("creator.booking.errors.unreadable"),
      });
    } catch (err) {
      const reason = errorReason(err);
      patch(key, {
        status: "failed",
        message:
          reason === "unsupported_type"
            ? t("creator.booking.errors.unsupported")
            : reason === "quota_exceeded"
              ? t("creator.booking.errors.quota")
              : reason === "too_large"
                ? t("creator.booking.errors.tooBig")
                : t("creator.booking.errors.network"),
      });
    }
  }

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    for (const file of result.assets.slice(0, 8)) {
      const key = `${Date.now()}-${file.name}`;
      setImports((current) => [...current, { key, label: file.name, status: "uploading", items: [] }]);
      if ((file.size ?? 0) > MAX_BYTES) {
        patch(key, { status: "failed", message: t("creator.booking.errors.tooBig") });
        continue;
      }
      try {
        const storageId = await uploadToTrip(tripId, file.uri, file.mimeType);
        await extract(key, () => fromFile({ tripId: id, storageId, fileName: file.name, locale }));
      } catch {
        patch(key, { status: "failed", message: t("creator.booking.errors.uploadFailed") });
      }
    }
  }

  async function readText() {
    if (!text.trim()) return;
    const key = `text-${Date.now()}`;
    setImports((current) => [...current, { key, label: t("creator.booking.pastedLabel"), status: "reading", items: [] }]);
    setPasting(false);
    const body = text;
    setText("");
    await extract(key, () => fromText({ tripId: id, text: body, locale }));
  }

  async function apply(entry: PendingImport) {
    if (!entry.importId) return;
    patch(entry.key, { status: "applying" });
    try {
      const items = entry.items.filter((i) => i.include).map(({ include, ...item }) => (void include, item));
      const summary = await applyImport({ tripId: id, importId: entry.importId, items });
      patch(entry.key, {
        status: "applied",
        message:
          t("creator.booking.applied", { count: summary.events }) +
          (summary.places ? t("creator.booking.appliedPlaces", { count: summary.places }) : "") +
          (summary.homeBase ? t("creator.booking.appliedHome") : ""),
      });
      onApplied?.(summary);
    } catch {
      patch(entry.key, { status: "review", message: t("creator.booking.errors.saveFailed") });
    }
  }

  const updateItem = (key: string, index: number, value: Partial<BookingItem & { include: boolean }>) =>
    setImports((current) => current.map((e) => (e.key === key ? { ...e, items: e.items.map((item, i) => (i === index ? { ...item, ...value } : item)) } : e)));

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={pickFiles} style={[styles.source, styles.dashed]}>
          <Icon icon={FileUp} size={24} color={colors.route500} />
          <Text weight="medium" align="center">
            {t("creator.booking.upload.title")}
          </Text>
          <Text variant="caption" color={colors.ink500} align="center">
            {t("creator.booking.upload.text")}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: pasting }} onPress={() => setPasting((open) => !open)} style={[styles.source, pasting && { borderColor: colors.route500 }]}>
          <Icon icon={ClipboardPaste} size={24} color={colors.route500} />
          <Text weight="medium" align="center">
            {t("creator.booking.paste.title")}
          </Text>
          <Text variant="caption" color={colors.ink500} align="center">
            {t("creator.booking.paste.text")}
          </Text>
        </Pressable>
      </View>

      {pasting && (
        <View style={{ gap: 8 }}>
          <Field value={text} onChangeText={setText} placeholder={t("creator.booking.paste.placeholder")} multiline style={{ minHeight: 140, textAlignVertical: "top", fontSize: 14 }} />
          <Button label={t("creator.booking.paste.read")} onPress={readText} disabled={!text.trim()} />
        </View>
      )}

      {imports.map((entry) => {
        const busy = entry.status === "uploading" || entry.status === "reading" || entry.status === "applying";
        return (
          <Card key={entry.key} style={{ overflow: "hidden" }}>
            <View style={styles.entryHead}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.route500} />
              ) : (
                <Icon icon={entry.status === "applied" ? Check : FileText} size={20} color={entry.status === "applied" ? colors.route500 : colors.ink500} />
              )}
              <Text variant="small" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                {entry.label}
              </Text>
              {busy && (
                <Text variant="caption" color={colors.ink500}>
                  {t(`creator.booking.status.${entry.status}` as TKey)}
                </Text>
              )}
            </View>
            {entry.status === "review" && (
              <View style={{ padding: 12, gap: 8 }}>
                {entry.items.map((item, index) => (
                  <View key={index} style={[styles.item, !item.include && { opacity: 0.55, backgroundColor: colors.chart50 }]}>
                    <View style={styles.row}>
                      <Icon icon={KIND_ICON[item.kind] ?? MapPin} size={18} color={colors.route500} />
                      <TextInput
                        value={item.title}
                        onChangeText={(title) => updateItem(entry.key, index, { title })}
                        style={[styles.itemTitle, { fontFamily: fontFor(locale, "medium") }]}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={item.include ? t("creator.booking.exclude") : t("creator.booking.include")}
                        onPress={() => updateItem(entry.key, index, { include: !item.include })}
                        style={styles.toggle}
                      >
                        <Icon icon={item.include ? Trash2 : Check} size={16} color={colors.ink400} />
                      </Pressable>
                    </View>
                    <View style={[styles.row, { flexWrap: "wrap" }]}>
                      <DateField label={t("creator.where.depart")} value={item.startDate} onChange={(startDate) => updateItem(entry.key, index, { startDate })} />
                      {item.startDate ? (
                        <TimeField label={t("trip.schedule.time")} value={item.startTime || "10:00"} onChange={(startTime) => updateItem(entry.key, index, { startTime })} />
                      ) : null}
                      <Text variant="caption" color={colors.ink500}>
                        {t(`creator.booking.kinds.${item.kind}` as TKey)}
                        {item.flightNumber ? ` · ${item.flightNumber}` : ""}
                        {item.confirmationCode ? ` · #${item.confirmationCode}` : ""}
                      </Text>
                    </View>
                    {item.location || item.notes ? (
                      <Text variant="caption" color={colors.ink500} numberOfLines={2}>
                        {[item.location, item.notes].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                ))}
                <Button
                  label={t("creator.booking.add", { count: entry.items.filter((i) => i.include).length })}
                  onPress={() => apply(entry)}
                  disabled={!entry.items.some((i) => i.include)}
                />
              </View>
            )}
            {entry.message ? (
              <Text variant="small" color={entry.status === "failed" ? colors.terra600 : colors.route700} style={{ padding: 12 }}>
                {entry.message}
              </Text>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  source: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 22,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  dashed: { borderStyle: "dashed", borderWidth: 1, borderColor: colors.chart300 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.chart200 },
  item: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.chart200, padding: 10, gap: 6, backgroundColor: colors.paper },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemTitle: { flex: 1, fontSize: 16, color: colors.ink900, textAlign: "auto", paddingVertical: 4 },
  toggle: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
