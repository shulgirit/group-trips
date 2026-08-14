"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { addPlace } from "@/lib/db";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/types";

interface Candidate {
  name: string;
  category: string;
  area?: string;
  description: string;
  why: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  priceNotes?: string;
  website?: string;
}

interface CandidateState extends Candidate {
  key: string;
  status: "idle" | "saving" | "saved" | "dismissed";
  savedPlaceId?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  candidates?: CandidateState[];
}

const SUGGESTED_PROMPTS = [
  "תמליץ לנו על אטרקציה",
  "מה כדאי לעשות מחר?",
  "תמצא לנו מסעדה טובה לילדים",
  "תמצא פעילות לילדים",
  "תמצא Plan B אם יורד גשם",
  "מה עוד לא שובץ בלוח?",
];

let candidateCounter = 0;

export default function AiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    queueMicrotask(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });
      if (!response.ok) throw new Error("ai_failed");
      const data: { reply: string; candidates: Candidate[] } =
        await response.json();

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply,
          candidates: data.candidates.map((candidate) => ({
            ...candidate,
            key: `cand-${candidateCounter++}`,
            status: "idle",
          })),
        },
      ]);
    } catch {
      setError("ה-AI לא ענה הפעם — נסו שוב עוד רגע");
    } finally {
      setLoading(false);
      queueMicrotask(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    }
  }

  function updateCandidate(key: string, patch: Partial<CandidateState>) {
    setMessages((current) =>
      current.map((message) => ({
        ...message,
        candidates: message.candidates?.map((candidate) =>
          candidate.key === key ? { ...candidate, ...patch } : candidate
        ),
      }))
    );
  }

  async function saveCandidate(candidate: CandidateState) {
    if (candidate.status === "saving" || candidate.status === "saved") return;
    updateCandidate(candidate.key, { status: "saving" });
    try {
      const category = (
        candidate.category in PLACE_CATEGORIES ? candidate.category : "other"
      ) as PlaceCategory;
      const placeId = await addPlace({
        name: candidate.name,
        category,
        area: candidate.area,
        address: candidate.address,
        lat: candidate.lat ?? null,
        lng: candidate.lng ?? null,
        website: candidate.website,
        summary: `${candidate.description}\n\n💛 ${candidate.why}`,
        priceNotes: candidate.priceNotes,
      });
      updateCandidate(candidate.key, { status: "saved", savedPlaceId: placeId });
    } catch {
      updateCandidate(candidate.key, { status: "idle" });
      setError("השמירה נכשלה, נסו שוב");
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink-900">
        ✨ הקונסיירז׳ של הטיול
      </h1>
      <p className="mb-4 text-sm text-ink-500">
        מכיר את המקומות, הלו״ז והמשפחות שלנו — ואפשר לשמור כל המלצה בקליק
      </p>

      <div className="flex-1 space-y-4">
        {messages.length === 0 && (
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
        )}

        {messages.map((message, index) => (
          <div key={index}>
            <div
              className={`max-w-[85%] rounded-3xl px-4 py-3 leading-relaxed ${
                message.role === "user"
                  ? "me-auto bg-sea-600 text-cream-50"
                  : "ms-auto w-fit bg-white text-ink-900 border border-cream-200"
              }`}
            >
              {message.content}
            </div>

            {message.candidates && message.candidates.length > 0 && (
              <ul className="mt-3 space-y-3">
                {message.candidates
                  .filter((c) => c.status !== "dismissed")
                  .map((candidate) => {
                    const category =
                      PLACE_CATEGORIES[
                        candidate.category as PlaceCategory
                      ] ?? PLACE_CATEGORIES.other;
                    return (
                      <li
                        key={candidate.key}
                        className="rounded-3xl border border-cream-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-ink-900">
                              {category.emoji} {candidate.name}
                            </p>
                            <p className="text-sm text-ink-500">
                              {category.label}
                              {candidate.area ? ` · ${candidate.area}` : ""}
                              {candidate.priceNotes
                                ? ` · ${candidate.priceNotes}`
                                : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateCandidate(candidate.key, {
                                status: "dismissed",
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
                          {candidate.status === "saved" ? (
                            <Link
                              href={`/places/${candidate.savedPlaceId}`}
                              className="rounded-2xl bg-sea-100 px-4 py-2.5 text-sm font-semibold text-sea-700"
                            >
                              ✓ נשמר · לפרטים ולשיבוץ ›
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => saveCandidate(candidate)}
                              disabled={candidate.status === "saving"}
                              className="rounded-2xl bg-sea-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
                            >
                              {candidate.status === "saving"
                                ? "שומר…"
                                : "❤️ הוסף למקומות"}
                            </button>
                          )}
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
          <p
            role="alert"
            className="rounded-2xl bg-terra-100 px-4 py-3 text-sm font-medium text-terra-600"
          >
            {error}
          </p>
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
          placeholder="שאלו אותי כל דבר על הטיול…"
          className="flex-1 rounded-2xl border border-cream-200 bg-white px-4 py-3.5 text-ink-900 shadow-sm outline-none placeholder:text-ink-300 focus:border-sea-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="שליחה"
          className="rounded-2xl bg-sea-600 px-5 font-semibold text-cream-50 disabled:opacity-50"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
