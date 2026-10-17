"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { uploadToTrip } from "@/lib/upload";
import {
  ArrowUp,
  CalendarPlus,
  Check,
  ChevronRight,
  Globe,
  Heart,
  Languages,
  Lock,
  MapPinned,
  Paperclip,
  RotateCcw,
  ScanText,
  Sparkles,
  Star,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { AddToPollSheet } from "@/components/polls/AddToPollSheet";
import { Companion } from "@/components/ai/Companion";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useSession } from "@/components/providers/SessionProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { useLocale, useT, type TKey } from "@/i18n";
import { formatNumber } from "@together/i18n/format";
import {
  PLACE_CATEGORIES,
  type ChatCandidate,
  type ChatMessage,
  type PlaceCategory,
} from "@together/shared/types";


/** What the guide's tools really do (same list as the landing page) */
const AI_CAPS: { key: string; Icon: LucideIcon }[] = [
  { key: "places", Icon: MapPinned },
  { key: "plan", Icon: CalendarPlus },
  { key: "poll", Icon: Vote },
  { key: "read", Icon: ScanText },
  { key: "group", Icon: Users },
  { key: "language", Icon: Languages },
];

export default function AiPage() {
  const { personal } = useSession();
  const trip = useTrip();
  const { prefix, id: tripRef } = trip;
  const tripId = tripRef as Id<"trips">;
  const t = useT();
  const { locale } = useLocale();

  // Live chat data — the guide's reply streams into a pending message
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
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [infoTarget, setInfoTarget] = useState<ChatCandidate | null>(null);
  const [infoText, setInfoText] = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const infoCache = useRef(new Map<string, string>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<{
    previewUrl: string;
    blob: Blob;
  } | null>(null);

  const done = useMemo(() => (rows ?? []).filter((row) => row.status === "done"), [rows]);
  const messages: (ChatMessage & { id: Id<"chatMessages"> })[] = useMemo(
    () =>
      done.map((row) => ({
        id: row._id,
        role: row.role,
        content: row.content,
        ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
        ...(row.candidates
          ? { candidates: row.candidates.map((candidate) => ({ ...candidate, savedPlaceId: candidate.savedPlaceId ?? undefined })) }
          : {}),
      })),
    [done]
  );
  const last = rows?.[rows.length - 1];
  const loading = sending || last?.status === "pending";
  const failedReply = last?.role === "assistant" && last.status === "error" ? last : null;
  const shownError = error || failedReply?.content || "";
  const canRetry = Boolean(failedReply);

  /** Shrinks a photo to phone-friendly size before upload. */
  async function preparePhoto(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (!blob) throw new Error("compress_failed");
      setPendingImage({ previewUrl: URL.createObjectURL(blob), blob });
    } catch {
      setError(t("ai.errors.photoRead"));
    }
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
  const [pollTarget, setPollTarget] = useState<{
    label: string;
    placeId: string;
    messageIndex: number;
    candidateIndex: number;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeSession = useMemo(() => sessions?.find((s) => s._id === sessionId) ?? null, [sessions, sessionId]);

  // Coming back to the concierge resumes the latest conversation instead
  // of a blank screen (a fresh chat is always one tap away).
  const autoResumed = useRef(false);
  useEffect(() => {
    if (autoResumed.current || !sessions) return;
    autoResumed.current = true;
    if (sessionId === null && sessions.length) setSessionId(sessions[0]._id);
  }, [sessions, sessionId]);

  // Follow the conversation as replies arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows?.length, last?.status]);

  function openSession(session: { _id: Id<"chatSessions"> }) {
    setSessionId(session._id);
    setError("");
  }

  function newChat() {
    setSessionId(null);
    setError("");
  }

  async function deleteSession(id: Id<"chatSessions">) {
    await removeSession({ tripId, sessionId: id }).catch(() => undefined);
    if (id === sessionId) newChat();
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || loading) return;
    setSending(true);
    setError("");
    try {
      // Upload the attached photo first so the guide can see it
      let imageStorageId: Id<"_storage"> | undefined;
      if (pendingImage) {
        try {
          imageStorageId = await uploadToTrip(tripId, pendingImage.blob);
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
      const code = (err as { data?: { detail?: string } }).data?.detail;
      setError(code === "quota_exceeded" ? t("ai.errors.quota", { limit: 400 }) : t("ai.errors.failed"));
    } finally {
      setSending(false);
    }
  }

  async function retry() {
    if (!failedReply || loading) return;
    setError("");
    await retryReply({ tripId, replyId: failedReply._id, locale }).catch(() => setError(t("ai.errors.failed")));
  }

  function candidateKey(messageIndex: number, candidateIndex: number) {
    return `${messageIndex}-${candidateIndex}`;
  }

  async function updateCandidate(messageIndex: number, candidateIndex: number, patch: Pick<ChatCandidate, "dismissed" | "polled">) {
    const message = messages[messageIndex];
    if (!message) return;
    await markCandidate({ tripId, messageId: message.id, index: candidateIndex, ...patch }).catch(() =>
      setError(t("common.errors.saveFailed"))
    );
  }

  async function persistCandidatePlace(messageIndex: number, candidateIndex: number, candidate: ChatCandidate): Promise<string> {
    if (candidate.savedPlaceId) return candidate.savedPlaceId;
    return saveCandidateMutation({ tripId, messageId: messages[messageIndex].id, index: candidateIndex });
  }

  async function saveCandidate(candidate: ChatCandidate, messageIndex: number, candidateIndex: number) {
    const key = candidateKey(messageIndex, candidateIndex);
    if (savingKeys.has(key) || candidate.savedPlaceId) return;
    setSavingKeys((current) => new Set(current).add(key));
    try {
      await persistCandidatePlace(messageIndex, candidateIndex, candidate);
    } catch {
      setError(t("common.errors.saveFailed"));
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  /** Saves the place (if needed), then opens the poll chooser sheet. */
  async function pollCandidate(candidate: ChatCandidate, messageIndex: number, candidateIndex: number) {
    const key = candidateKey(messageIndex, candidateIndex);
    if (savingKeys.has(key)) return;
    setSavingKeys((current) => new Set(current).add(key));
    try {
      const placeId = await persistCandidatePlace(messageIndex, candidateIndex, candidate);
      setPollTarget({ label: candidate.name, placeId, messageIndex, candidateIndex });
    } catch {
      setError(t("ai.errors.pollFailed"));
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      {/* The guide, present: its living orb beside its name */}
      <header className="mb-4 flex items-center gap-4">
        <Companion size={64} state={loading ? "thinking" : "idle"} ground="page" label={trip.ai.title} glyph={trip.ai.emoji} avatar={trip.ai.avatar} />
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[1.75rem] font-medium leading-tight text-ink-900">
            {trip.ai.title}
          </h1>
          <p className="mt-0.5 truncate text-sm text-ink-500">{trip.ai.kicker}</p>
        </div>
      </header>
      <p className="mb-4 flex items-start gap-1.5 text-sm leading-relaxed text-ink-500">
        {personal && (
          <Lock
            size={14}
            strokeWidth={STROKE}
            aria-hidden
            className="mt-[3px] shrink-0"
          />
        )}
        <span>{personal ? t("ai.privateNote") : t("ai.sharedNote")}</span>
      </p>

      {/* Private session bar */}
      {personal && (
        <div className="-mx-4 mb-4 overflow-x-auto px-4">
          <div className="flex w-max items-center gap-2">
            <button
              type="button"
              onClick={newChat}
              className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition ${
                sessionId === null
                  ? "border-sea-700 bg-sea-700 text-cream-50"
                  : "border-cream-200 bg-white text-ink-700"
              }`}
            >
              {t("ai.newChat")}
            </button>
            {sessions?.map((session) => (
              <span
                key={session._id}
                className={`flex items-center rounded-full border ${
                  sessionId === session._id
                    ? "border-sea-700 bg-sea-700"
                    : "border-cream-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => openSession(session)}
                  className={`max-w-40 truncate whitespace-nowrap py-2 pe-1.5 ps-3.5 text-sm transition ${
                    sessionId === session._id ? "text-cream-50" : "text-ink-700"
                  }`}
                >
                  <bdi>{session.title}</bdi>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSession(session._id)}
                  aria-label={t("ai.deleteChat", { title: session.title })}
                  className={`flex items-center py-2 pe-3 ps-1 ${
                    sessionId === session._id ? "text-sea-200" : "text-ink-300"
                  }`}
                >
                  <X size={13} strokeWidth={STROKE} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {!personal && (
        <Link
          href={`${prefix}/settings`}
          className="mb-4 flex items-center gap-2 rounded-2xl border border-cream-200 bg-white px-4 py-3 text-sm text-ink-700"
        >
          <Lock size={15} strokeWidth={STROKE} aria-hidden className="shrink-0 text-lemon-600" />
          <span className="flex-1">{t("ai.signInForHistory")}</span>
          <ChevronRight
            size={16}
            strokeWidth={STROKE}
            aria-hidden
            className="shrink-0 text-ink-300 rtl:rotate-180"
          />
        </Link>
      )}

      <div className="flex-1 space-y-4">
        {messages.length === 0 && (
          <>
            <div className="rounded-[1.75rem] bg-night-950 px-6 pb-6 pt-8 text-cream-50">
              <Companion size={112} ground="night" interactive glyph={trip.ai.emoji} avatar={trip.ai.avatar} className="mx-auto" />
              <p className="mx-auto mt-5 max-w-sm text-center text-[15px] leading-relaxed text-cream-50/85">
                {trip.ai.heroBlurb}
              </p>
              <p className="mt-6 text-xs text-cream-50/55">{t("ai.canDo")}</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                {AI_CAPS.map(({ key, Icon }) => (
                  <li key={key} className="flex items-center gap-2.5 text-sm text-cream-50/85">
                    <Icon size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-brass-300" />
                    <span className="leading-snug">{t(`landing.ai.caps.${key}.title` as TKey)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="space-y-2">
              {trip.ai.suggestedPrompts.map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => send(prompt)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-chart-200 bg-white px-4 py-3.5 text-start text-[15px] text-ink-900 transition active:scale-[0.99] active:bg-chart-50"
                  >
                    <Sparkles size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-brass-500" />
                    <span className="flex-1">{prompt}</span>
                    <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {messages.map((message, messageIndex) => (
          <div key={messageIndex}>
            {message.role === "assistant" && (
              <p className="mb-1.5 ms-auto flex w-fit items-center gap-2 text-xs text-ink-500">
                {trip.ai.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar
                  <img src={trip.ai.avatar} alt="" className="h-5 w-5 rounded-full bg-night-900 object-cover" />
                ) : (
                  <span aria-hidden className="companion-dot" />
                )}
                {trip.ai.title}
              </p>
            )}
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-3 leading-relaxed ${
                message.role === "user"
                  ? "me-auto rounded-es-md bg-sea-700 text-cream-50"
                  : "card ms-auto w-fit rounded-ee-md text-ink-900"
              }`}
            >
              {message.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={message.imageUrl}
                  alt=""
                  className="mb-2 max-h-52 w-full rounded-2xl object-cover"
                />
              )}
              <bdi>{message.content}</bdi>
            </div>

            {message.candidates && message.candidates.length > 0 && (
              <ul className="mt-3 space-y-3">
                {message.candidates.map((candidate, candidateIndex) => {
                  if (candidate.dismissed) return null;
                  const key = candidateKey(messageIndex, candidateIndex);
                  const categoryKey = (
                    candidate.category in PLACE_CATEGORIES
                      ? candidate.category
                      : "other"
                  ) as PlaceCategory;
                  return (
                    <li key={key} className="card overflow-hidden">
                      {candidate.imageUrl && (
                        <div className="relative aspect-[16/8]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={candidate.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          {!candidate.imageUrl && (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cream-200 text-sea-700">
                              <CategoryIcon category={categoryKey} size={20} />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg font-normal text-ink-900">
                              <bdi>{candidate.name}</bdi>
                            </p>
                            <p className="text-sm text-ink-500">
                              {t(`trip.categories.${categoryKey}`)}
                              {candidate.area ? ` · ${candidate.area}` : ""}
                              {candidate.priceNotes
                                ? ` · ${candidate.priceNotes}`
                                : ""}
                            </p>
                            {candidate.rating && (
                              <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-700">
                                <Star
                                  size={13}
                                  strokeWidth={STROKE}
                                  aria-hidden
                                  className="text-lemon-600"
                                />
                                <span className="numerals">{candidate.rating}</span>
                                {candidate.ratingCount
                                  ? ` · ${t("ai.reviews", {
                                      count: candidate.ratingCount,
                                      n: formatNumber(candidate.ratingCount, locale),
                                    })}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateCandidate(messageIndex, candidateIndex, {
                              dismissed: true,
                            })
                          }
                          aria-label={t("ai.dismiss")}
                          className="p-1 text-ink-300"
                        >
                          <X size={16} strokeWidth={STROKE} aria-hidden />
                        </button>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-ink-700">
                        <bdi>{candidate.description}</bdi>
                      </p>
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-terra-600">
                        <Heart
                          size={14}
                          strokeWidth={STROKE}
                          aria-hidden
                          className="mt-[3px] shrink-0"
                        />
                        <span>{candidate.why}</span>
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {candidate.savedPlaceId ? (
                          <Link
                            href={`${prefix}/places/${candidate.savedPlaceId}`}
                            className="btn gap-1.5 rounded-2xl bg-sea-100 px-4 py-2.5 text-sm text-sea-700"
                          >
                            <Check size={15} strokeWidth={STROKE} aria-hidden />
                            {t("ai.saved")}
                            <ChevronRight
                              size={15}
                              strokeWidth={STROKE}
                              aria-hidden
                              className="rtl:rotate-180"
                            />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              saveCandidate(
                                candidate,
                                messageIndex,
                                candidateIndex
                              )
                            }
                            disabled={savingKeys.has(key)}
                            className="btn-primary px-4 py-2.5 text-sm"
                          >
                            {savingKeys.has(key)
                              ? t("common.saving")
                              : t("ai.savePlace")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            pollCandidate(candidate, messageIndex, candidateIndex)
                          }
                          disabled={savingKeys.has(key)}
                          className={`inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-sm transition active:scale-[0.98] ${
                            candidate.polled
                              ? "border-lemon-300 bg-lemon-100 text-ink-700"
                              : "border-cream-200 bg-white text-ink-700"
                          } disabled:opacity-70`}
                        >
                          {candidate.polled ? (
                            <Check size={15} strokeWidth={STROKE} aria-hidden />
                          ) : (
                            <Vote size={15} strokeWidth={STROKE} aria-hidden />
                          )}
                          {candidate.polled ? t("ai.inPoll") : t("ai.toPoll")}
                        </button>
                        <button
                          type="button"
                          onClick={() => openInfo(candidate)}
                          className="rounded-2xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm text-ink-700 transition active:scale-[0.98]"
                        >
                          {t("ai.tellMore")}
                        </button>
                        {candidate.website && (
                          <a
                            href={candidate.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("ai.website")}
                            className="flex items-center rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-ink-700"
                          >
                            <Globe size={16} strokeWidth={STROKE} aria-hidden />
                          </a>
                        )}
                      </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}

        {loading && (
          <div className="ms-auto flex w-fit items-center gap-3 rounded-3xl rounded-ee-md border border-chart-200 bg-white py-2 pe-4 ps-2 text-ink-500">
            <Companion size={32} state="thinking" ground="white" avatar={trip.ai.avatar} />
            <span className="inline-flex gap-1 text-sm">
              {t("ai.thinking")}
              <span className="animate-pulse">…</span>
            </span>
          </div>
        )}

        {shownError && (
          <div
            role="alert"
            className="rounded-2xl border border-terra-200 bg-terra-100 px-4 py-3 text-sm text-terra-600"
          >
            {shownError}
            {canRetry && (
              <button
                type="button"
                onClick={retry}
                className="btn-primary mt-3 w-full gap-1.5 py-2.5 text-sm"
              >
                <RotateCcw size={15} strokeWidth={STROKE} aria-hidden />
                {t("common.retry")}
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-24 mt-4">
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-cream-200 bg-white p-2 shadow-[var(--shadow-card)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.previewUrl}
              alt={t("ai.attachedPhoto")}
              className="h-14 w-14 rounded-xl object-cover"
            />
            <span className="flex-1 text-sm text-ink-500">
              {t("ai.photoWillSend")}
            </span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label={t("ai.removePhoto")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-100 text-ink-500"
            >
              <X size={15} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) preparePhoto(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={t("ai.attachPhoto")}
            className="btn-soft px-3.5 shadow-[var(--shadow-card)]"
          >
            <Paperclip size={19} strokeWidth={STROKE} aria-hidden />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeSession ? t("ai.continuePlaceholder") : trip.ai.inputPlaceholder
            }
            className="field min-w-0 flex-1 py-3.5 shadow-[var(--shadow-card)]"
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && !pendingImage)}
            aria-label={t("ai.send")}
            className="btn-primary px-5"
          >
            <ArrowUp size={19} strokeWidth={STROKE} aria-hidden />
          </button>
        </form>
      </div>

      {/* "Tell me more" sheet — stays on top of the cards */}
      {infoTarget && (
        <BottomSheet
          open
          onClose={() => setInfoTarget(null)}
          title={infoTarget.name}
        >
          {infoTarget.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={infoTarget.imageUrl}
              alt=""
              className="mb-3 aspect-[16/8] w-full rounded-2xl object-cover"
            />
          )}
          <p className="flex items-center gap-1 text-sm text-ink-500">
            {infoTarget.area ?? ""}
            {infoTarget.rating && (
              <>
                {infoTarget.area ? " · " : ""}
                <Star
                  size={13}
                  strokeWidth={STROKE}
                  aria-hidden
                  className="text-lemon-600"
                />
                <span className="numerals">{infoTarget.rating}</span>
                {infoTarget.ratingCount
                  ? ` (${formatNumber(infoTarget.ratingCount, locale)})`
                  : ""}
              </>
            )}
          </p>
          {infoLoading ? (
            <div className="mt-3 space-y-2" aria-label={t("ai.loadingInfo")}>
              <div className="h-4 w-full animate-pulse rounded bg-cream-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-cream-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-cream-200" />
            </div>
          ) : (
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">
              {infoText}
            </p>
          )}
          <div className="h-4" />
        </BottomSheet>
      )}

      {pollTarget && (
        <AddToPollSheet
          open
          onClose={() => setPollTarget(null)}
          label={pollTarget.label}
          placeId={pollTarget.placeId}
          onAdded={() =>
            updateCandidate(
              pollTarget.messageIndex,
              pollTarget.candidateIndex,
              { polled: true }
            )
          }
        />
      )}
    </div>
  );
}
