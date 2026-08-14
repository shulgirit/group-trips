"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useDocData } from "@/lib/hooks";
import { TRIP_PATH } from "@/lib/trip";

/**
 * Free-text knowledge the families write about themselves — fed straight
 * into the servant's context so it knows names, stories and preferences.
 */
export function AboutUsSection() {
  const { data } = useDocData<{ aboutUs?: string }>(TRIP_PATH);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loaded || data === undefined) return;
    setText(data?.aboutUs ?? "");
    setLoaded(true);
  }, [data, loaded]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      await updateDoc(doc(db(), TRIP_PATH), { aboutUs: text.trim() });
      setMessage("✓ נשמר — המשרת כבר מכיר את זה");
    } catch {
      setMessage("השמירה נכשלה, נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="section-title mb-3 text-lg">🦻 ספרו למשרת עלינו</h2>
      <div className="card px-4 py-4">
        <p className="text-sm leading-relaxed text-ink-500">
          כל מה שתכתבו כאן נכנס לידע של המשרת: מי זה מי, גילאים, סיפורים,
          מה הילדים אוהבים, בדיחות פנימיות — והוא ישתמש בזה בשיחות ובהמלצות
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          placeholder="למשל: מיקה בת 10 ואוהבת פארקי מים. אורי משוגע על כדורגל..."
          className="field mt-3 leading-relaxed"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary mt-3 w-full py-3"
        >
          {saving ? "שומר…" : "שמירה"}
        </button>
        {message && (
          <p className="mt-2 text-sm font-medium text-ink-700">{message}</p>
        )}
      </div>
    </section>
  );
}
