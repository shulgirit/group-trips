"use client";

import { useState } from "react";
import { Lightbulb, Plus, Vote } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  GLOBAL_POLL_ID,
  addOptionToGlobalPoll,
  addOptionToPoll,
  createPollWithOption,
} from "@/lib/db";
import { usePolls } from "@/lib/hooks";

/**
 * "Add to poll" chooser: pick an existing open poll, the standing ideas
 * poll, or create a brand-new poll with its own question on the spot.
 */
export function AddToPollSheet({
  open,
  onClose,
  label,
  placeId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  placeId?: string | null;
  onAdded?: () => void;
}) {
  const { polls } = usePolls();
  const t = useT();
  const [target, setTarget] = useState<string>("ideas"); // "ideas" | "new" | pollId
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const openPolls = (polls ?? []).filter(
    (poll) => !poll.closed && poll.id !== GLOBAL_POLL_ID
  );

  async function handleConfirm() {
    if (busy) return;
    if (target === "new" && !question.trim()) {
      setMessage(t("polls.sheet.needQuestion"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      let result: "added" | "exists" = "added";
      if (target === "new") {
        await createPollWithOption(question, label, placeId);
      } else if (target === "ideas") {
        result = await addOptionToGlobalPoll(label, placeId);
      } else {
        result = await addOptionToPoll(target, label, placeId);
      }
      if (result === "exists") {
        setMessage(t("polls.sheet.exists", { label }));
        setBusy(false);
        return;
      }
      onAdded?.();
      onClose();
      setQuestion("");
      setTarget("ideas");
    } catch {
      setMessage(t("polls.sheet.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("polls.sheet.title")}>
      <div className="space-y-4">
        <p className="rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          {t("polls.sheet.adding")}{" "}
          <b className="font-medium text-ink-900">{label}</b>
        </p>

        <div className="space-y-2">
          {/* Standing ideas poll */}
          <button
            type="button"
            onClick={() => setTarget("ideas")}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
              target === "ideas"
                ? "border-sea-500 bg-sea-100 ring-1 ring-sea-200"
                : "border-cream-200 bg-white"
            }`}
          >
            <Lightbulb size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-lemon-600" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">
                {t("polls.sheet.ideasTitle")}
              </span>
              <span className="block text-xs text-ink-500">
                {t("polls.sheet.ideasHint")}
              </span>
            </span>
          </button>

          {/* Existing open polls */}
          {openPolls.map((poll) => (
            <button
              key={poll.id}
              type="button"
              onClick={() => setTarget(poll.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
                target === poll.id
                  ? "border-sea-500 bg-sea-100 ring-1 ring-sea-200"
                  : "border-cream-200 bg-white"
              }`}
            >
              <Vote size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-sea-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink-900">
                  <bdi>{poll.question}</bdi>
                </span>
                <span className="block text-xs text-ink-500">
                  {t("polls.sheet.optionsCount", { count: poll.options.length })}
                </span>
              </span>
            </button>
          ))}

          {/* New poll */}
          <button
            type="button"
            onClick={() => setTarget("new")}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
              target === "new"
                ? "border-sea-500 bg-sea-100 ring-1 ring-sea-200"
                : "border-cream-200 bg-white"
            }`}
          >
            <Plus size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">
                {t("polls.sheet.newTitle")}
              </span>
              <span className="block text-xs text-ink-500">
                {t("polls.sheet.newHint")}
              </span>
            </span>
          </button>

          {target === "new" && (
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              autoFocus
              placeholder={t("polls.sheet.questionPlaceholder")}
              className="field"
            />
          )}
        </div>

        {message && (
          <p role="alert" className="text-sm text-terra-600">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="btn-primary w-full py-3.5"
        >
          {busy
            ? t("polls.sheet.busy")
            : target === "new"
              ? t("polls.sheet.createAndAdd")
              : t("polls.sheet.add")}
        </button>
      </div>
    </BottomSheet>
  );
}
