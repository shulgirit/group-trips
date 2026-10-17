"use client";

import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { useLocale, useT, type TKey } from "@/i18n";
import { translate } from "@together/i18n/translate";
import { api } from "@together/backend/api";
import { useAction } from "convex/react";
import { PRESET_AVATAR } from "@together/shared/avatars";
import { AvatarPicker } from "./AvatarPicker";
import { AI_PRESETS, AI_RULES, type AiPreset } from "@together/shared/trip-doc";
import { primaryPlace, tripEnd, tripStart, type CreatorState } from "./state";

const PRESET_ORDER: Exclude<AiPreset, "custom">[] = ["butler", "pilot", "buddy", "guide"];

const SAMPLE_QUESTIONS: TKey[] = [
  "creator.ai.samples.firstDay",
  "creator.ai.samples.restaurant",
  "creator.ai.samples.know",
];

/** Every name a preset has shipped with (any language) — renaming keeps custom names. */
const DEFAULT_NAMES = new Set(
  PRESET_ORDER.flatMap((p) => [
    AI_PRESETS[p].name,
    translate("he", `creator.ai.presets.${p}.name`),
    translate("en", `creator.ai.presets.${p}.name`),
  ])
);

export function StepAi({
  state,
  update,
}: {
  state: CreatorState;
  update: (patch: Partial<CreatorState>) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const previewGuide = useAction(api.assist.preview);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<{ q: string; a: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const ai = state.ai;

  function setAi(patch: Partial<CreatorState["ai"]>) {
    update({ ai: { ...ai, ...patch } });
  }

  function pickPreset(preset: Exclude<AiPreset, "custom">) {
    const wasDefaultName = DEFAULT_NAMES.has(ai.name) || !ai.name;
    // Follow the persona with its robot, unless a look was chosen on purpose
    const wasDefaultAvatar =
      !ai.avatar || Object.values(PRESET_AVATAR).some((id) => ai.avatar === `bot:${id}`);
    setAi({
      preset,
      emoji: preset,
      ...(wasDefaultName ? { name: t(`creator.ai.presets.${preset}.name`) } : {}),
      ...(wasDefaultAvatar ? { avatar: `bot:${PRESET_AVATAR[preset]}` } : {}),
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
    try {
      const answer = await previewGuide({
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
        },
        ai: { name: ai.name.trim() || t("creator.defaults.aiName"), preset: ai.preset, rules: ai.rules, customRules: ai.customRules },
        question: text,
        locale,
      });
      setReply({ q: text, a: answer || "…" });
      setQuestion("");
    } catch {
      setReply({ q: text, a: t("creator.ai.failed") });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-display-sm font-medium text-ink-900">{t("creator.ai.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{t("creator.ai.text")}</p>
      </header>

      <section className="grid grid-cols-2 gap-2">
        {PRESET_ORDER.map((key) => {
          const active = ai.preset === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => pickPreset(key)}
              className={`card px-4 py-4 text-start transition ${active ? "ring-1 ring-sea-700" : ""}`}
            >
              <Glyph value={key} size={20} className={active ? "text-lemon-500" : "text-sea-700"} />
              <span className="mt-2 block font-medium text-ink-900">
                {t(`creator.ai.presets.${key}.label`)}
              </span>
              <span className="mt-1 block text-xs leading-snug text-ink-500">
                {t("creator.ai.quote", { text: t(`creator.ai.presets.${key}.sample`) })}
              </span>
            </button>
          );
        })}
      </section>

      <AvatarPicker tripId={state.tripId} value={ai.avatar} onChange={(avatar, storageId) => setAi({ avatar, avatarStorageId: storageId ?? null })} />

      <section>
        <label className="block space-y-1">
          <span className="text-xs text-ink-500">{t("creator.ai.nameLabel")}</span>
          <span className="relative block">
            <Glyph
              value={ai.emoji}
              size={20}
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sea-700"
            />
            <input
              className="field ps-12 text-lg font-medium"
              value={ai.name}
              maxLength={30}
              placeholder={t("creator.ai.namePlaceholder")}
              onChange={(event) => setAi({ name: event.target.value })}
            />
          </span>
        </label>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-ink-700">{t("creator.ai.rulesLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {AI_RULES.map((rule) => {
            const key = `creator.ai.rules.${rule.id}` as TKey;
            const label = t(key);
            return (
              <button
                key={rule.id}
                type="button"
                aria-pressed={ai.rules.includes(rule.id)}
                onClick={() => toggleRule(rule.id)}
                className={`chip ${ai.rules.includes(rule.id) ? "chip-active" : ""}`}
              >
                {label === key ? rule.id : label}
              </button>
            );
          })}
        </div>
        <textarea
          className="field min-h-20 text-sm"
          placeholder={t("creator.ai.customRulesPlaceholder")}
          value={ai.customRules}
          maxLength={1500}
          onChange={(event) => setAi({ customRules: event.target.value })}
        />
      </section>

      {aboutOpen || state.aboutUs ? (
        <section className="space-y-2">
          <p className="text-sm font-medium text-ink-700">
            {t("creator.ai.aboutLabel")}{" "}
            <span className="font-normal text-ink-400">{t("creator.ai.aboutHint")}</span>
          </p>
          <textarea
            className="field min-h-24 text-sm"
            placeholder={t("creator.ai.aboutPlaceholder")}
            value={state.aboutUs}
            maxLength={4000}
            autoFocus={aboutOpen && !state.aboutUs}
            dir="auto"
            onChange={(event) => update({ aboutUs: event.target.value })}
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="-mt-3 flex min-h-11 items-center gap-1.5 text-sm font-medium text-route-700"
        >
          <Plus size={16} strokeWidth={STROKE} aria-hidden />
          {t("creator.ai.aboutLabel")}
        </button>
      )}

      <section className="card space-y-3 px-4 py-5">
        <p className="kicker text-ink-500">{t("creator.ai.tryTitle")}</p>
        {reply && (
          <div className="space-y-2">
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-md bg-sea-700 px-3.5 py-2 text-sm text-cream-50">
              {reply.q}
            </p>
            <div className="w-fit max-w-[90%] rounded-2xl rounded-es-md border border-cream-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink-900">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Glyph value={ai.emoji} size={14} className="shrink-0" />
                {ai.name}
              </p>
              <p className="mt-1 whitespace-pre-line">{reply.a}</p>
            </div>
          </div>
        )}
        {asking && (
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <Glyph value={ai.emoji} size={14} className="shrink-0" />
            {t("creator.ai.typing")}
          </p>
        )}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {SAMPLE_QUESTIONS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => ask(t(sample))}
              disabled={asking}
              className="chip shrink-0 bg-white"
            >
              {t(sample)}
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
            placeholder={t("creator.ai.askPlaceholder")}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            aria-label={t("creator.ai.send")}
            className="btn-primary h-12 w-12 shrink-0"
          >
            <Send size={20} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
          </button>
        </form>
      </section>
    </div>
  );
}
