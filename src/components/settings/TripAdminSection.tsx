"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Smartphone } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { InviteLinks, inviteUrl } from "@/components/product/InviteLinks";
import { STROKE } from "@/components/ui/Icon";
import { useT, type TKey } from "@/i18n";
import { apiFetch } from "@/lib/firebase/client";
import { useCollectionData, useDocData, useFamilies } from "@/lib/hooks";
import type { TripMember } from "@/lib/trip-doc";

const ROLE_LABEL: Record<string, TKey | null> = {
  owner: "product.admin.roles.owner",
  admin: "product.admin.roles.admin",
  member: null,
  kid: "product.admin.roles.kid",
};

/** Self-serve trips: organizer tools + kid-device pairing + leave trip. */
export function TripAdminSection() {
  const t = useT();
  const trip = useTrip();
  const { user } = useFirebase();
  const { families } = useFamilies();
  const { data: me } = useDocData<TripMember>(
    `${trip.path}/members/${user?.uid ?? "_"}`
  );
  const { data: members } = useCollectionData<TripMember & { id: string }>(
    `${trip.path}/members`
  );
  const [kidLink, setKidLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (trip.legacy || !user || !me) return null;
  const isAdmin = me.role === "owner" || me.role === "admin";
  const isKid = me.role === "kid";

  async function pairKid() {
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch(`/api/trips/${trip.id}/invites`, {
        method: "POST",
        body: JSON.stringify({ role: "kid" }),
      });
      if (!response.ok) throw new Error();
      const { code } = await response.json();
      setKidLink(inviteUrl(code));
    } catch {
      setMessage(t("product.admin.kidLinkFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(uid: string, name: string) {
    if (!confirm(t("product.admin.removeConfirm", { name: name || t("product.admin.theParticipant") }))) return;
    await apiFetch(`/api/trips/${trip.id}?member=${uid}`, { method: "DELETE" });
  }

  async function leave() {
    if (!confirm(t("product.admin.leaveConfirm"))) return;
    const response = await apiFetch(`/api/trips/${trip.id}?member=self`, {
      method: "DELETE",
    });
    if (response.ok) window.location.replace("/trips");
    else setMessage(t("product.admin.leaveFailed"));
  }

  return (
    <>
      {isAdmin && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-normal text-ink-900">
              {t("product.admin.inviteTitle")}
            </h2>
            <Link
              href={`/new?trip=${trip.id}`}
              className="chip gap-1.5 text-sea-700"
            >
              <Pencil size={14} strokeWidth={STROKE} aria-hidden />
              {t("product.admin.editTrip")}
            </Link>
          </div>
          <InviteLinks
            tripId={trip.id}
            tripName={trip.name}
            emoji={trip.emoji}
            families={(families ?? []).map((f) => ({ id: f.id, name: f.name }))}
          />
        </section>
      )}

      {!isKid && (
        <section className="card space-y-3 px-4 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-normal text-ink-900">
            <Smartphone size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
            {t("product.admin.kidsTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-ink-500">{t("product.admin.kidsText")}</p>
          {kidLink ? (
            <div className="space-y-2">
              <p className="rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink-700" dir="ltr">
                {kidLink}
              </p>
              <button
                type="button"
                className="btn-soft w-full py-2.5 text-sm"
                onClick={() => navigator.clipboard?.writeText(kidLink)}
              >
                {t("product.admin.copyLink")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={pairKid}
              className="btn-outline w-full py-2.5 text-sm"
            >
              {busy ? t("product.admin.wait") : t("product.admin.createKidLink")}
            </button>
          )}
        </section>
      )}

      {isAdmin && members && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-normal text-ink-900">
            {t("product.admin.members", { count: members.length })}
          </h2>
          <ul className="card divide-y divide-cream-200/80 overflow-hidden">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cream-200 bg-cream-100 text-sm font-medium text-sea-700">
                  {(member.displayName || "?").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                  {member.displayName || t("product.admin.noName")}
                  {ROLE_LABEL[member.role] && (
                    <span className="ms-2 text-xs text-ink-500">
                      {t(ROLE_LABEL[member.role]!)}
                    </span>
                  )}
                  {member.guest && (
                    <span className="ms-2 rounded-full bg-cream-100 px-2 py-0.5 text-xs text-ink-500">
                      {t("product.admin.guest")}
                    </span>
                  )}
                </span>
                {member.role !== "owner" && member.id !== user.uid && (
                  <button
                    type="button"
                    onClick={() => removeMember(member.id, member.displayName)}
                    className="text-xs font-medium text-terra-600"
                  >
                    {t("product.admin.remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {me.role !== "owner" && (
        <button
          type="button"
          onClick={leave}
          className="w-full text-center text-sm font-medium text-terra-600"
        >
          {t("product.admin.leave")}
        </button>
      )}
      {message && <p className="text-center text-sm text-terra-600">{message}</p>}
    </>
  );
}
