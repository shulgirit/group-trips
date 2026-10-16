"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useDocData } from "@/lib/hooks";
import { useTrip } from "@/components/providers/TripProvider";
import { useT } from "@/i18n";
import { Glyph } from "@/components/ui/Icon";
import { SURFACE } from "@/components/settings/SettingsGroup";

/**
 * Free-text knowledge the families write about themselves — fed straight
 * into the servant's context so it knows names, stories and preferences.
 */
export function AboutUsSection() {
  const trip = useTrip();
  const t = useT();
  const { path: tripPath } = trip;
  const { data } = useDocData<{ aboutUs?: string }>(tripPath);
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
      await updateDoc(doc(db(), tripPath), { aboutUs: text.trim() });
      setMessage(trip.ai.aboutSaved);
    } catch {
      setMessage(t("common.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${SURFACE} p-4`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cream-200 text-ink-700"
        >
          {trip.ai.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- small avatar
            <img src={trip.ai.avatar} alt="" className="h-full w-full bg-night-900 object-cover" />
          ) : (
            <Glyph value={trip.ai.moreEmoji} size={18} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-ink-900">{trip.ai.aboutTitle}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
            {trip.ai.aboutDescription}
          </p>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        dir="auto"
        aria-label={trip.ai.aboutTitle}
        placeholder={trip.ai.aboutPlaceholder}
        className="field mt-3 leading-relaxed"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary min-h-11 px-6 text-sm"
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
        {message && (
          <p role="status" className="min-w-0 flex-1 text-sm text-ink-700">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
