"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { avatarSrc } from "@together/shared/avatars";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Ban, Check, Hourglass, Link2Off, Lock, UsersRound, type LucideIcon } from "lucide-react";
import { RouteArt } from "@/components/journal/RouteArt";
import { InviteCodeEntry } from "@/components/onboarding/InviteCodeEntry";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT, type TKey } from "@/i18n";
import { formatShortDate } from "@together/i18n/format";
import { signInAsGuest } from "@/lib/sign-in";
import type { InvitePreview } from "@together/shared/trip-doc";
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
  aiAvatar?: string | null;
};

type PreviewResult = Extract<NonNullable<ReturnType<typeof useQuery<typeof api.invites.preview>>>, { ok: true }>;

function toPreview(code: string, result: PreviewResult): Preview {
  const familyId = result.families.length === 1 && result.familyName ? result.families[0].id : null;
  return {
    tripId: code,
    name: result.trip.name,
    emoji: result.trip.emoji,
    destination: result.trip.destination,
    startDate: result.trip.startDate,
    endDate: result.trip.endDate,
    coverImage: result.trip.coverImage,
    groupName: result.trip.groupName,
    familyName: result.familyName,
    memberCount: result.trip.memberCount,
    organizer: result.trip.organizer,
    role: result.role,
    familyId,
    families: result.families.map((family) => ({
      id: family.id,
      name: family.name,
      members: family.members.map((member) => ({ id: member.key, name: member.name, kid: member.kid })),
    })),
    aiName: result.trip.ai.name,
    aiEmoji: result.trip.ai.emoji,
    aiAvatar: avatarSrc(result.trip.ai.avatar),
  };
}

const ERROR_ICON: Record<string, LucideIcon> = {
  not_found: Link2Off,
  expired: Hourglass,
  used_up: UsersRound,
  revoked: Ban,
  trip_closed: Lock,
};

const ERROR_TITLES: Record<string, TKey> = {
  not_found: "product.join.errorTitles.notFound",
  expired: "product.join.errorTitles.expired",
  used_up: "product.join.errorTitles.usedUp",
  revoked: "product.join.errorTitles.revoked",
  trip_closed: "product.join.errorTitles.tripClosed",
};

const ERRORS: Record<string, TKey> = {
  not_found: "product.join.errors.notFound",
  expired: "product.join.errors.expired",
  used_up: "product.join.errors.usedUp",
  revoked: "product.join.errors.revoked",
  trip_closed: "product.join.errors.tripClosed",
};

/** App scheme for "Open in the app": the dev build (togehter.app / localhost) has its own scheme. */
function appLink(code: string): string {
  const dev = /^(togehter\.app|localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return `${dev ? "together-dev" : "together"}://j/${code}`;
}

export function JoinFlow({ code }: { code: string }) {
  const router = useRouter();
  const t = useT();
  // Phones (touch) can hand the invite to the installed app; desktops can't
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  const { user, personal, loading } = useAuthUser();
  // Public, live preview of the invite (works before sign-in)
  const result = useQuery(api.invites.preview, { code });
  const redeem = useMutation(api.invites.redeem);
  const preview: Preview | null = useMemo(() => (result?.ok ? toPreview(code, result) : null), [code, result]);
  const errorCode = result && !result.ok ? (result.error in ERRORS ? result.error : "not_found") : "not_found";
  const [joinError, setJoinError] = useState("");
  const error = joinError || (result && !result.ok ? t(ERRORS[errorCode]) : "");
  const setError = setJoinError;
  const [pickedFamilyId, setFamilyId] = useState<string | null>(null);
  const familyId = pickedFamilyId ?? preview?.familyId ?? null;
  const [joining, setJoining] = useState(false);
  // A freshly created guest identity takes a moment to reach Convex
  const { isAuthenticated } = useConvexAuth();
  const authed = useRef(isAuthenticated);
  useEffect(() => {
    authed.current = isAuthenticated;
  }, [isAuthenticated]);
  async function waitForAuth() {
    for (let i = 0; i < 50 && !authed.current; i++) await new Promise((r) => setTimeout(r, 200));
  }

  const isKidInvite = preview?.role === "kid";
  const [asGuest, setAsGuest] = useState(false);
  // Anyone already signed in (account or a guest identity) picks a name next
  const canPick = isKidInvite || personal || asGuest || Boolean(user?.isAnonymous);

  async function join(memberFamilyId: string | null, memberId: string | null) {
    if (!preview || joining) return;
    setJoining(true);
    setError("");
    try {
      if ((isKidInvite || asGuest) && !user) {
        await signInAsGuest();
        // The new identity must reach Convex before redeeming
        await waitForAuth();
      }
      let tripId: string;
      try {
        tripId = await redeem({
          code,
          familyId: memberFamilyId as Id<"families"> | null,
          memberKey: memberId,
        });
      } catch (err) {
        const detail = (err as { data?: { detail?: string; code?: string } }).data;
        const reason = detail?.detail ?? detail?.code ?? "";
        setError(
          t(
            reason === "trip_full"
              ? "product.join.errors.tripFull"
              : reason === "sign_in_required"
                ? "product.join.errors.signInRequired"
                : (ERRORS[reason] ?? "product.join.errors.failed")
          )
        );
        return;
      }
      router.replace(`/t/${tripId}`);
    } catch {
      setError(t("product.join.errors.failedNetwork"));
    } finally {
      setJoining(false);
    }
  }

  if (error && !preview) {
    const ErrorIcon = ERROR_ICON[errorCode] ?? Link2Off;
    return (
      <ProductShell>
        <section className="relative -mx-4 -mt-8 overflow-hidden bg-night-950 text-cream-50 md:mx-0 md:mt-0 md:rounded-[1.75rem]">
          <div className="relative h-48 opacity-70">
            <RouteArt seed={code} />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-night-950 to-transparent" />
          </div>
          <div className="relative px-6 pb-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cream-50/15 bg-night-800 text-cream-50/85">
              <ErrorIcon size={22} strokeWidth={STROKE} aria-hidden />
            </span>
            <h1 className="mt-5 font-display text-[1.75rem] font-medium leading-tight">
              {t(ERROR_TITLES[errorCode] ?? ERROR_TITLES.not_found)}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-cream-50/75">{error}</p>
            <InviteCodeEntry className="mt-6" />
            <Link
              href="/trips"
              className="btn mt-6 w-full rounded-2xl bg-cream-50 py-3.5 text-base font-semibold text-night-950"
            >
              {t("product.gate.myTrips")}
            </Link>
          </div>
        </section>
      </ProductShell>
    );
  }

  if (!preview || loading) {
    return (
      <ProductShell>
        <div className="space-y-6">
          <Skeleton className="-mx-4 -mt-8 h-[22rem] md:mx-0 md:mt-0" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </ProductShell>
    );
  }

  const families = familyId
    ? preview.families.filter((f) => f.id === familyId)
    : preview.families;
  // Kid links show the kids — unless the organizer didn't mark anyone as a kid
  const kidsOnly =
    isKidInvite && preview.families.some((f) => f.members.some((m) => m.kid));
  const travelers = preview.families.flatMap((f) => f.members);
  const activeFamily = preview.families.find((f) => f.id === (familyId ?? families[0]?.id));
  const pickable = (families.length === 1 || familyId ? activeFamily?.members ?? [] : []).filter((m) =>
    kidsOnly ? m.kid : true
  );
  const step = (n: number) =>
    !isKidInvite && (
      <p className="text-sm text-ink-500">{t("product.join.stepOf", { n, total: 2 })}</p>
    );

  return (
    <ProductShell>
      <div className="space-y-8">
        {/* Hero: the trip as an invitation */}
        <section className="relative -mx-4 -mt-8 overflow-hidden bg-night-950 md:mx-0 md:mt-0 md:rounded-[1.75rem]">
          <div className="relative h-[22rem] md:h-[26rem]">
            {preview.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <RouteArt seed={preview.tripId} focus="top" />
            )}
            <div className="hero-overlay absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 px-6 pb-16">
              <p className="text-sm font-medium text-brass-100">{t("product.join.invited")}</p>
              <h1 className="mt-1.5 font-display text-display-sm font-medium text-cream-50">
                <bdi>{preview.name}</bdi>
              </h1>
              <p className="mt-2 text-[15px] text-cream-50/85">
                <bdi>{preview.destination}</bdi> ·{" "}
                <span dir="ltr" className="tabular-nums">
                  {formatShortDate(preview.startDate)}–{formatShortDate(preview.endDate)}
                </span>
              </p>
              {preview.organizer && (
                <p className="mt-1 text-sm text-cream-50/70">
                  {t("product.join.organizers", { name: preview.organizer })}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* The guide and the group, waiting at the meeting point */}
        <section className="relative -mt-16 space-y-4 rounded-2xl bg-white px-5 py-5 shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-night-900 text-brass-300 ring-2 ring-brass-500 ring-offset-2 ring-offset-white">
              {preview.aiAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar
                <img src={preview.aiAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <Glyph value={preview.aiEmoji} size={24} />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-medium text-ink-900">
                <bdi>{preview.aiName}</bdi>
              </p>
              <p className="text-sm text-ink-500">{t("product.join.guideRole")}</p>
            </div>
          </div>
          {travelers.length > 0 && (
            <div className="flex items-center gap-3 border-t border-chart-200 pt-4">
              <span className="flex shrink-0 -space-x-2">
                {travelers.slice(0, 5).map((person) => (
                  <span
                    key={person.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-chart-100 text-xs font-medium text-ink-700"
                  >
                    {person.name.slice(0, 1)}
                  </span>
                ))}
              </span>
              <p className="min-w-0 text-sm text-ink-700">
                {preview.groupName ? (
                  <>
                    <bdi className="font-medium text-ink-900">{preview.groupName}</bdi> ·{" "}
                  </>
                ) : null}
                {t("product.join.travelers", { count: travelers.length })}
                {preview.memberCount > 1 && (
                  <span className="text-ink-500"> · {t("product.join.alreadyIn", { count: preview.memberCount })}</span>
                )}
              </p>
            </div>
          )}
        </section>

        {touch && (
          <a
            href={appLink(code)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-chart-200 bg-white px-4 py-3.5 text-[15px] font-medium text-ink-900"
          >
            {t("product.join.openInApp")}
            <ArrowUpRight size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-route-500" />
          </a>
        )}

        {!canPick ? (
          <section className="space-y-5">
            <div>
              {step(1)}
              <h2 className="mt-1 font-display text-2xl font-medium text-ink-900">
                {t("product.join.signInTitle")}
              </h2>
              <p className="mt-1.5 text-[15px] text-ink-500">{t("product.join.signInText")}</p>
            </div>
            <SignInPanel />
            <div className="flex items-center gap-3 text-xs text-ink-400">
              <span className="h-px flex-1 bg-chart-200" />
              {t("common.or")}
              <span className="h-px flex-1 bg-chart-200" />
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setAsGuest(true)}
                className="btn-soft w-full py-3.5 text-base"
              >
                {t("product.join.guest")}
              </button>
              <p className="px-2 text-center text-xs leading-relaxed text-ink-500">
                {t("product.join.guestNote")}
              </p>
            </div>
            <p className="border-t border-chart-200 pt-4 text-center text-xs leading-relaxed text-ink-500">
              {t("product.welcome.consent.before")}
              <Link href="/terms" className="underline underline-offset-2">
                {t("product.welcome.consent.terms")}
              </Link>
              {t("product.welcome.consent.between")}
              <Link href="/privacy" className="underline underline-offset-2">
                {t("product.welcome.consent.privacy")}
              </Link>
              {t("product.welcome.consent.after")}
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <div>
              {step(2)}
              <h2 className="mt-1 font-display text-2xl font-medium text-ink-900">
                {kidsOnly ? t("product.join.whoKids") : t("product.join.whoGroup")}
              </h2>
            </div>
            {families.length > 1 && (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {families.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => setFamilyId(family.id)}
                    className={`chip min-h-11 px-4 ${familyId === family.id ? "chip-active" : ""}`}
                  >
                    <bdi>{family.name}</bdi>
                  </button>
                ))}
              </div>
            )}
            {families.length === 1 || familyId ? (
              <div className="grid grid-cols-2 gap-2.5">
                {pickable.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    disabled={joining}
                    onClick={() => join(familyId ?? families[0].id, member.id)}
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-chart-200 bg-white px-3 py-2.5 text-start transition hover:border-sea-500 active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sea-900 text-sm font-medium text-cream-50">
                      {member.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 truncate font-medium text-ink-900" dir="auto">
                      {member.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-cream-300 px-4 py-4 text-sm text-ink-500">
                {t("product.join.pickFamily")}
              </p>
            )}
            {!kidsOnly && (
              <button
                type="button"
                disabled={joining}
                onClick={() => join(familyId, null)}
                className="min-h-11 w-full text-center text-sm font-medium text-route-700 underline underline-offset-4"
              >
                {joining ? t("product.join.joining") : t("product.join.notListed")}
              </button>
            )}
            {user && personal && (
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-500">
                <Check size={14} strokeWidth={STROKE} aria-hidden className="text-route-500" />
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
          <p role="alert" className="rounded-2xl bg-terra-100 px-4 py-3 text-center text-sm font-medium text-terra-600">
            {error}
          </p>
        )}
      </div>
    </ProductShell>
  );
}
