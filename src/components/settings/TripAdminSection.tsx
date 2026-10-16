"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Pencil, Smartphone } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { InviteLinks, inviteUrl } from "@/components/product/InviteLinks";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const { user, profile } = useFirebase();
  const { families } = useFamilies();
  const { data: me } = useDocData<TripMember>(
    `${trip.path}/members/${user?.uid ?? "_"}`,
  );
  const { data: members } = useCollectionData<TripMember & { id: string }>(
    `${trip.path}/members`,
  );
  const [kidLink, setKidLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Which destructive dialog is open (member removal carries its target)
  const [dialog, setDialog] = useState<
    | { kind: "remove"; uid: string; name: string }
    | { kind: "leave" }
    | { kind: "purge" }
    | null
  >(null);
  const [dialogError, setDialogError] = useState("");
  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogError("");
  }, []);

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

  async function runDelete(query: string, failKey: TKey, after?: () => void) {
    setDialogError("");
    try {
      const response = await apiFetch(`/api/trips/${trip.id}?${query}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(String(response.status));
      if (after) after();
      else closeDialog();
    } catch {
      setDialogError(t(failKey));
    }
  }

  const isOwner = me.role === "owner";
  const removeName =
    dialog?.kind === "remove"
      ? dialog.name || t("product.admin.theParticipant")
      : "";

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
            families={(families ?? []).map((f) => ({ id: f.id, name: f.name, members: f.members.length }))}
            myFamilyId={profile?.familyId ?? null}
          />
        </section>
      )}

      {!isKid && (
        <section className="card space-y-3 px-4 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-normal text-ink-900">
            <Smartphone
              size={18}
              strokeWidth={STROKE}
              aria-hidden
              className="shrink-0 text-ink-500"
            />
            {t("product.admin.kidsTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-ink-500">
            {t("product.admin.kidsText")}
          </p>
          {kidLink ? (
            <div className="space-y-2">
              <p
                className="rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink-700"
                dir="ltr"
              >
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
              {busy
                ? t("product.admin.wait")
                : t("product.admin.createKidLink")}
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
                    onClick={() =>
                      setDialog({
                        kind: "remove",
                        uid: member.id,
                        name: member.displayName,
                      })
                    }
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

      {!isKid && (
        <section className="space-y-3 rounded-2xl border border-terra-200 px-4 py-4">
          <h2 className="kicker text-terra-600">
            {t("product.admin.dangerTitle")}
          </h2>
          {isOwner ? (
            <>
              <p className="text-sm leading-relaxed text-ink-500">
                {t("product.admin.deleteTripHint")}
              </p>
              <button
                type="button"
                onClick={() => setDialog({ kind: "purge" })}
                className="btn-outline w-full border-terra-200 py-3 text-terra-600"
              >
                {t("product.admin.deleteTrip")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDialog({ kind: "leave" })}
              className="btn-outline w-full border-terra-200 py-3 text-terra-600"
            >
              {t("product.admin.leave")}
            </button>
          )}
        </section>
      )}
      {message && (
        <p className="text-center text-sm text-terra-600">{message}</p>
      )}

      <ConfirmDialog
        open={dialog?.kind === "remove"}
        title={t("product.admin.removeConfirm", { name: removeName })}
        description={t("product.admin.removeText", { name: removeName })}
        confirmLabel={t("product.admin.remove")}
        error={dialogError}
        onConfirm={() =>
          dialog?.kind === "remove"
            ? runDelete(
                `member=${encodeURIComponent(dialog.uid)}`,
                "product.admin.removeFailed",
              )
            : undefined
        }
        onClose={closeDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "leave"}
        title={t("product.admin.leaveConfirm")}
        description={t("product.admin.leaveText")}
        items={[
          t("product.admin.leaveItems.chats"),
          t("product.admin.leaveItems.documents"),
          t("product.admin.leaveItems.location"),
          t("product.admin.leaveItems.shared"),
        ]}
        confirmWord={t("common.confirm.word")}
        confirmLabel={t("product.admin.leaveAction")}
        error={dialogError}
        onConfirm={() =>
          runDelete("member=self", "product.admin.leaveFailed", () =>
            window.location.replace("/trips"),
          )
        }
        onClose={closeDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "purge"}
        title={t("product.admin.deleteTripTitle", { name: trip.name })}
        description={t("product.admin.deleteTripText")}
        items={[
          t("product.admin.deleteTripItems.content"),
          t("product.admin.deleteTripItems.files"),
          t("product.admin.deleteTripItems.chats"),
          t("product.admin.deleteTripItems.people"),
        ]}
        confirmWord={t("common.confirm.word")}
        confirmLabel={t("product.admin.deleteTrip")}
        error={dialogError}
        onConfirm={() =>
          runDelete("purge=1", "product.admin.deleteTripFailed", () =>
            window.location.replace("/trips"),
          )
        }
        onClose={closeDialog}
      />
    </>
  );
}
