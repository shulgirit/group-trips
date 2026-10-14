"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, QrCode, Share2, Users, X, type LucideIcon } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { tActive } from "@/i18n/active";
import { apiFetch } from "@/lib/firebase/client";

interface Invite {
  code: string;
  role: string;
  familyId: string | null;
  uses: number;
  maxUses: number;
  expiresAt: number;
}

export function inviteUrl(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/j/${code}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Invite text in the sender's UI language. `emoji` is kept for callers but no longer rendered. */
export function inviteMessage(opts: {
  tripName: string;
  emoji: string;
  familyName?: string | null;
  url: string;
}): string {
  const who = opts.familyName ? ` (${opts.familyName})` : "";
  return [
    tActive("product.invite.message.title", { trip: opts.tripName, who }),
    tActive("product.invite.message.body"),
    tActive("product.invite.message.join", { url: opts.url }),
  ].join("\n");
}

/** Shares through the native sheet when available, else WhatsApp. */
async function share(text: string, url: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text, url });
      return;
    } catch {
      // cancelled — fall through to nothing
      return;
    }
  }
  window.open(whatsappShareUrl(text), "_blank", "noopener");
}

function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const t = useT();
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((QR) =>
      QR.toDataURL(url, { margin: 1, width: 560, color: { dark: "#0b2e40" } }).then(
        (value) => !cancelled && setDataUrl(value)
      )
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 px-6"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-xs p-5 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="text-ink-500">
            <X size={20} strokeWidth={STROKE} aria-hidden />
          </button>
        </div>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={t("product.invite.qrAlt")} className="mx-auto w-full rounded-2xl" />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-cream-100" />
        )}
        <p className="mt-3 text-sm text-ink-500">{t("product.invite.qrHint")}</p>
      </div>
    </div>
  );
}

function InviteRow({
  icon: Icon,
  label,
  hint,
  url,
  message,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  url: string;
  message: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  return (
    <li className="rounded-2xl border border-cream-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-ink-900">
            <Icon size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
            <span className="truncate">{label}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-500" dir="ltr">
            {hint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setQr(true)}
            aria-label={t("product.invite.qr")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-200 text-ink-700"
          >
            <QrCode size={18} strokeWidth={STROKE} aria-hidden />
          </button>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(url).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            aria-label={t("product.invite.copyLink")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-200 text-ink-700"
          >
            {copied ? (
              <Check size={18} strokeWidth={STROKE} aria-hidden className="text-olive-500" />
            ) : (
              <Copy size={18} strokeWidth={STROKE} aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => share(message, url)}
            className="btn flex h-10 items-center gap-1.5 rounded-full bg-sea-700 px-4 text-sm text-cream-50"
          >
            <Share2 size={16} strokeWidth={STROKE} aria-hidden />
            {t("product.invite.send")}
          </button>
        </div>
      </div>
      {qr && <QrModal url={url} onClose={() => setQr(false)} />}
    </li>
  );
}

/**
 * The trip's invite links: one general link + one per family, each with
 * WhatsApp/native share, copy and QR. Admin-only (the API enforces it).
 */
export function InviteLinks({
  tripId,
  tripName,
  emoji,
  families,
}: {
  tripId: string;
  tripName: string;
  emoji: string;
  families: { id: string; name: string }[];
}) {
  const t = useT();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/trips/${tripId}/invites`);
      if (!response.ok) throw new Error(String(response.status));
      const { invites } = await response.json();
      setInvites(invites);
    } catch {
      setError(t("product.invite.loadFailed"));
      setInvites([]);
    }
  }, [tripId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function createGeneral() {
    setCreating(true);
    try {
      await apiFetch(`/api/trips/${tripId}/invites`, {
        method: "POST",
        body: JSON.stringify({ role: "member" }),
      });
      await load();
    } finally {
      setCreating(false);
    }
  }

  if (invites === null) {
    return <div className="h-32 animate-pulse rounded-3xl bg-cream-100" />;
  }

  const general = invites.find((i) => !i.familyId && i.role === "member");
  const perFamily = families
    .map((family) => ({
      family,
      invite: invites.find((i) => i.familyId === family.id && i.role === "member"),
    }))
    .filter((row) => row.invite);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-terra-600">{error}</p>}
      <ul className="space-y-2">
        {general ? (
          <InviteRow
            icon={Link2}
            label={t("product.invite.general")}
            hint={inviteUrl(general.code).replace(/^https?:\/\//, "")}
            url={inviteUrl(general.code)}
            message={inviteMessage({ tripName, emoji, url: inviteUrl(general.code) })}
          />
        ) : (
          <li>
            <button
              type="button"
              disabled={creating}
              onClick={createGeneral}
              className="btn-outline w-full py-3"
            >
              {creating ? t("product.invite.creating") : t("product.invite.create")}
            </button>
          </li>
        )}
        {perFamily.map(({ family, invite }) => (
          <InviteRow
            key={family.id}
            icon={Users}
            label={family.name}
            hint={t("product.invite.joined", { uses: invite!.uses, max: invite!.maxUses })}
            url={inviteUrl(invite!.code)}
            message={inviteMessage({
              tripName,
              emoji,
              familyName: family.name,
              url: inviteUrl(invite!.code),
            })}
          />
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-ink-500">
        {t("product.invite.footnote")}
      </p>
    </div>
  );
}
