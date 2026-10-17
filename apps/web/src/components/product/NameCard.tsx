"use client";

import { api } from "@together/backend/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useT } from "@/i18n";

/** Email sign-ups start without a name — one quick field fixes it. */
export function NameCard() {
  const t = useT();
  const setName = useMutation(api.account.setName);
  const [name, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    await setName({ name }).catch(() => setSaving(false));
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-brass-300/70 bg-white p-5">
      <label htmlFor="my-name" className="block text-[17px] font-medium text-ink-900">
        {t("product.trips.nameTitle")}
      </label>
      <p className="mt-1 text-sm text-ink-500">{t("product.trips.nameHint")}</p>
      <div className="mt-3 flex gap-2">
        <input
          id="my-name"
          dir="auto"
          autoComplete="name"
          value={name}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("product.trips.namePlaceholder")}
          className="field flex-1"
        />
        <button type="submit" disabled={!name.trim() || saving} className="btn-primary px-5">
          {t("product.trips.nameSave")}
        </button>
      </div>
    </form>
  );
}
