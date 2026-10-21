import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import type { ChatCandidate } from "@together/shared/types";
import { colors, radius } from "@together/shared/tokens";
import { useAction, useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { type Href, router } from "expo-router";
import { ArrowUp, ChevronRight, Lock, Paperclip, Plus, RotateCcw, Sparkles, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CandidateCard } from "@/components/guide/CandidateCard";
import { InfoSheet } from "@/components/guide/InfoSheet";
import { uploadToTrip } from "@/lib/upload";
import { AddToPollSheet } from "@/components/polls/AddToPollSheet";
import { GuideAvatar } from "@/components/trips/GuideAvatar";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { errorReason } from "@/lib/convert";
import { fontFor } from "@/lib/fonts";
import { useLocale, useT } from "@/lib/i18n";
import { useTrip } from "@/lib/trip";

/** Native tab bar height above the home indicator (content isn't inset for a fixed composer). */
const TAB_BAR = 49;

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.chat.messages>>>[number];

/**
 * The trip guide chat. Sending stores the message and a pending reply that
 * the backend fills in; this screen only subscribes. Chats are private.
 */
export default function Guide() {
  const t = useT();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { id: tripId, config, doc, me, avatarUrl } = useTrip();
  const personal = !me.guest;
  const avatar = doc.ai.avatar?.kind === "bot" ? `bot:${doc.ai.avatar.id}` : avatarUrl;

  const sessions = useQuery(api.chat.sessions, { tripId });
  const [sessionId, setSessionId] = useState<Id<"chatSessions"> | null>(null);
  const rows = useQuery(api.chat.messages, sessionId ? { tripId, sessionId } : "skip");
  const sendMessage = useMutation(api.chat.send);
  const retryReply = useMutation(api.chat.retry);
  const removeSession = useMutation(api.chat.deleteSession);
  const saveCandidateMutation = useMutation(api.chat.saveCandidate);
  const markCandidate = useMutation(api.chat.markCandidate);
  const briefing = useAction(api.placesAi.briefing);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pendingImage, setPendingImage] = useState<{ uri: string; mimeType?: string | null } | null>(null);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [infoTarget, setInfoTarget] = useState<ChatCandidate | null>(null);
  const [infoText, setInfoText] = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const infoCache = useRef(new Map<string, string>());
  const [pollTarget, setPollTarget] = useState<{ label: string; placeId: string; messageId: Id<"chatMessages">; index: number } | null>(null);
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Coming back resumes the latest conversation (a fresh chat is one tap away)
  const [resumed, setResumed] = useState(false);
  if (!resumed && sessions) {
    setResumed(true);
    if (sessions.length) setSessionId(sessions[0]._id);
  }

  // A reply that is still being written shows as a normal message as soon as it has text
  const done = useMemo(() => (rows ?? []).filter((row) => row.status === "done" || (row.status === "pending" && row.role === "assistant" && row.content.length > 0)), [rows]);
  const last = rows?.[rows.length - 1];
  const loading = sending || last?.status === "pending";
  const writing = last?.role === "assistant" && last.status === "pending" && last.content.length > 0;
  const failedReply = last?.role === "assistant" && last.status === "error" ? last : null;
  const shownError = error || failedReply?.content || "";
  const activeSession = sessions?.find((s) => s._id === sessionId) ?? null;
  // Newest first for the inverted list
  const listed = useMemo(() => [...done].reverse(), [done]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;
    setPendingImage({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || loading) return;
    setSending(true);
    setError("");
    try {
      let imageStorageId: Id<"_storage"> | undefined;
      if (pendingImage) {
        try {
          imageStorageId = await uploadToTrip(tripId, pendingImage.uri, pendingImage.mimeType);
        } catch {
          setError(t("ai.errors.uploadFailed"));
          return;
        }
        setPendingImage(null);
      }
      const result = await sendMessage({
        tripId,
        ...(sessionId ? { sessionId } : {}),
        text: trimmed || t("ai.lookAtPhoto"),
        ...(imageStorageId ? { imageStorageId } : {}),
        locale,
      });
      setSessionId(result.sessionId);
      setInput("");
    } catch (err) {
      setError(errorReason(err) === "quota_exceeded" ? t("ai.errors.quota", { limit: 400 }) : t("ai.errors.failed"));
    } finally {
      setSending(false);
    }
  }

  async function retry() {
    if (!failedReply || loading) return;
    setError("");
    await retryReply({ tripId, replyId: failedReply._id, locale }).catch(() => setError(t("ai.errors.failed")));
  }

  function newChat() {
    setSessionId(null);
    setError("");
  }

  function confirmDeleteSession(session: { _id: Id<"chatSessions">; title: string }) {
    Alert.alert(t("ai.deleteChat", { title: session.title }), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await removeSession({ tripId, sessionId: session._id }).catch(() => undefined);
          if (session._id === sessionId) newChat();
        },
      },
    ]);
  }

  function withSaving<T>(key: string, run: () => Promise<T>) {
    setSavingKeys((current) => new Set(current).add(key));
    return run().finally(() =>
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      })
    );
  }

  async function savePlace(row: Row, index: number): Promise<string> {
    const saved = row.candidates?.[index]?.savedPlaceId;
    if (saved) return saved;
    return saveCandidateMutation({ tripId, messageId: row._id, index });
  }

  async function openInfo(candidate: ChatCandidate) {
    setInfoTarget(candidate);
    const cached = infoCache.current.get(candidate.name);
    if (cached) {
      setInfoText(cached);
      return;
    }
    setInfoText("");
    setInfoLoading(true);
    try {
      const text = await briefing({
        tripId,
        name: candidate.name,
        ...(candidate.area ? { area: candidate.area } : {}),
        description: candidate.description,
        why: candidate.why,
        locale,
      });
      infoCache.current.set(candidate.name, text);
      setInfoText(text);
    } catch {
      setInfoText(t("ai.errors.placeInfo"));
    } finally {
      setInfoLoading(false);
    }
  }

  function renderMessage({ item: row }: { item: Row }) {
    const mine = row.role === "user";
    return (
      <View style={{ gap: 10, marginBottom: 16 }}>
        {!mine && (
          <View style={styles.speaker}>
            <GuideAvatar avatar={avatar} emoji={config.ai.emoji} size={18} />
            <Text variant="caption" color={colors.ink500}>
              {config.ai.title}
            </Text>
          </View>
        )}
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          {row.imageUrl ? <Image source={row.imageUrl} style={styles.bubbleImage} contentFit="cover" /> : null}
          <Text color={mine ? colors.chart50 : colors.ink900} selectable>
            {row.content}
          </Text>
        </View>
        {row.candidates?.map((raw, index) => {
          if (raw.dismissed) return null;
          const candidate: ChatCandidate = { ...raw, savedPlaceId: raw.savedPlaceId ?? undefined };
          const key = `${row._id}-${index}`;
          return (
            <CandidateCard
              key={key}
              candidate={candidate}
              busy={savingKeys.has(key)}
              onSave={() => withSaving(key, () => savePlace(row, index)).catch(() => setError(t("common.errors.saveFailed")))}
              onOpenSaved={() => router.push(`/t/${tripId}/place/${candidate.savedPlaceId}` as Href)}
              onPoll={() =>
                withSaving(key, () => savePlace(row, index))
                  .then((placeId) => setPollTarget({ label: candidate.name, placeId, messageId: row._id, index }))
                  .catch(() => setError(t("ai.errors.pollFailed")))
              }
              onInfo={() => openInfo(candidate)}
              onDismiss={() =>
                markCandidate({ tripId, messageId: row._id, index, dismissed: true }).catch(() => setError(t("common.errors.saveFailed")))
              }
            />
          );
        })}
      </View>
    );
  }

  const status = (
    <View style={{ gap: 12, marginBottom: 8 }}>
      {loading && !writing && (
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color={colors.brass500} />
          <Text variant="small" color={colors.ink500}>
            {t("ai.thinking")}
          </Text>
        </View>
      )}
      {shownError ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text variant="small" color={colors.terra600}>
            {shownError}
          </Text>
          {failedReply && (
            <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
              <Icon icon={RotateCcw} size={15} color={colors.chart50} />
              <Text variant="small" weight="medium" color={colors.chart50}>
                {t("common.retry")}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );

  const intro = (
    <View style={{ gap: 12 }}>
      <View style={styles.hero}>
        <View style={{ alignItems: "center" }}>
          <GuideAvatar avatar={avatar} emoji={config.ai.emoji} size={96} />
        </View>
        <Text color="rgba(241,243,239,0.85)" align="center">
          {config.ai.heroBlurb}
        </Text>
      </View>
      {config.ai.suggestedPrompts.map((prompt) => (
        <Pressable key={prompt} accessibilityRole="button" disabled={loading} onPress={() => send(prompt)} style={styles.prompt}>
          <Icon icon={Sparkles} size={16} color={colors.brass500} />
          <Text style={{ flex: 1 }}>{prompt}</Text>
          <Icon icon={ChevronRight} size={16} color={colors.ink300} flip />
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <GuideAvatar avatar={avatar} emoji={config.ai.emoji} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="title" numberOfLines={1}>
              {config.ai.title}
            </Text>
            <Text variant="small" color={colors.ink500} numberOfLines={1}>
              {config.ai.kicker}
            </Text>
          </View>
        </View>
        <View style={styles.note}>
          {personal && <Icon icon={Lock} size={13} color={colors.ink500} />}
          <Text variant="caption" color={colors.ink500} style={{ flex: 1 }}>
            {personal ? t("ai.privateNote") : t("ai.sharedNote")}
          </Text>
        </View>

        {/* Private chats */}
        {(sessions?.length ?? 0) > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionsRow} contentContainerStyle={styles.sessions}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: sessionId === null }} onPress={newChat} style={[styles.session, sessionId === null && styles.sessionActive]}>
              <Icon icon={Plus} size={14} color={sessionId === null ? colors.chart50 : colors.ink700} />
              <Text variant="small" color={sessionId === null ? colors.chart50 : colors.ink700}>
                {t("ai.newChat")}
              </Text>
            </Pressable>
            {sessions!.map((session) => {
              const active = session._id === sessionId;
              return (
                <Pressable
                  key={session._id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityHint={t("ai.deleteChat", { title: session.title })}
                  onPress={() => {
                    setSessionId(session._id);
                    setError("");
                  }}
                  onLongPress={() => confirmDeleteSession(session)}
                  style={[styles.session, active && styles.sessionActive]}
                >
                  <Text variant="small" numberOfLines={1} color={active ? colors.chart50 : colors.ink700} style={{ maxWidth: 160 }}>
                    {session.title}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("ai.deleteChat", { title: session.title })} onPress={() => confirmDeleteSession(session)} hitSlop={8}>
                    <Icon icon={X} size={13} color={active ? colors.route300 : colors.ink300} />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {done.length === 0 && !loading && !shownError ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {sessionId && rows === undefined ? <ActivityIndicator color={colors.ink500} /> : intro}
          </ScrollView>
        ) : (
          <FlatList
            style={styles.list}
            inverted
            data={listed}
            keyExtractor={(row) => row._id}
            renderItem={renderMessage}
            ListHeaderComponent={status}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
        )}

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: keyboard ? 8 : insets.bottom + TAB_BAR + 8 }]}>
          {pendingImage && (
            <View style={styles.attached}>
              <Image source={pendingImage.uri} style={styles.attachedImage} contentFit="cover" accessibilityLabel={t("ai.attachedPhoto")} />
              <Text variant="small" color={colors.ink500} style={{ flex: 1 }}>
                {t("ai.photoWillSend")}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("ai.removePhoto")} onPress={() => setPendingImage(null)} style={styles.roundButton}>
                <Icon icon={X} size={15} color={colors.ink500} />
              </Pressable>
            </View>
          )}
          <View style={styles.inputRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("ai.attachPhoto")} onPress={pickPhoto} style={styles.attach}>
              <Icon icon={Paperclip} size={19} color={colors.ink700} />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={activeSession ? t("ai.continuePlaceholder") : config.ai.inputPlaceholder}
              placeholderTextColor={colors.ink400}
              multiline
              style={[styles.input, { fontFamily: fontFor(locale, "regular") }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ai.send")}
              disabled={loading || (!input.trim() && !pendingImage)}
              onPress={() => send(input)}
              style={[styles.send, (loading || (!input.trim() && !pendingImage)) && { opacity: 0.4 }]}
            >
              <Icon icon={ArrowUp} size={19} color={colors.chart50} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <InfoSheet target={infoTarget} text={infoText} loading={infoLoading} onClose={() => setInfoTarget(null)} />
      {pollTarget && (
        <AddToPollSheet
          open
          onClose={() => setPollTarget(null)}
          label={pollTarget.label}
          placeId={pollTarget.placeId}
          onAdded={() =>
            markCandidate({ tripId, messageId: pollTarget.messageId, index: pollTarget.index, polled: true }).catch(() => setError(t("common.errors.saveFailed")))
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chart50 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  note: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingTop: 8 },
  // The chips row must never be squeezed by a tall message (React Native lets a scroll view shrink by default);
  // only the message list takes what is left.
  sessionsRow: { flexGrow: 0, flexShrink: 0 },
  list: { flex: 1, minHeight: 0 },
  sessions: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  session: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  sessionActive: { backgroundColor: colors.route700, borderColor: colors.route700 },
  listContent: { paddingHorizontal: 20, paddingVertical: 12, gap: 4 },
  speaker: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" },
  bubble: { maxWidth: "85%", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  mine: { alignSelf: "flex-start", backgroundColor: colors.route700, borderBottomStartRadius: 6 },
  theirs: {
    alignSelf: "flex-end",
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    borderBottomEndRadius: 6,
  },
  bubbleImage: { width: 220, height: 160, borderRadius: 14 },
  thinking: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
  },
  error: { backgroundColor: colors.terra100, borderRadius: radius.card, padding: 14, gap: 10 },
  retry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 42, borderRadius: radius.field, backgroundColor: colors.ink900 },
  hero: { backgroundColor: colors.night950, borderRadius: 28, padding: 24, gap: 18 },
  prompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
  },
  composer: { paddingHorizontal: 16, paddingTop: 8, gap: 8, backgroundColor: colors.chart50 },
  attached: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: radius.card, backgroundColor: colors.paper },
  attachedImage: { width: 52, height: 52, borderRadius: 12 },
  roundButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  attach: { width: 48, height: 48, borderRadius: radius.field, backgroundColor: colors.chart100, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.chart200,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 16,
    color: colors.ink900,
    textAlign: "auto",
  },
  send: { width: 48, height: 48, borderRadius: radius.field, backgroundColor: colors.ink900, alignItems: "center", justifyContent: "center" },
});
