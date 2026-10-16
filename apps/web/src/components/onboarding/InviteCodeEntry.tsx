"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2 } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

/** Accepts a full invite URL (…/j/<code>) or a bare code. */
export function inviteCode(input: string): string | null {
  const value = input.trim();
  const fromUrl = value.match(/\/j\/([A-Za-z0-9_-]{4,40})/);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9_-]{4,40}$/.test(value) ? value : null;
}

/**
 * "I have an invite link": a quiet link that opens a field for pasting
 * the invite link or code, then goes to that trip's join screen.
 */
export function InviteCodeEntry({
  startOpen = false,
  onBeforeGo,
  className = "",
}: {
  startOpen?: boolean;
  onBeforeGo?: () => void;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const code = inviteCode(value);
    if (!code) {
      setError(t("landing.app.inviteInvalid"));
      return;
    }
    onBeforeGo?.();
    router.push(`/j/${code}`);
  }

  return (
    <div className={className}>
      {open ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            placeholder={t("landing.app.invitePlaceholder")}
            aria-label={t("landing.app.invitePlaceholder")}
            dir="ltr"
            autoFocus={!startOpen}
            className="min-w-0 flex-1 rounded-xl border border-cream-50/15 bg-night-900 px-4 py-3 text-cream-50 outline-none placeholder:text-cream-50/40 focus:border-brass-500"
          />
          <button type="submit" className="btn rounded-xl bg-brass-500 px-4 font-semibold text-night-950">
            {t("landing.app.inviteGo")}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 py-1.5 text-sm text-cream-50/80 transition hover:text-cream-50"
        >
          <Link2 size={16} strokeWidth={STROKE} aria-hidden />
          {t("landing.app.haveInvite")}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-terra-200">{error}</p>}
    </div>
  );
}
