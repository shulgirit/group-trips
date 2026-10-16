"use client";

import { useState } from "react";
import Image from "next/image";
import { doc, setDoc } from "firebase/firestore";
import { BedDouble, CalendarDays, Check, ChevronRight, Coins, Download, GraduationCap, UserRound } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { AboutUsSection } from "@/components/settings/AboutUsSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import {
  InviteCard,
  KidDevicesCard,
  MembersCard,
  TripDangerZone,
  useTripRole,
} from "@/components/settings/TripAdminSection";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { SettingsGroup, SURFACE } from "@/components/settings/SettingsGroup";
import { SaveAccountCard } from "@/components/settings/SaveAccountCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { STROKE } from "@/components/ui/Icon";
import { db, signInWithGoogle } from "@/lib/firebase/client";
import { logoutEverywhere } from "@/lib/logout";
import { useFamilies } from "@/lib/hooks";
import { googleMapsUrl } from "@together/shared/nav";
import { tripDays } from "@together/shared/trip";
import { useTrip } from "@/components/providers/TripProvider";
import { useDayLabel, useLocale, useT } from "@/i18n";
import { intlLocale } from "@together/i18n/format";

function currencyNames(codes: string[], locale: string): string {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "currency" });
  } catch {
    // Older engines — fall back to ISO codes
  }
  return codes.map((code) => names?.of(code) ?? code).join(" · ");
}

export default function SettingsPage() {
  const { user, personal, profile } = useFirebase();
  const trip = useTrip();
  const t = useT();
  const dayLabel = useDayLabel();
  const { locale } = useLocale();
  const { families } = useFamilies();
  const [pickingFamilyId, setPickingFamilyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const linkedFamily = families?.find((f) => f.id === profile?.familyId);
  const linkedMember = linkedFamily?.members.find(
    (m) => m.id === profile?.memberId
  );
  const currencies = [
    ...new Set([...trip.stops.map((s) => s.currency), trip.currency, "ILS", "USD"]),
  ].filter(Boolean);
  const dayCount = tripDays(trip).length;

  async function handleGoogleSignIn() {
    setMessage("");
    setBusy(true);
    try {
      const googleUser = await signInWithGoogle();
      // Legacy sessions upgrade silently — the valid cookie skips the join code
      const idToken = await googleUser.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
    } catch {
      setMessage(t("settings.account.signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    await logoutEverywhere();
  }

  async function linkMember(familyId: string, memberId: string) {
    if (!user) return;
    setMessage("");
    try {
      await setDoc(
        doc(db(), `${trip.path}/users/${user.uid}`),
        {
          displayName: user.displayName ?? "",
          email: user.email ?? "",
          photoURL: user.photoURL ?? "",
          familyId,
          memberId,
          createdAt: Date.now(),
        },
        { merge: true }
      );
      setPickingFamilyId(null);
    } catch {
      setMessage(t("common.errors.saveFailed"));
    }
  }

  const role = useTripRole();
  const jump: { id: string; label: string }[] = [
    { id: "settings-you", label: t("settings.sections.you") },
    { id: "settings-trip", label: t("settings.sections.trip") },
    { id: "settings-notifications", label: t("settings.notifications.title") },
    { id: "settings-app", label: t("settings.app.title") },
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div>
          <p className="kicker text-ink-500">
            <bdi>{trip.name}</bdi>
          </p>
          <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
            {t("settings.title")}
          </h1>
        </div>
        <nav aria-label={t("settings.sections.jump")} className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <ul className="flex w-max gap-2">
            {jump.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="chip min-h-11 px-4 text-ink-700">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* ── You: identity, account, language ── */}
      <SettingsGroup id="settings-you" title={t("settings.sections.you")} hint={t("settings.sections.youHint")}>
        {!personal ? (
          <div className={`${SURFACE} flex flex-wrap items-center gap-3 p-4`}>
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cream-200 text-ink-500">
              <UserRound size={20} strokeWidth={STROKE} />
            </span>
            <p className="min-w-0 flex-1 basis-40 text-sm leading-snug text-ink-700">
              {t("settings.account.legacyHint")}
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="btn-primary min-h-11 shrink-0 px-5 text-sm"
            >
              {busy ? t("settings.account.wait") : t("settings.account.complete")}
            </button>
          </div>
        ) : (
          <div className={SURFACE}>
            <div className="flex items-center gap-3 p-4">
              {user?.photoURL ? (
                <Image src={user.photoURL} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full" />
              ) : (
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream-100 text-ink-500">
                  <UserRound size={22} strokeWidth={STROKE} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink-900">
                  <bdi>{user?.displayName}</bdi>
                </p>
                <p className="truncate text-sm text-ink-500">
                  <bdi dir="ltr">{user?.email}</bdi>
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="btn-outline min-h-11 shrink-0 px-4 text-sm"
              >
                {t("settings.account.signOut")}
              </button>
            </div>

            {/* Which traveler this account is */}
            <div className="border-t border-cream-200 p-4">
              <p className="mb-3 text-sm text-ink-700">
                {linkedMember ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-route-500" />
                    <bdi>
                      {t("settings.account.linkedTo", {
                        member: linkedMember.name,
                        family: linkedFamily?.name ?? "",
                      })}
                    </bdi>
                  </span>
                ) : (
                  t("settings.account.whoAreYou")
                )}
              </p>
              {!families ? (
                <Skeleton className="h-11 w-full rounded-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {families.map((family) => (
                      <button
                        key={family.id}
                        type="button"
                        aria-expanded={pickingFamilyId === family.id}
                        onClick={() =>
                          setPickingFamilyId(pickingFamilyId === family.id ? null : family.id)
                        }
                        className={`min-h-11 rounded-full border px-4 text-sm transition ${
                          pickingFamilyId === family.id
                            ? "border-sea-900 bg-sea-900 text-cream-50"
                            : profile?.familyId === family.id
                              ? "border-route-300 bg-route-100 text-route-700"
                              : "border-cream-200 bg-white text-ink-700"
                        }`}
                      >
                        <bdi>{family.name}</bdi>
                      </button>
                    ))}
                  </div>
                  {pickingFamilyId && (
                    <div className="flex flex-wrap gap-2 rounded-2xl bg-cream-100 p-2">
                      {families
                        .find((f) => f.id === pickingFamilyId)
                        ?.members.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            aria-pressed={profile?.memberId === member.id}
                            onClick={() => linkMember(pickingFamilyId, member.id)}
                            className={`min-h-11 rounded-full px-4 text-sm transition ${
                              profile?.memberId === member.id
                                ? "bg-sea-900 text-cream-50"
                                : "bg-white text-ink-700"
                            }`}
                          >
                            <bdi>{member.name}</bdi>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {message && (
          <p role="alert" className="rounded-2xl bg-terra-100 px-4 py-2.5 text-sm text-terra-600">
            {message}
          </p>
        )}
        <SaveAccountCard />
        <LanguagePicker />
      </SettingsGroup>

      {/* ── This trip: invites first for organizers ── */}
      <SettingsGroup id="settings-trip" title={t("settings.sections.trip")} hint={t("settings.sections.tripHint")}>
        {role.isAdmin && (
          <InviteCard
            families={(families ?? []).map((f) => ({ id: f.id, name: f.name, members: f.members.length }))}
            myFamilyId={profile?.familyId ?? null}
          />
        )}

        <dl className={`${SURFACE} divide-y divide-cream-200`}>
          <div className="flex gap-3 p-4">
            <CalendarDays size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-400" />
            <div className="min-w-0">
              <dt className="text-xs text-ink-500">{t("settings.trip.dates")}</dt>
              <dd className="mt-0.5 text-ink-900">
                {dayLabel(trip.startDate)} – {dayLabel(trip.endDate)}{" "}
                <span className="text-ink-500">· {t("settings.trip.days", { count: dayCount })}</span>
              </dd>
            </div>
          </div>
          {trip.homeBase && (
            <div className="flex gap-3 p-4">
              <BedDouble size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-400" />
              <div className="min-w-0">
                <dt className="text-xs text-ink-500">{t("settings.trip.homeBase")}</dt>
                <dd className="mt-0.5">
                  <p className="text-ink-900"><bdi>{trip.homeBase.name}</bdi></p>
                  <a
                    href={googleMapsUrl(trip.homeBase, trip.searchRegionHint)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-sm text-route-700"
                  >
                    <bdi>{trip.homeBase.address}</bdi>
                    <ChevronRight size={14} strokeWidth={STROKE} aria-hidden className="shrink-0 rtl:rotate-180" />
                  </a>
                </dd>
              </div>
            </div>
          )}
          <div className="flex gap-3 p-4">
            <Coins size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-400" />
            <div className="min-w-0">
              <dt className="text-xs text-ink-500">{t("settings.trip.currency")}</dt>
              <dd className="mt-0.5 text-ink-900">{currencyNames(currencies, intlLocale(locale))}</dd>
            </div>
          </div>
        </dl>

        {role.isAdmin && <MembersCard />}
        {role.ready && !role.isKid && <KidDevicesCard />}
        <AboutUsSection />
      </SettingsGroup>

      <div className="space-y-10 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {/* ── Notifications ── */}
        <SettingsGroup id="settings-notifications" title={t("settings.notifications.title")}>
          <NotificationsSection />
        </SettingsGroup>

        {/* ── App ── */}
        <SettingsGroup id="settings-app" title={t("settings.app.title")}>
          <div className={`${SURFACE} p-4`}>
            <p className="flex gap-3 text-sm leading-relaxed text-ink-500">
              <Download size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-400" />
              <span>{t("settings.app.install")}</span>
            </p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-app-tour"))}
              className="btn-soft mt-3 min-h-11 w-full text-sm"
            >
              <GraduationCap size={16} strokeWidth={STROKE} aria-hidden />
              {t("settings.app.replayTour")}
            </button>
          </div>
        </SettingsGroup>
      </div>

      {/* ── Danger zone, always last ── */}
      {role.ready && !role.isKid && (
        <SettingsGroup id="settings-danger" title={t("product.admin.dangerTitle")}>
          <TripDangerZone isOwner={role.isOwner} />
        </SettingsGroup>
      )}

      <p className="text-center text-xs text-ink-400">
        <bdi>{trip.signature}</bdi>
      </p>
    </div>
  );
}
