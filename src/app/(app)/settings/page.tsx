"use client";

import { useState } from "react";
import Image from "next/image";
import { doc, setDoc } from "firebase/firestore";
import { BedDouble, CalendarDays, ChevronRight, Coins, Download, GraduationCap, UserRound } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { AboutUsSection } from "@/components/settings/AboutUsSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { TripAdminSection } from "@/components/settings/TripAdminSection";
import { SaveAccountCard } from "@/components/settings/SaveAccountCard";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { STROKE } from "@/components/ui/Icon";
import { db, signInWithGoogle } from "@/lib/firebase/client";
import { logoutEverywhere } from "@/lib/logout";
import { useFamilies } from "@/lib/hooks";
import { googleMapsUrl } from "@/lib/nav";
import { tripDays } from "@/lib/trip";
import { useTrip } from "@/components/providers/TripProvider";
import { setLocalePreference, useDayLabel, useLocale, useT } from "@/i18n";
import { LOCALES, LOCALE_LABEL } from "@/i18n/config";
import { intlLocale } from "@/i18n/format";

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

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-light text-ink-900">
        {t("settings.title")}
      </h1>

      {/* Personal identity */}
      <section>
        <h2 className="section-title mb-3 font-normal">{t("settings.account.title")}</h2>
        {!personal ? (
          <div className="card flex items-center gap-3 px-4 py-3.5">
            <UserRound size={20} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-300" />
            <p className="min-w-0 flex-1 text-sm leading-snug text-ink-500">
              {t("settings.account.legacyHint")}
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="btn-primary shrink-0 px-4 py-2.5 text-sm"
            >
              {busy ? t("settings.account.wait") : t("settings.account.complete")}
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-cream-200 bg-white p-5">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt=""
                  width={44}
                  height={44}
                  className="rounded-full"
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cream-200 bg-cream-50 text-ink-500">
                  <UserRound size={20} strokeWidth={STROKE} aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">
                  {user?.displayName}
                </p>
                <p className="truncate text-sm text-ink-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="rounded-full border border-cream-200 px-3.5 py-1.5 text-sm text-ink-700 transition active:bg-cream-100"
              >
                {t("settings.account.signOut")}
              </button>
            </div>

            {/* Family member link */}
            <div className="mt-5 border-t border-cream-200 pt-4">
              <p className="mb-3 text-sm text-ink-700">
                {linkedMember
                  ? t("settings.account.linkedTo", {
                      member: linkedMember.name,
                      family: linkedFamily?.name ?? "",
                    })
                  : t("settings.account.whoAreYou")}
              </p>
              {!families ? (
                <ListSkeleton rows={1} />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {families.map((family) => (
                      <button
                        key={family.id}
                        type="button"
                        onClick={() =>
                          setPickingFamilyId(
                            pickingFamilyId === family.id ? null : family.id
                          )
                        }
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                          pickingFamilyId === family.id
                            ? "border-sea-900 bg-sea-900 text-cream-50"
                            : profile?.familyId === family.id
                              ? "border-sea-200 bg-sea-100 text-sea-900"
                              : "border-cream-200 bg-white text-ink-700"
                        }`}
                      >
                        <bdi>{family.name}</bdi>
                      </button>
                    ))}
                  </div>
                  {pickingFamilyId && (
                    <div className="flex flex-wrap gap-2 rounded-2xl bg-cream-100 p-3">
                      {families
                        .find((f) => f.id === pickingFamilyId)
                        ?.members.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() =>
                              linkMember(pickingFamilyId, member.id)
                            }
                            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
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
          <p
            role="alert"
            className="mt-2 rounded-2xl border border-terra-100 bg-terra-100 px-4 py-2.5 text-sm text-terra-600"
          >
            {message}
          </p>
        )}
      </section>

      <SaveAccountCard />

      <TripAdminSection />

      {/* Language */}
      <section>
        <h2 className="section-title mb-3 font-normal">{t("common.language.title")}</h2>
        <div className="rounded-3xl border border-cream-200 bg-white p-4">
          <div
            role="radiogroup"
            aria-label={t("common.language.title")}
            className="grid grid-cols-2 gap-1 rounded-full border border-cream-200 bg-cream-50 p-1"
          >
            {LOCALES.map((option) => {
              const selected = option === locale;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  lang={option}
                  onClick={() => {
                    if (!selected) setLocalePreference(option);
                  }}
                  className={`rounded-full py-2 text-sm transition ${
                    selected
                      ? "bg-sea-900 text-cream-50 shadow-sm"
                      : "text-ink-700 active:bg-cream-100"
                  }`}
                >
                  {LOCALE_LABEL[option]}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            {t("common.language.hint")}
          </p>
        </div>
      </section>

      <NotificationsSection />

      <AboutUsSection />

      {/* Trip info */}
      <section>
        <h2 className="section-title mb-3 font-normal">{t("settings.trip.title")}</h2>
        <div className="divide-y divide-cream-200 rounded-3xl border border-cream-200 bg-white">
          <div className="flex gap-3 px-4 py-3.5">
            <CalendarDays size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-300" />
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{t("settings.trip.dates")}</p>
              <p className="mt-0.5 text-ink-900">
                {dayLabel(trip.startDate)} – {dayLabel(trip.endDate)}{" "}
                <span className="text-ink-500">
                  · {t("settings.trip.days", { count: dayCount })}
                </span>
              </p>
            </div>
          </div>
          {trip.homeBase && (
            <div className="flex gap-3 px-4 py-3.5">
              <BedDouble size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-300" />
              <div className="min-w-0">
                <p className="text-xs text-ink-500">{t("settings.trip.homeBase")}</p>
                <p className="mt-0.5 text-ink-900">{trip.homeBase.name}</p>
                <a
                  href={googleMapsUrl(trip.homeBase, trip.searchRegionHint)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-sm text-sea-700"
                >
                  {trip.homeBase.address}
                  <ChevronRight size={14} strokeWidth={STROKE} aria-hidden className="shrink-0 rtl:rotate-180" />
                </a>
              </div>
            </div>
          )}
          <div className="flex gap-3 px-4 py-3.5">
            <Coins size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-300" />
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{t("settings.trip.currency")}</p>
              <p className="mt-0.5 text-ink-900">
                {currencyNames(currencies, intlLocale(locale))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* App */}
      <section>
        <h2 className="section-title mb-3 font-normal">{t("settings.app.title")}</h2>
        <div className="rounded-3xl border border-cream-200 bg-white px-4 py-4 text-sm leading-relaxed text-ink-500">
          <p className="flex gap-3">
            <Download size={18} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-ink-300" />
            <span>{t("settings.app.install")}</span>
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-app-tour"))}
            className="btn-soft mt-4 w-full py-2.5 text-sm"
          >
            <GraduationCap size={16} strokeWidth={STROKE} aria-hidden />
            {t("settings.app.replayTour")}
          </button>
        </div>
        <p className="mt-6 text-center text-xs tracking-wide text-ink-300">
          {trip.signature}
        </p>
      </section>
    </div>
  );
}
