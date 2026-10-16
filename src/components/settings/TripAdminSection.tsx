"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Check, Copy, Pencil, Smartphone, UserPlus } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { InviteLinks, inviteUrl } from "@/components/product/InviteLinks";
import { SURFACE } from "@/components/settings/SettingsGroup";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STROKE } from "@/components/ui/Icon";
import { useT, type TKey } from "@/i18n";
import { apiFetch } from "@/lib/firebase/client";
import { useCollectionData, useDocData } from "@/lib/hooks";
import type { TripMember } from "@/lib/trip-doc";

const ROLE_LABEL: Record<string, TKey | null> = {
  owner: "product.admin.roles.owner",
  admin: "product.admin.roles.admin",
  member: null,
  kid: "product.admin.roles.kid",
};

export interface TripRole {
  /** Self-serve trip and my membership doc has loaded */
  ready: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isKid: boolean;
}

/** My role in a self-serve trip (legacy trips have no roles). */
export function useTripRole(): TripRole {
  const trip = useTrip();
  const { user } = useFirebase();
  const { data: me } = useDocData<TripMember>(
    trip.legacy ? "_/_" : `${trip.path}/members/${user?.uid ?? "_"}`,
  );
  const ready = !trip.legacy && !!user && !!me;
  return {
    ready,
    isAdmin: ready && (me!.role === "owner" || me!.role === "admin"),
    isOwner: ready && me!.role === "owner",
    isKid: ready && me!.role === "kid",
  };
}

async function deleteFromTrip(tripId: string, query: string) {
  const response = await apiFetch(`/api/trips/${tripId}?${query}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(String(response.status));
}

/** Admins: the trip's invite links, front and center. */
export function InviteCard({
  families,
  myFamilyId = null,
}: {
  families: { id: string; name: string; members?: number }[];
  myFamilyId?: string | null;
}) {
  const t = useT();
  const trip = useTrip();
  return (
    <div className={`${SURFACE} p-4 ring-1 ring-brass-300/70`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brass-100 text-brass-600"
        >
          <UserPlus size={20} strokeWidth={STROKE} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium text-ink-900">
            {t("product.admin.inviteTitle")}
          </h3>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
            {t("settings.invite.lead")}
          </p>
        </div>
      </div>
      <div className="-mx-2 mt-4">
        <InviteLinks
          tripId={trip.id}
          tripName={trip.name}
          emoji={trip.emoji}
          families={families}
          myFamilyId={myFamilyId}
        />
      </div>
      <Link
        href={`/new?trip=${trip.id}`}
        className="btn-soft mt-3 min-h-11 w-full text-sm"
      >
        <Pencil size={16} strokeWidth={STROKE} aria-hidden />
        {t("product.admin.editTrip")}
      </Link>
    </div>
  );
}

/** Pair a kid's phone with a 24h link (no email, no password). */
export function KidDevicesCard() {
  const t = useT();
  const trip = useTrip();
  const [kidLink, setKidLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

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

  return (
    <div className={`${SURFACE} p-4`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-200 text-ink-700"
        >
          <Smartphone size={18} strokeWidth={STROKE} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-ink-900">
            {t("product.admin.kidsTitle")}
          </h3>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
            {t("product.admin.kidsText")}
          </p>
        </div>
      </div>
      {kidLink ? (
        <div className="mt-3 space-y-2">
          <p
            className="truncate rounded-xl bg-cream-100 px-3 py-2.5 text-xs text-ink-700"
            dir="ltr"
          >
            {kidLink}
          </p>
          <button
            type="button"
            className="btn-soft min-h-11 w-full text-sm"
            onClick={async () => {
              await navigator.clipboard?.writeText(kidLink).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? (
              <Check size={16} strokeWidth={STROKE} aria-hidden className="text-route-500" />
            ) : (
              <Copy size={16} strokeWidth={STROKE} aria-hidden />
            )}
            {t("product.admin.copyLink")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={pairKid}
          className="btn-outline mt-3 min-h-11 w-full text-sm"
        >
          {busy ? t("product.admin.wait") : t("product.admin.createKidLink")}
        </button>
      )}
      {message && (
        <p role="alert" className="mt-2 text-sm text-terra-600">
          {message}
        </p>
      )}
    </div>
  );
}

/** Admins: everyone who joined, with removal. */
export function MembersCard() {
  const t = useT();
  const trip = useTrip();
  const { user } = useFirebase();
  const { data: members } = useCollectionData<TripMember & { id: string }>(
    `${trip.path}/members`,
  );
  const [target, setTarget] = useState<{ uid: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const close = useCallback(() => {
    setTarget(null);
    setError("");
  }, []);

  if (!members || !user) return null;
  const removeName = target ? target.name || t("product.admin.theParticipant") : "";

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <h3 className="px-4 pb-1 pt-4 text-[15px] font-medium text-ink-900">
        {t("product.admin.members", { count: members.length })}
      </h3>
      <ul className="divide-y divide-cream-200/80">
        {members.map((member) => (
          <li key={member.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-100 text-sm font-medium text-ink-700"
            >
              {(member.displayName || "?").slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-900">
                <bdi>{member.displayName || t("product.admin.noName")}</bdi>
              </span>
              {(ROLE_LABEL[member.role] || member.guest) && (
                <span className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-ink-500">
                  {ROLE_LABEL[member.role] && <span>{t(ROLE_LABEL[member.role]!)}</span>}
                  {member.guest && (
                    <span className="rounded-full bg-cream-100 px-2">
                      {t("product.admin.guest")}
                    </span>
                  )}
                </span>
              )}
            </span>
            {member.role !== "owner" && member.id !== user.uid && (
              <button
                type="button"
                onClick={() => setTarget({ uid: member.id, name: member.displayName })}
                className="-me-2 min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-terra-600 active:bg-terra-100"
              >
                {t("product.admin.remove")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!target}
        title={t("product.admin.removeConfirm", { name: removeName })}
        description={t("product.admin.removeText", { name: removeName })}
        confirmLabel={t("product.admin.remove")}
        error={error}
        onConfirm={async () => {
          if (!target) return;
          setError("");
          try {
            await deleteFromTrip(trip.id, `member=${encodeURIComponent(target.uid)}`);
            close();
          } catch {
            setError(t("product.admin.removeFailed"));
          }
        }}
        onClose={close}
      />
    </div>
  );
}

/** Last on the page: leave the trip, or (owner) delete it for everyone. */
export function TripDangerZone({ isOwner }: { isOwner: boolean }) {
  const t = useT();
  const trip = useTrip();
  const [dialog, setDialog] = useState<"leave" | "purge" | null>(null);
  const [error, setError] = useState("");
  const close = useCallback(() => {
    setDialog(null);
    setError("");
  }, []);

  async function run(query: string, failKey: TKey) {
    setError("");
    try {
      await deleteFromTrip(trip.id, query);
      window.location.replace("/trips");
    } catch {
      setError(t(failKey));
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-terra-200 bg-white p-4">
        {isOwner ? (
          <>
            <p className="text-sm leading-relaxed text-ink-500">
              {t("product.admin.deleteTripHint")}
            </p>
            <button
              type="button"
              onClick={() => setDialog("purge")}
              className="btn-outline mt-3 min-h-11 w-full border-terra-200 text-terra-600"
            >
              {t("product.admin.deleteTrip")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setDialog("leave")}
            className="btn-outline min-h-11 w-full border-terra-200 text-terra-600"
          >
            {t("product.admin.leave")}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={dialog === "leave"}
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
        error={error}
        onConfirm={() => run("member=self", "product.admin.leaveFailed")}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog === "purge"}
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
        error={error}
        onConfirm={() => run("purge=1", "product.admin.deleteTripFailed")}
        onClose={close}
      />
    </>
  );
}
