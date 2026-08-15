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
import { AddToPollSheet } from "@/components/polls/AddToPollSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { addPlace } from "@/lib/db";
import { useFamilies } from "@/lib/hooks";
import { db } from "@/lib/firebase/client";
import { TRIP_PATH } from "@/lib/trip";
import {
  PLACE_CATEGORIES,
  type ChatCandidate,
  type ChatMessage,
  type ChatSession,
  type PlaceCategory,
} from "@/types";

const SUGGESTED_PROMPTS = [
  "תמליץ לנו על אטרקציה",
  "מה כדאי לעשות מחר?",
  "תמצא לנו מסעדה טובה לילדים",
  "תמצא פעילות לילדים",
  "תמצא Plan B אם יורד גשם",
  "מה עוד לא שובץ בלוח?",
];

export default function AiPage() {
  const { ready, user, personal, profile } = useFirebase();
  const { families } = useFamilies();

  // "מיקה ממשפחת טל" — so the servant knows who it's talking to
  const speaker = useMemo(() => {
    if (!personal) return undefined;
    const family = families?.find((f) => f.id === profile?.familyId);
    const memberName = family?.members.find(
      (m) => m.id === profile?.memberId
    )?.name;
    const name = memberName ?? user?.displayName;
    if (!name) return undefined;
    return family ? `${name} מ${family.name}` : name;
  }, [personal, families, profile, user]);

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
      const response = await fetch("/api/ai/place-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name,
          area: candidate.area,
          description: candidate.description,
          why: candidate.why,
        }),
      });
      if (!response.ok) throw new Error("failed");
      const { text } = await response.json();
      infoCache.current.set(candidate.name, text);
      setInfoText(text);
    } catch {
      setInfoText("לא הצלחתי להביא מידע כרגע — נסו לסגור ולפתוח שוב");
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
        collection(db(), `${TRIP_PATH}/chatSessions`),
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
  }, [ready, user, personal]);

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
          doc(db(), `${TRIP_PATH}/chatSessions/${knownSessionId}`),
          {
            messages: nextMessages,
            updatedAt: Date.now(),
          }
        );
        return knownSessionId;
      }
      const firstUser = nextMessages.find((m) => m.role === "user");
      const ref = await addDoc(collection(db(), `${TRIP_PATH}/chatSessions`), {
        ownerUid: user.uid,
        title: (firstUser?.content ?? "שיחה").slice(0, 40),
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
    await deleteDoc(doc(db(), `${TRIP_PATH}/chatSessions/${id}`)).catch(
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
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: thread.map(({ role, content }) => ({ role, content })),
          speaker,
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
      setError(
        "התשובה לקחה יותר מדי זמן או שהחיבור נקטע — השאלה שלכם שמורה, אפשר לנסות שוב"
      );
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
    if (!trimmed || loading) return;

    const withUser: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
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
      summary: `${candidate.description}\n\n💛 ${candidate.why}`,
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
      setError("השמירה נכשלה, נסו שוב");
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
      setError("ההוספה לסקר נכשלה, נסו שוב");
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
      <p className="kicker text-terra-500">חבורת מיחא</p>
      <h1 className="mb-1 font-display text-3xl font-bold text-ink-900">
        🦻✨ המשרת של חבורת מיחא
      </h1>
      <p className="mb-3 text-sm text-ink-500">
        {personal
          ? "🔒 השיחות שלכם פרטיות — רק מה שתשמרו למקומות או ללוח משותף לקבוצה"
          : "מכיר את המקומות, הלו״ז ואת כל החבורה"}
      </p>

      {/* Private session bar */}
      {personal && (
        <div className="-mx-4 mb-3 overflow-x-auto px-4">
          <div className="flex w-max items-center gap-2">
            <button
              type="button"
              onClick={newChat}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${
                sessionId === null
                  ? "bg-sea-600 text-cream-50"
                  : "bg-cream-100 text-ink-700"
              }`}
            >
              + שיחה חדשה
            </button>
            {sessions?.map((session) => (
              <span key={session.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => openSession(session)}
                  className={`max-w-40 truncate whitespace-nowrap rounded-s-full px-3.5 py-2 text-sm transition ${
                    sessionId === session.id
                      ? "bg-sea-600 font-medium text-cream-50"
                      : "bg-cream-100 text-ink-700"
                  }`}
                >
                  {session.title}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSession(session.id)}
                  aria-label={`מחיקת השיחה ${session.title}`}
                  className={`rounded-e-full py-2 pe-2.5 ps-1 text-xs ${
                    sessionId === session.id
                      ? "bg-sea-600 text-sea-200"
                      : "bg-cream-100 text-ink-300"
                  }`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {!personal && (
        <Link
          href="/settings"
          className="mb-3 block rounded-2xl bg-lemon-100 px-4 py-2.5 text-sm font-medium text-ink-700"
        >
          🔒 רוצים היסטוריית שיחות פרטית? התחברו עם Google בהגדרות ›
        </Link>
      )}

      <div className="flex-1 space-y-4">
        {messages.length === 0 && (
          <>
            <div className="card relative overflow-hidden px-5 py-6 text-center">
              <span aria-hidden className="text-4xl">
                🦻✨
              </span>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-500">
                המשרת של החבורה לשירותכם — המלצות, שיבוצים בלוח, סקרים
                ועדכון מקומות. מחובר לכל נתוני הטיול
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="rounded-2xl border border-sea-200 bg-white px-4 py-2.5 text-sm text-sea-700 transition active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((message, messageIndex) => (
          <div key={messageIndex}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-3 leading-relaxed ${
                message.role === "user"
                  ? "me-auto rounded-bl-lg bg-sea-700 text-cream-50"
                  : "card ms-auto w-fit rounded-br-lg text-ink-900"
              }`}
            >
              {message.content}
            </div>

            {message.candidates && message.candidates.length > 0 && (
              <ul className="mt-3 space-y-3">
                {message.candidates.map((candidate, candidateIndex) => {
                  if (candidate.dismissed) return null;
                  const key = candidateKey(messageIndex, candidateIndex);
                  const category =
                    PLACE_CATEGORIES[candidate.category as PlaceCategory] ??
                    PLACE_CATEGORIES.other;
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
                          <div
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-sea-950/50 to-transparent"
                          />
                        </div>
                      )}
                      <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          {!candidate.imageUrl && (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sea-100 to-lemon-100 text-xl">
                              {category.emoji}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg font-bold text-ink-900">
                              {candidate.name}
                            </p>
                            <p className="text-sm text-ink-500">
                              {category.label}
                              {candidate.area ? ` · ${candidate.area}` : ""}
                              {candidate.priceNotes
                                ? ` · ${candidate.priceNotes}`
                                : ""}
                            </p>
                            {candidate.rating && (
                              <p className="mt-0.5 text-sm font-medium text-ink-700">
                                ⭐ {candidate.rating}
                                {candidate.ratingCount
                                  ? ` · ${candidate.ratingCount.toLocaleString("he-IL")} ביקורות בגוגל`
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
                          aria-label="הסר מהתוצאות"
                          className="px-1 text-ink-300"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-ink-700">
                        {candidate.description}
                      </p>
                      <p className="mt-1.5 text-sm text-terra-600">
                        💛 {candidate.why}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        {candidate.savedPlaceId ? (
                          <Link
                            href={`/places/${candidate.savedPlaceId}`}
                            className="btn rounded-2xl bg-sea-100 px-4 py-2.5 text-sm text-sea-700"
                          >
                            ✓ נשמר · לפרטים ולשיבוץ ›
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
                            {savingKeys.has(key) ? "שומר…" : "❤️ הוסף למקומות"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            pollCandidate(candidate, messageIndex, candidateIndex)
                          }
                          disabled={savingKeys.has(key)}
                          className={`rounded-2xl px-3.5 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
                            candidate.polled
                              ? "bg-lemon-100 text-ink-700"
                              : "bg-cream-100 text-ink-700"
                          } disabled:opacity-70`}
                        >
                          {candidate.polled ? "🗳️ בסקר ✓" : "🗳️ לסקר…"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openInfo(candidate)}
                          className="rounded-2xl bg-cream-100 px-3.5 py-2.5 text-sm font-medium text-ink-700 transition active:scale-[0.98]"
                        >
                          ➕ ספרו לי עוד
                        </button>
                        {candidate.website && (
                          <a
                            href={candidate.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-2xl bg-cream-100 px-3.5 py-2.5 text-sm font-medium text-ink-700"
                          >
                            🌐
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
          <div className="ms-auto w-fit rounded-3xl border border-cream-200 bg-white px-4 py-3 text-ink-500">
            <span className="inline-flex gap-1">
              חושב
              <span className="animate-pulse">…</span>
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-terra-100 px-4 py-3 text-sm font-medium text-terra-600"
          >
            {error}
            {canRetry && (
              <button
                type="button"
                onClick={retry}
                className="btn-primary mt-2 w-full py-2.5 text-sm"
              >
                🔄 נסו שוב
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="sticky bottom-24 mt-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            activeSession ? "המשיכו את השיחה…" : "שאלו אותי כל דבר על הטיול…"
          }
          className="field flex-1 py-3.5 shadow-[var(--shadow-card)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="שליחה"
          className="btn-primary px-5"
        >
          ↑
        </button>
      </form>

      {/* "ספרו לי עוד" modal — stays on top of the cards */}
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
          <p className="text-sm text-ink-500">
            {infoTarget.area ?? ""}
            {infoTarget.rating
              ? `${infoTarget.area ? " · " : ""}⭐ ${infoTarget.rating}${
                  infoTarget.ratingCount
                    ? ` (${infoTarget.ratingCount.toLocaleString("he-IL")})`
                    : ""
                }`
              : ""}
          </p>
          {infoLoading ? (
            <div className="mt-3 space-y-2" aria-label="טוען מידע">
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
