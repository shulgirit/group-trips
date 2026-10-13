"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { apiFetch } from "@/lib/firebase/client";
import { AI_PRESETS, AI_RULES, type AiPreset } from "@/lib/trip-doc";
import { peopleCounts, primaryPlace, tripEnd, tripStart, type CreatorState } from "./state";

const PRESET_ORDER: Exclude<AiPreset, "custom">[] = ["butler", "pilot", "buddy", "guide"];

const SAMPLE_QUESTIONS = [
  "מה כדאי לעשות ביום הראשון?",
  "תמליץ על מסעדה שווה",
  "מה חשוב לדעת על היעד?",
];

export function StepAi({
  state,
  update,
}: {
  state: CreatorState;
  update: (patch: Partial<CreatorState>) => void;
}) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<{ q: string; a: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const ai = state.ai;

  function setAi(patch: Partial<CreatorState["ai"]>) {
    update({ ai: { ...ai, ...patch } });
  }

  function pickPreset(preset: Exclude<AiPreset, "custom">) {
    const wasDefaultName = PRESET_ORDER.some((p) => AI_PRESETS[p].name === ai.name) || !ai.name;
    setAi({
      preset,
      emoji: AI_PRESETS[preset].emoji,
      ...(wasDefaultName ? { name: AI_PRESETS[preset].name } : {}),
    });
  }

  function toggleRule(id: string) {
    const rules = ai.rules.includes(id)
      ? ai.rules.filter((r) => r !== id)
      : [...ai.rules.filter((r) => !(id === "kids" && r === "adults") && !(id === "adults" && r === "kids")), id];
    setAi({ rules });
  }

  async function ask(text: string) {
    const place = primaryPlace(state);
    if (!text.trim() || asking || !place) return;
    setAsking(true);
    const { people, kids } = peopleCounts(state);
    try {
      const response = await apiFetch("/api/ai/trip-assist", {
        method: "POST",
        body: JSON.stringify({
          action: "preview",
          draft: {
            destination: state.stops
              .map((stop) => stop.place?.label)
              .filter(Boolean)
              .join(" ← "),
            startDate: tripStart(state),
            endDate: tripEnd(state),
            groupKind: state.groupKind,
            groupName: state.groupName,
            aboutUs: state.aboutUs,
            peopleCount: people,
            kidsCount: kids,
          },
          ai: { ...ai, name: ai.name.trim() || "העוזר" },
          question: text,
        }),
      });
      const body = await response.json();
      setReply({ q: text, a: body.reply || "…" });
      setQuestion("");
    } catch {
      setReply({ q: text, a: "לא הצלחתי לענות כרגע — נסו שוב" });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-900">עוזר ה-AI שלכם ✨</h1>
        <p className="mt-1 text-ink-500">
          הוא ממליץ, משבץ בלו״ז, פותח סקרים ומכיר את כל הטיול. תנו לו אופי
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2">
        {PRESET_ORDER.map((key) => {
          const preset = AI_PRESETS[key];
          const active = ai.preset === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pickPreset(key)}
              className={`card px-3 py-3 text-start transition ${active ? "ring-2 ring-sea-500" : ""}`}
            >
              <span className="text-2xl" aria-hidden>
                {preset.emoji}
              </span>
              <span className="mt-1 block font-semibold text-ink-900">{preset.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-ink-500">״{preset.sample}״</span>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-[5rem_1fr] gap-2">
        <label className="space-y-1">
          <span className="text-xs text-ink-500">אימוג׳י</span>
          <input
            className="field text-center text-2xl"
            value={ai.emoji}
            maxLength={8}
            onChange={(event) => setAi({ emoji: event.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-ink-500">איך קוראים לו?</span>
          <input
            className="field text-lg font-semibold"
            value={ai.name}
            maxLength={30}
            placeholder="המשרת של החבורה"
            onChange={(event) => setAi({ name: event.target.value })}
          />
        </label>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink-700">כללים שחשוב שיזכור</p>
        <div className="flex flex-wrap gap-2">
          {AI_RULES.map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() => toggleRule(rule.id)}
              className={`chip ${ai.rules.includes(rule.id) ? "chip-active" : ""}`}
            >
              {rule.label}
            </button>
          ))}
        </div>
        <textarea
          className="field min-h-20 text-sm"
          placeholder="כללים משלכם, שורה לכל כלל. למשל: אנחנו קמים מאוחר — אל תציע דברים לפני 10:00"
          value={ai.customRules}
          maxLength={1500}
          onChange={(event) => setAi({ customRules: event.target.value })}
        />
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink-700">
          ספרו לו עליכם <span className="font-normal text-ink-300">(כל החבורה תוכל לערוך אחר כך)</span>
        </p>
        <textarea
          className="field min-h-24 text-sm"
          placeholder="מי זה מי, גילאים, מה כל אחד אוהב, בדיחות פנימיות…"
          value={state.aboutUs}
          maxLength={4000}
          onChange={(event) => update({ aboutUs: event.target.value })}
        />
      </section>

      <section className="card space-y-3 bg-gradient-to-br from-white to-sea-100/40 px-4 py-4">
        <p className="text-sm font-semibold text-ink-700">נסו אותו עכשיו 👇</p>
        {reply && (
          <div className="space-y-2">
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-md bg-sea-700 px-3.5 py-2 text-sm text-cream-50">
              {reply.q}
            </p>
            <p className="w-fit max-w-[90%] whitespace-pre-line rounded-2xl rounded-es-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink-900 shadow-sm">
              <span className="font-semibold">
                {ai.emoji} {ai.name}:
              </span>{" "}
              {reply.a}
            </p>
          </div>
        )}
        {asking && <p className="text-sm text-ink-500">{ai.emoji} מקליד…</p>}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {SAMPLE_QUESTIONS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => ask(sample)}
              disabled={asking}
              className="chip shrink-0 bg-white"
            >
              {sample}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
        >
          <input
            className="field flex-1 py-2.5"
            placeholder="או כתבו שאלה…"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            aria-label="שליחה"
            className="btn-primary h-12 w-12 shrink-0"
          >
            <Send className="h-5 w-5 rotate-180" />
          </button>
        </form>
      </section>
    </div>
  );
}
