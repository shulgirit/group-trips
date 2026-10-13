"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, QrCode, Share2, X } from "lucide-react";
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

export function inviteMessage(opts: {
  tripName: string;
  emoji: string;
  familyName?: string | null;
  url: string;
}): string {
  const who = opts.familyName ? ` (${opts.familyName})` : "";
  return `${opts.emoji} הוזמנתם לטיול "${opts.tripName}"${who}!\nכל הלו״ז, המפה, ההוצאות ועוזר ה-AI שלנו — במקום אחד.\nלהצטרפות: ${opts.url}`;
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
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-ink-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="קוד QR להצטרפות" className="mx-auto w-full rounded-2xl" />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-cream-100" />
        )}
        <p className="mt-3 text-sm text-ink-500">סורקים במצלמה ומצטרפים</p>
      </div>
    </div>
  );
}

function InviteRow({
  label,
  hint,
  url,
  message,
}: {
  label: string;
  hint: string;
  url: string;
  message: string;
}) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  return (
    <li className="rounded-2xl border border-cream-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{label}</p>
          <p className="truncate text-xs text-ink-500" dir="ltr">
            {hint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setQr(true)}
            aria-label="קוד QR"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-ink-700"
          >
            <QrCode className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(url).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            aria-label="העתקת קישור"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-ink-700"
          >
            {copied ? <Check className="h-4.5 w-4.5 text-olive-500" /> : <Copy className="h-4.5 w-4.5" />}
          </button>
          <button
            type="button"
            onClick={() => share(message, url)}
            className="btn flex h-10 items-center gap-1.5 bg-[#25D366] px-3 text-sm text-white"
          >
            <Share2 className="h-4 w-4" />
            שליחה
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
      setError("לא הצלחנו לטעון את קישורי ההזמנה");
      setInvites([]);
    }
  }, [tripId]);

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
            label="🔗 קישור כללי לכל החבורה"
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
              {creating ? "יוצרים…" : "יצירת קישור הזמנה"}
            </button>
          </li>
        )}
        {perFamily.map(({ family, invite }) => (
          <InviteRow
            key={family.id}
            label={`👨‍👩‍👧 ${family.name}`}
            hint={`${invite!.uses}/${invite!.maxUses} הצטרפו`}
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
        קישור משפחתי מסמן מראש את המשפחה — מי שנכנס רק בוחר את השם שלו.
        הקישורים בתוקף 60 יום.
      </p>
    </div>
  );
}
