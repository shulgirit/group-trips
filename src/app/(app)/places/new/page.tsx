"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPlace } from "@/lib/db";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/types";

export default function NewPlacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("attraction");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const placeId = await addPlace({
        name,
        category,
        area,
        address,
        website,
        imageUrl,
      });
      router.replace(`/places/${placeId}`);
    } catch {
      setError("השמירה נכשלה — בדקו את הפרטים ונסו שוב");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink-900">
        מקום חדש
      </h1>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink-700">
          איך קוראים למקום? *
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="למשל: Isola Bella"
          required
          className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">קטגוריה *</p>
        <div className="grid grid-cols-4 gap-2">
          {(
            Object.entries(PLACE_CATEGORIES) as [
              PlaceCategory,
              (typeof PLACE_CATEGORIES)[PlaceCategory],
            ][]
          ).map(([id, { label, emoji }]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 text-sm transition ${
                category === id
                  ? "bg-sea-600 font-medium text-cream-50"
                  : "bg-cream-100 text-ink-700"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {emoji}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <details className="rounded-2xl border border-cream-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          פרטים נוספים (לא חובה)
        </summary>
        <div className="mt-3 space-y-3">
          {(
            [
              [area, setArea, "אזור", "למשל: טאורמינה"],
              [address, setAddress, "כתובת", ""],
              [website, setWebsite, "אתר", "https://…"],
              [imageUrl, setImageUrl, "קישור לתמונה", "https://…"],
            ] as const
          ).map(([value, setter, label, placeholder]) => (
            <label key={label} className="block">
              <span className="mb-1.5 block text-sm text-ink-500">{label}</span>
              <input
                type="text"
                dir={label === "אתר" || label === "קישור לתמונה" ? "ltr" : "rtl"}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-ink-900 outline-none placeholder:text-ink-300 focus:border-sea-500"
              />
            </label>
          ))}
        </div>
      </details>

      <p className="text-sm text-ink-500">
        ✨ בקרוב: הדבקת קישור וייבוא אוטומטי עם AI
      </p>

      {error && (
        <p role="alert" className="text-sm font-medium text-terra-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-2xl bg-sea-600 py-3.5 text-lg font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "שומר…" : "שמור מקום"}
      </button>
    </form>
  );
}
