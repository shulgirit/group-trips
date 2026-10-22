import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { intlLocale } from "@together/i18n/format";
import { colors, radius } from "@together/shared/tokens";
import { useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Stack, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { BedDouble, FileImage, FileText, ImagePlus, Lock, Paperclip, Plane, Ticket, Trash2, Upload, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { type TKey, useLocale, useT } from "@/lib/i18n";
import { uploadToTrip } from "@/lib/upload";
import { useTrip } from "@/lib/trip";

const MAX_FILE_MB = 20;

type Kind = "flight" | "ticket" | "stay" | "pdf" | "image" | "file";
const KIND: Record<Kind, { icon: LucideIcon; label: TKey }> = {
  flight: { icon: Plane, label: "money.docs.kind.flight" },
  ticket: { icon: Ticket, label: "money.docs.kind.ticket" },
  stay: { icon: BedDouble, label: "money.docs.kind.stay" },
  pdf: { icon: FileText, label: "money.docs.kind.pdf" },
  image: { icon: FileImage, label: "money.docs.kind.image" },
  file: { icon: Paperclip, label: "money.docs.kind.file" },
};

/** Same guess as the web: the file name first (boarding pass, hotel…), then its type. */
function kindOf(name: string, contentType: string): Kind {
  const n = name.toLowerCase();
  if (/boarding|flight|airline|e-?ticket|itinerary|טיסה|עליה למטוס|vuelo|embarque|رحلة|طيران/.test(n)) return "flight";
  if (/hotel|booking|airbnb|villa|hostel|apartment|resort|מלון|וילה|לינה|דירה|alojamiento|فندق/.test(n)) return "stay";
  if (/ticket|tour|museum|entry|\bpass\b|כרטיס|כניסה|entrada|تذكرة/.test(n)) return "ticket";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.includes("pdf")) return "pdf";
  return "file";
}

const bareName = (name: string) => (name.lastIndexOf(".") > 0 ? name.slice(0, name.lastIndexOf(".")) : name);
const sizeLabel = (bytes: number) => (bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1_000))}KB`);

/** The travel wallet: shared documents, and a private area for real accounts. */
export default function Documents() {
  const t = useT();
  const { locale } = useLocale();
  const { id, me } = useTrip();
  const rows = useQuery(api.documents.list, { tripId: id });
  const create = useMutation(api.documents.create);
  const remove = useMutation(api.documents.remove);
  const [tab, setTab] = useState<"shared" | "private">("shared");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const personal = !me.guest;

  const shared = rows?.filter((d) => d.visibility === "shared");
  const mine = rows?.filter((d) => d.visibility === "private");
  const list = tab === "shared" ? shared : mine;
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short" });

  async function upload(file: { uri: string; name: string; mimeType?: string | null; size?: number | null }) {
    if ((file.size ?? 0) > MAX_FILE_MB * 1_000_000) {
      setMessage(t("money.docs.errors.tooLarge", { max: MAX_FILE_MB }));
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const storageId = await uploadToTrip(id, file.uri, file.mimeType);
      await create({ tripId: id, storageId: storageId as Id<"_storage">, name: file.name, visibility: tab });
    } catch (error) {
      console.warn("[documents] upload failed", error);
      setMessage(t("money.docs.errors.upload"));
    } finally {
      setUploading(false);
    }
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await upload({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await upload({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize,
    });
  }

  async function open(url: string | null) {
    if (!url) {
      setMessage(t("money.docs.errors.open"));
      return;
    }
    await WebBrowser.openBrowserAsync(url).catch(() => setMessage(t("money.docs.errors.open")));
  }

  function confirmDelete(documentId: Id<"documents">, name: string) {
    Alert.alert(t("common.delete"), name, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("money.confirmDelete"),
        style: "destructive",
        onPress: () => remove({ tripId: id, documentId }).catch(() => setMessage(t("money.docs.errors.delete"))),
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: t("money.docs.title") }} />
      <Screen edges={[]}>
        {/* Shared / private */}
        <View accessibilityRole="tablist" style={styles.tabs}>
          {(
            [
              { key: "shared", label: t("money.docs.tabShared"), count: shared?.length ?? 0 },
              { key: "private", label: t("money.docs.tabPrivate"), count: personal ? (mine?.length ?? 0) : 0 },
            ] as const
          ).map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                {item.key === "private" && <Icon icon={Lock} size={14} color={active ? colors.chart50 : colors.ink500} />}
                <Text variant="small" weight="medium" color={active ? colors.chart50 : colors.ink500} numberOfLines={1}>
                  {item.label}
                  {item.count ? ` · ${item.count}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "private" && !personal ? (
          <Card style={styles.empty}>
            <Icon icon={Lock} size={24} color={colors.ink700} />
            <Text variant="headline" weight="medium" align="center">
              {t("money.docs.privateNeedsSignIn")}
            </Text>
            <Text variant="small" color={colors.ink500} align="center">
              {t("money.docs.privateExplain")}
            </Text>
            <Button label={t("product.account.title")} onPress={() => router.push("/account")} />
          </Card>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  icon={Upload}
                  label={uploading ? t("money.docs.uploading") : tab === "shared" ? t("money.docs.uploadShared") : t("money.docs.uploadPrivate")}
                  onPress={pickFile}
                  busy={uploading}
                  style={{ flex: 1 }}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={t("money.docs.kind.image")} disabled={uploading} onPress={pickPhoto} style={styles.photoButton}>
                  <Icon icon={ImagePlus} size={20} />
                </Pressable>
              </View>
              <Text variant="caption" color={colors.ink500} align="center">
                {t("money.docs.uploadHint", { max: MAX_FILE_MB })}
              </Text>
            </View>

            {message ? (
              <View accessibilityRole="alert" style={styles.error}>
                <Text variant="small" color={colors.terra600}>
                  {message}
                </Text>
              </View>
            ) : null}

            {list === undefined ? (
              <ActivityIndicator color={colors.ink500} style={{ marginTop: 24 }} />
            ) : list.length === 0 ? (
              <Card style={styles.empty}>
                <Icon icon={tab === "shared" ? Ticket : Lock} size={26} color={colors.ink400} />
                <Text variant="headline" weight="medium" align="center">
                  {tab === "shared" ? t("money.docs.emptySharedTitle") : t("money.docs.emptyPrivateTitle")}
                </Text>
                <Text variant="small" color={colors.ink500} align="center">
                  {tab === "shared" ? t("money.docs.emptySharedDescription") : t("money.docs.emptyPrivateDescription")}
                </Text>
              </Card>
            ) : (
              list.map((doc) => {
                const kind = KIND[kindOf(doc.name, doc.contentType)];
                return (
                  <Card key={doc._id} style={styles.pass}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("money.docs.openFile", { name: doc.name })}
                      onPress={() => open(doc.url)}
                      style={styles.passMain}
                    >
                      <View style={styles.stub}>
                        <Icon icon={kind.icon} size={22} color={colors.chart50} />
                        <Text variant="caption" color="rgba(241,243,239,0.8)" align="center">
                          {t(kind.label)}
                        </Text>
                      </View>
                      <View style={styles.passBody}>
                        <Text weight="medium" numberOfLines={1}>
                          {bareName(doc.name)}
                        </Text>
                        <Text variant="small" color={colors.ink500} numberOfLines={1}>
                          {doc.ownerName || t("money.docs.someone")}
                        </Text>
                        <Text variant="caption" color={colors.ink400}>
                          {dateFormat.format(new Date(doc.createdAt))} · {sizeLabel(doc.size)}
                        </Text>
                      </View>
                    </Pressable>
                    {doc.mine && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("common.delete")}
                        onPress={() => confirmDelete(doc._id, doc.name)}
                        style={styles.trash}
                        hitSlop={6}
                      >
                        <Icon icon={Trash2} size={17} color={colors.ink300} />
                      </Pressable>
                    )}
                  </Card>
                );
              })
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
  tabActive: { backgroundColor: colors.ink900 },
  empty: { padding: 24, gap: 10, alignItems: "center" },
  error: { backgroundColor: colors.terra100, borderRadius: radius.card, padding: 12 },
  photoButton: {
    width: 48,
    height: 48,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  pass: { flexDirection: "row", overflow: "hidden" },
  passMain: { flex: 1, flexDirection: "row" },
  stub: { width: 72, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16, backgroundColor: colors.route700 },
  passBody: { flex: 1, gap: 3, paddingHorizontal: 14, paddingVertical: 12, borderStartWidth: 1, borderStyle: "dashed", borderStartColor: colors.chart300 },
  trash: { width: 48, alignItems: "center", justifyContent: "center" },
});
