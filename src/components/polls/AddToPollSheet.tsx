"use client";

import { useState } from "react";
import { Lightbulb, Plus, Vote } from "lucide-react";
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
      setMessage("כתבו את שאלת הסקר");
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
        setMessage("״" + label + "״ כבר נמצא בסקר הזה");
        setBusy(false);
        return;
      }
      onAdded?.();
      onClose();
      setQuestion("");
      setTarget("ideas");
    } catch {
      setMessage("ההוספה נכשלה, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="🗳️ לאיזה סקר להוסיף?">
      <div className="space-y-4">
        <p className="rounded-2xl bg-cream-100 px-4 py-2.5 text-sm text-ink-700">
          מוסיפים את: <b>{label}</b>
        </p>

        <div className="space-y-2">
          {/* Standing ideas poll */}
          <button
            type="button"
            onClick={() => setTarget("ideas")}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-right transition ${
              target === "ideas"
                ? "border-sea-500 bg-sea-100 ring-1 ring-sea-200"
                : "border-cream-200 bg-white"
            }`}
          >
            <Lightbulb size={18} className="shrink-0 text-lemon-500" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">
                סקר הרעיונות הפתוח
              </span>
              <span className="block text-xs text-ink-500">
                מאגר קבוע של רעיונות שכולם מצביעים עליהם
              </span>
            </span>
          </button>

          {/* Existing open polls */}
          {openPolls.map((poll) => (
            <button
              key={poll.id}
              type="button"
              onClick={() => setTarget(poll.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-right transition ${
                target === poll.id
                  ? "border-sea-500 bg-sea-100 ring-1 ring-sea-200"
                  : "border-cream-200 bg-white"
              }`}
            >
              <Vote size={18} className="shrink-0 text-sea-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink-900">
                  {poll.question}
                </span>
                <span className="block text-xs text-ink-500">
                  {poll.options.length} אפשרויות
                </span>
              </span>
            </button>
          ))}

          {/* New poll */}
          <button
            type="button"
            onClick={() => setTarget("new")}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-right transition ${
              target === "new"
                ? "border-terra-400 bg-terra-100 ring-1 ring-terra-100"
                : "border-cream-200 bg-white"
            }`}
          >
            <Plus size={18} className="shrink-0 text-terra-500" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">
                סקר חדש עם שאלה משלו
              </span>
              <span className="block text-xs text-ink-500">
                למשל: ״מה עושים ביום שלישי?״ — כולם יקבלו התראה
              </span>
            </span>
          </button>

          {target === "new" && (
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              autoFocus
              placeholder="מה שאלת הסקר?"
              className="field"
            />
          )}
        </div>

        {message && (
          <p role="alert" className="text-sm font-medium text-terra-600">
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
            ? "מוסיף…"
            : target === "new"
              ? "צור סקר והוסף 🗳️"
              : "הוסף לסקר 🗳️"}
        </button>
      </div>
    </BottomSheet>
  );
}
