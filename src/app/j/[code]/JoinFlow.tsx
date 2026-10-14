"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Link2, MapPin, UserRound, Users } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT, type TKey } from "@/i18n";
import { formatShortDate } from "@/i18n/format";
import { apiFetch, auth, signInAsGuest } from "@/lib/firebase/client";
import type { InvitePreview } from "@/lib/trip-doc";
import { useAuthUser } from "@/lib/use-auth-user";

type Preview = InvitePreview & {
  role: "admin" | "member" | "kid";
  familyId: string | null;
  families: {
    id: string;
    name: string;
    members: { id: string; name: string; kid: boolean }[];
  }[];
  aiName: string;
  aiEmoji: string;
};

const ERRORS: Record<string, TKey> = {
  not_found: "product.join.errors.notFound",
  expired: "product.join.errors.expired",
  used_up: "product.join.errors.usedUp",
  revoked: "product.join.errors.revoked",
  trip_closed: "product.join.errors.tripClosed",
};

export function JoinFlow({ code }: { code: string }) {
  const router = useRouter();
  const t = useT();
  const { user, personal, loading } = useAuthUser();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/preview?code=${encodeURIComponent(code)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "not_found");
        setPreview(body);
        setFamilyId(body.familyId);
      })
      .catch((err: Error) => setError(t(ERRORS[err.message] ?? ERRORS.not_found)));
  }, [code, t]);

  const isKidInvite = preview?.role === "kid";
  const [asGuest, setAsGuest] = useState(false);
  // Anyone already signed in (account or a guest identity) picks a name next
  const canPick = isKidInvite || personal || asGuest || Boolean(user?.isAnonymous);

  async function join(memberFamilyId: string | null, memberId: string | null) {
    if (!preview || joining) return;
    setJoining(true);
    setError("");
    try {
      if ((isKidInvite || asGuest) && !auth().currentUser) await signInAsGuest();
      const response = await apiFetch("/api/invites/redeem", {
        method: "POST",
        body: JSON.stringify({ code, familyId: memberFamilyId, memberId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          t(
            body.error === "trip_full"
              ? "product.join.errors.tripFull"
              : body.error === "sign_in_required"
                ? "product.join.errors.signInRequired"
                : (ERRORS[body.error] ?? "product.join.errors.failed")
          )
        );
        return;
      }
      // Fresh token carries the trip's storage claim
      await auth().currentUser?.getIdToken(true).catch(() => undefined);
      router.replace(`/t/${body.tripId}`);
    } catch {
      setError(t("product.join.errors.failedNetwork"));
    } finally {
      setJoining(false);
    }
  }

  if (error && !preview) {
    return (
      <ProductShell>
        <div className="card px-6 py-10 text-center">
          <Link2 size={28} strokeWidth={STROKE} aria-hidden className="mx-auto text-sea-700" />
          <p className="mt-4 font-display text-xl font-light text-ink-900">{error}</p>
          <Link href="/trips" className="btn-soft mt-6 px-5 py-3">
            {t("product.gate.myTrips")}
          </Link>
        </div>
      </ProductShell>
    );
  }

  if (!preview || loading) {
    return (
      <ProductShell>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </ProductShell>
    );
  }

  const families = familyId
    ? preview.families.filter((f) => f.id === familyId)
    : preview.families;
  // Kid links show the kids — unless the organizer didn't mark anyone as a kid
  const kidsOnly =
    isKidInvite && preview.families.some((f) => f.members.some((m) => m.kid));

  return (
    <ProductShell>
      <div className="space-y-6">
        <section className="card overflow-hidden">
          <div className="relative h-44 bg-sea-900">
            {preview.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden className="absolute inset-0 flex items-center justify-center text-cream-50/60">
                <Glyph value={preview.emoji} size={52} />
              </span>
            )}
            <div className="hero-overlay absolute inset-0" />
            <div className="absolute inset-x-5 bottom-4">
              <p className="kicker text-lemon-300">{t("product.join.invited")}</p>
              <h1 className="mt-1 font-display text-3xl font-light text-cream-50">
                {preview.name}
              </h1>
            </div>
          </div>
          <ul className="space-y-2 px-5 py-5 text-sm text-ink-700">
            <li className="flex items-center gap-2.5">
              <MapPin size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
              <span>
                {preview.destination} ·{" "}
                <span dir="ltr" className="numerals">
                  {formatShortDate(preview.startDate)}–{formatShortDate(preview.endDate)}
                </span>
              </span>
            </li>
            {preview.organizer && (
              <li className="flex items-center gap-2.5">
                <UserRound size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
                {t("product.join.organizers", { name: preview.organizer })}
              </li>
            )}
            <li className="flex items-center gap-2.5">
              <Glyph value={preview.aiEmoji} size={16} className="shrink-0 text-ink-500" />
              {t("product.join.aiWaiting", { name: preview.aiName })}
            </li>
            {preview.memberCount > 1 && (
              <li className="flex items-center gap-2.5">
                <Users size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
                {t("product.join.alreadyIn", { count: preview.memberCount })}
              </li>
            )}
          </ul>
        </section>

        {!canPick ? (
          <section className="card space-y-4 px-5 py-6 text-center">
            <h2 className="font-display text-xl font-light text-ink-900">
              {t("product.join.signInTitle")}
            </h2>
            <p className="text-sm text-ink-500">{t("product.join.signInText")}</p>
            <SignInPanel />
            <div className="flex items-center gap-3 text-xs text-ink-300">
              <span className="h-px flex-1 bg-cream-200" />
              {t("common.or")}
              <span className="h-px flex-1 bg-cream-200" />
            </div>
            <button
              type="button"
              onClick={() => setAsGuest(true)}
              className="btn-soft w-full py-3.5 text-base"
            >
              {t("product.join.guest")}
            </button>
            <p className="text-xs leading-relaxed text-ink-500">
              {t("product.join.guestNote")}
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-light text-ink-900">
              {kidsOnly ? t("product.join.whoKids") : t("product.join.whoGroup")}
            </h2>
            {families.length > 1 && (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {families.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => setFamilyId(family.id)}
                    className={`chip ${familyId === family.id ? "chip-active" : ""}`}
                  >
                    {family.name}
                  </button>
                ))}
              </div>
            )}
            {families.length === 1 || familyId ? (
              <div className="flex flex-wrap gap-2">
                {(preview.families.find((f) => f.id === (familyId ?? families[0].id))?.members ?? [])
                  .filter((m) => (kidsOnly ? m.kid : true))
                  .map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={joining}
                      onClick={() => join(familyId ?? families[0].id, member.id)}
                      className="rounded-full bg-sea-700 px-5 py-3 text-base font-medium text-cream-50 transition active:scale-[0.97] disabled:opacity-50"
                    >
                      {member.name}
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">{t("product.join.pickFamily")}</p>
            )}
            {!kidsOnly && (
              <button
                type="button"
                disabled={joining}
                onClick={() => join(familyId, null)}
                className="w-full pt-2 text-center text-sm font-medium text-sea-700 underline underline-offset-2"
              >
                {joining ? t("product.join.joining") : t("product.join.notListed")}
              </button>
            )}
            {user && personal && (
              <p className="text-center text-xs text-ink-500">
                {t("product.join.signedInAs", { name: user.displayName || user.email || "" })}
              </p>
            )}
            {!personal && !isKidInvite && (
              <p className="text-center text-xs text-ink-500">
                {t("product.join.guestHint")}
              </p>
            )}
          </section>
        )}
        {error && (
          <p role="alert" className="text-center text-sm font-medium text-terra-600">
            {error}
          </p>
        )}
      </div>
    </ProductShell>
  );
}
