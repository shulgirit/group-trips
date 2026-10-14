"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Globe,
  Heart,
  Lock,
  Paperclip,
  RotateCcw,
  Star,
  Vote,
  X,
} from "lucide-react";
import { AddToPollSheet } from "@/components/polls/AddToPollSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { addPlace } from "@/lib/db";
import { useFamilies } from "@/lib/hooks";
import { db, storage, apiFetch } from "@/lib/firebase/client";
import { useTrip } from "@/components/providers/TripProvider";
import { CategoryIcon, Glyph, STROKE } from "@/components/ui/Icon";
import { useLocale, useT } from "@/i18n";
import { formatNumber } from "@/i18n/format";
import {
  PLACE_CATEGORIES,
  type ChatCandidate,
  type ChatMessage,
  type ChatSession,
  type PlaceCategory,
} from "@/types";


export default function AiPage() {
  const { ready, user, personal, profile, epoch } = useFirebase();
  const trip = useTrip();
  const { path: tripPath, prefix, id: tripId } = trip;
  const { families } = useFamilies();
  const t = useT();
  const { locale } = useLocale();

  // "Mika from the Tal family" — so the servant knows who it's talking to
  const speaker = useMemo(() => {
    if (!personal) return undefined;
    const family = families?.find((f) => f.id === profile?.familyId);
    const memberName = family?.members.find(
      (m) => m.id === profile?.memberId
    )?.name;
    const name = memberName ?? user?.displayName;
    if (!name) return undefined;
    return family ? t("ai.speaker", { name, family: family.name }) : name;
  }, [personal, families, profile, user, t]);

  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [canRetry, setCanRetry] = useState(false);
  const [infoTarget, setInfoTarget] = useState<ChatCandidate | null>(null);
  const [infoText, setInfoText] = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const infoCache = useRef(new Map<string, string>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<{
    previewUrl: string;
    blob: Blob;
  } | null>(null);

  /** Shrinks a photo to phone-friendly size before upload. */
  async function preparePhoto(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.8)
      );
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
      const response = await apiFetch("/api/ai/place-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name,
          area: candidate.area,
          description: candidate.description,
          why: candidate.why,
          tripId,
          locale,
        }),
      });
      if (!response.ok) throw new Error("failed");
      const { text } = await response.json();
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

  // Private session list (Google users only)
  useEffect(() => {
    if (!ready || !user || !personal) {
      setSessions(null);
      return;
    }
    return onSnapshot(
      query(
        collection(db(), `${tripPath}/chatSessions`),
        where("ownerUid", "==", user.uid)
      ),
      (snap) =>
        setSessions(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as ChatSession)
            .sort((a, b) => b.updatedAt - a.updatedAt)
        ),
      () => setSessions([])
    );
  }, [ready, user, personal, epoch]);

  const activeSession = useMemo(
    () => sessions?.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );

  // Coming back to the concierge resumes the latest conversation instead
  // of a blank screen (a fresh chat is always one tap away).
  const autoResumed = useRef(false);
  useEffect(() => {
    if (autoResumed.current || !sessions?.length) return;
    if (sessionId !== null || messages.length > 0) {
      autoResumed.current = true;
      return;
    }
    autoResumed.current = true;
    setSessionId(sessions[0].id);
    setMessages(sessions[0].messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  function openSession(session: ChatSession) {
    setSessionId(session.id);
    setMessages(session.messages);
    setError("");
  }

  function newChat() {
    setSessionId(null);
    setMessages([]);
    setError("");
  }

  async function persist(
    nextMessages: ChatMessage[],
    knownSessionId: string | null = sessionId
  ): Promise<string | null> {
    if (!personal || !user) return null;
    try {
      if (knownSessionId) {
        await updateDoc(
          doc(db(), `${tripPath}/chatSessions/${knownSessionId}`),
          {
            messages: nextMessages,
            updatedAt: Date.now(),
          }
        );
        return knownSessionId;
      }
      const firstUser = nextMessages.find((m) => m.role === "user");
      const ref = await addDoc(collection(db(), `${tripPath}/chatSessions`), {
        ownerUid: user.uid,
        title: (firstUser?.content ?? t("ai.untitledChat")).slice(0, 40),
        messages: nextMessages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setSessionId(ref.id);
      return ref.id;
    } catch {
      // Persistence is best-effort; the chat keeps working in memory
      return knownSessionId;
    }
  }

  async function deleteSession(id: string) {
    await deleteDoc(doc(db(), `${tripPath}/chatSessions/${id}`)).catch(
      () => undefined
    );
    if (id === sessionId) newChat();
  }

  async function requestReply(
    thread: ChatMessage[],
    activeSessionId: string | null
  ) {
    setLoading(true);
    setError("");
    setCanRetry(false);
    try {
      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: thread.map(({ role, content, imageUrl }) => ({
            role,
            content,
            imageUrl,
          })),
          speaker,
          tripId,
          locale,
        }),
      });
      if (!response.ok) throw new Error("ai_failed");
      const data: { reply: string; candidates: ChatCandidate[] } =
        await response.json();

      const withReply: ChatMessage[] = [
        ...thread,
        {
          role: "assistant",
          content: data.reply,
          candidates: data.candidates,
        },
      ];
      setMessages(withReply);
      await persist(withReply, activeSessionId);
    } catch {
      setError(t("ai.errors.timeout"));
      setCanRetry(true);
    } finally {
      setLoading(false);
      queueMicrotask(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || loading) return;

    // Upload the attached photo first so the servant can see it
    let imageUrl: string | undefined;
    if (pendingImage) {
      try {
        const path = `${tripPath}/photos/chat/${user?.uid ?? "anon"}/${Date.now()}.jpg`;
        const fileRef = storageRef(storage(), path);
        await uploadBytes(fileRef, pendingImage.blob, {
          contentType: "image/jpeg",
        });
        imageUrl = await getDownloadURL(fileRef);
      } catch {
        setError(t("ai.errors.uploadFailed"));
        return;
      }
      setPendingImage(null);
    }

    const withUser: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: trimmed || t("ai.lookAtPhoto"),
        ...(imageUrl ? { imageUrl } : {}),
      },
    ];
    setMessages(withUser);
    setInput("");
    queueMicrotask(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );
    // Save the question right away, so leaving mid-answer loses nothing
    const activeSessionId = await persist(withUser);
    await requestReply(withUser, activeSessionId);
  }

  async function retry() {
    if (loading || !messages.length) return;
    await requestReply(messages, sessionId);
  }

  function candidateKey(messageIndex: number, candidateIndex: number) {
    return `${messageIndex}-${candidateIndex}`;
  }

  async function updateCandidate(
    messageIndex: number,
    candidateIndex: number,
    patch: Partial<ChatCandidate>
  ) {
    const next = messages.map((message, mi) =>
      mi === messageIndex && message.candidates
        ? {
            ...message,
            candidates: message.candidates.map((candidate, ci) =>
              ci === candidateIndex ? { ...candidate, ...patch } : candidate
            ),
          }
        : message
    );
    setMessages(next);
    await persist(next);
  }

  async function persistCandidatePlace(
    candidate: ChatCandidate
  ): Promise<string> {
    if (candidate.savedPlaceId) return candidate.savedPlaceId;
    const category = (
      candidate.category in PLACE_CATEGORIES ? candidate.category : "other"
    ) as PlaceCategory;
    const { id } = await addPlace({
      name: candidate.name,
      category,
      area: candidate.area,
      address: candidate.address,
      lat: candidate.lat ?? null,
      lng: candidate.lng ?? null,
      website: candidate.website,
      imageUrl: candidate.imageUrl,
      summary: `${candidate.description}\n\n${candidate.why}`,
      priceNotes: candidate.priceNotes,
    });
    return id;
  }

  async function saveCandidate(
    candidate: ChatCandidate,
    messageIndex: number,
    candidateIndex: number
  ) {
    const key = candidateKey(messageIndex, candidateIndex);
    if (savingKeys.has(key) || candidate.savedPlaceId) return;
    setSavingKeys((current) => new Set(current).add(key));
    try {
      const placeId = await persistCandidatePlace(candidate);
      await updateCandidate(messageIndex, candidateIndex, {
        savedPlaceId: placeId,
      });
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
  async function pollCandidate(
    candidate: ChatCandidate,
    messageIndex: number,
    candidateIndex: number
  ) {
    const key = candidateKey(messageIndex, candidateIndex);
    if (savingKeys.has(key)) return;
    setSavingKeys((current) => new Set(current).add(key));
    try {
      const placeId = await persistCandidatePlace(candidate);
      await updateCandidate(messageIndex, candidateIndex, {
        savedPlaceId: placeId,
      });
      setPollTarget({
        label: candidate.name,
        placeId,
        messageIndex,
        candidateIndex,
      });
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
      <p className="kicker text-ink-500">{trip.ai.kicker}</p>
      <h1 className="mb-1.5 font-display text-3xl font-light tracking-tight text-ink-900">
        {trip.ai.title}
      </h1>
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
                key={session.id}
                className={`flex items-center rounded-full border ${
                  sessionId === session.id
                    ? "border-sea-700 bg-sea-700"
                    : "border-cream-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => openSession(session)}
                  className={`max-w-40 truncate whitespace-nowrap py-2 pe-1.5 ps-3.5 text-sm transition ${
                    sessionId === session.id ? "text-cream-50" : "text-ink-700"
                  }`}
                >
                  {session.title}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSession(session.id)}
                  aria-label={t("ai.deleteChat", { title: session.title })}
                  className={`flex items-center py-2 pe-3 ps-1 ${
                    sessionId === session.id ? "text-sea-200" : "text-ink-300"
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
            <div className="card relative overflow-hidden px-6 py-8 text-center">
              <span
                aria-hidden
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-cream-200 text-lemon-600"
              >
                <Glyph value={trip.ai.emoji} size={22} />
              </span>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
                {trip.ai.heroBlurb}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {trip.ai.suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-start text-sm text-sea-700 transition active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((message, messageIndex) => (
          <div key={messageIndex}>
            {message.role === "assistant" && (
              <p className="mb-1.5 ms-auto flex w-fit items-center gap-1.5 text-xs text-ink-500">
                <Glyph value={trip.ai.emoji} size={14} className="text-lemon-600" />
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
              {message.content}
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
                              {candidate.name}
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
                        {candidate.description}
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
          <div className="ms-auto w-fit rounded-3xl rounded-ee-md border border-cream-200 bg-white px-4 py-3 text-ink-500">
            <span className="inline-flex gap-1">
              {t("ai.thinking")}
              <span className="animate-pulse">…</span>
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-terra-200 bg-terra-100 px-4 py-3 text-sm text-terra-600"
          >
            {error}
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
