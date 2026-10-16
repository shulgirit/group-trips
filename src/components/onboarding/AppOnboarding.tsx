"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, m } from "motion/react";
import { CalendarDays, Check, ChevronLeft, Map as MapIcon, Ticket, Wallet } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { STROKE } from "@/components/ui/Icon";
import { useLocale, useT, type TKey } from "@/i18n";
import { CITY_IDS, globeScenes } from "@/components/landing/scenes";
import { InviteCodeEntry } from "./InviteCodeEntry";

const Globe = dynamic(() => import("@/components/landing/globe/Globe").then((mod) => mod.Globe), {
  ssr: false,
  loading: () => <div className="globe-poster absolute inset-0" />,
});
const Robot = dynamic(() => import("@/components/landing/robot/Robot").then((mod) => mod.Robot), {
  ssr: false,
});
const loadFeatures = () => import("@/components/landing/motion-features").then((mod) => mod.default);

/** Seen once per device; afterwards the app opens straight on sign-in. */
const SEEN_KEY = "together-onboarded-v1";

type Step = "intro" | 0 | 1 | 2 | "signin";
const CARDS: { key: "together" | "guide" | "organized" }[] = [
  { key: "together" },
  { key: "guide" },
  { key: "organized" },
];

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // private mode — fine, they'll see the cards again
  }
}


/* ── card visuals ─────────────────────────────────────────── */

function TogetherVisual() {
  const t = useT();
  const people: TKey[] = ["landing.invite.people.p1", "landing.invite.people.p2", "landing.invite.people.p3", "landing.invite.people.p4"];
  return (
    <div className="mx-auto w-full max-w-[17rem]">
      <ul className="relative space-y-3 ps-6">
        <span aria-hidden className="absolute bottom-6 start-[11px] top-2 w-px bg-gradient-to-b from-cream-50/5 via-brass-500/60 to-brass-500" />
        {people.map((key, index) => (
          <m.li
            key={key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + index * 0.16, duration: 0.45 }}
            className="flex items-center gap-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-50 text-sm font-medium text-night-950">
              {t(key).trim().split(/\s+/).pop()?.slice(0, 1)}
            </span>
            <span className="text-sm text-cream-50/90">{t(key)}</span>
          </m.li>
        ))}
        <li className="flex items-center gap-3 pt-1">
          <span className="flex h-9 w-9 items-center justify-center">
            <span className="h-3 w-3 rounded-full bg-brass-500 shadow-[0_0_0_6px_rgb(176_138_85/0.2)]" />
          </span>
          <span className="font-serif text-lg text-cream-50">{t("landing.places.sicily")}</span>
        </li>
      </ul>
    </div>
  );
}

function OrganizedVisual() {
  const t = useT();
  const rows: { Icon: typeof CalendarDays; label: TKey }[] = [
    { Icon: CalendarDays, label: "landing.sorted.events.flight" },
    { Icon: MapIcon, label: "landing.sorted.events.villa" },
    { Icon: Ticket, label: "landing.sorted.events.dinner" },
  ];
  return (
    <div className="mx-auto w-full max-w-[17rem] space-y-2.5">
      {rows.map(({ Icon, label }, index) => (
        <m.div
          key={label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + index * 0.14 }}
          className="flex items-center gap-3 rounded-2xl bg-night-800 px-4 py-3 text-sm text-cream-50"
        >
          <Icon size={17} strokeWidth={STROKE} aria-hidden className="shrink-0 text-brass-300" />
          {t(label)}
        </m.div>
      ))}
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="flex items-center gap-2 rounded-full bg-route-500/25 px-4 py-2.5 text-sm text-route-100"
      >
        <Wallet size={16} strokeWidth={STROKE} aria-hidden />
        {t("landing.together.transfer")}
        <Check size={15} strokeWidth={2} aria-hidden className="ms-auto" />
      </m.div>
    </div>
  );
}

/* ── the flow ─────────────────────────────────────────────── */

export function AppOnboarding() {
  const t = useT();
  const router = useRouter();
  const { locale, dir } = useLocale();
  const [step, setStep] = useState<Step>("intro");
  const [inviteOpen, setInviteOpen] = useState(false);
  const scenes = useMemo(() => globeScenes(locale), [locale]);
  const labels = useMemo(
    () => ({
      ...Object.fromEntries(CITY_IDS.map((id) => [id, t(`landing.cities.${id}` as TKey)])),
      ...Object.fromEntries(scenes.map((scene) => [scene.id, t(scene.label)])),
    }),
    [t, scenes]
  );

  // Returning on this device: straight to sign-in
  useEffect(() => {
    if (readSeen()) {
      const id = setTimeout(() => setStep("signin"), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const go = (next: Step) => {
    if (next === "signin") markSeen();
    setStep(next);
  };
  const cardIndex = typeof step === "number" ? step : null;
  const forward = dir === "rtl" ? -1 : 1;



  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <main className="relative flex min-h-[100svh] flex-col overflow-hidden bg-night-950 text-cream-50">
          {/* top bar */}
          <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <span className="flex items-center gap-2.5">
              <LogoMark size={26} />
              <Wordmark className="text-[13px]" />
            </span>
            {cardIndex !== null && (
              <button
                type="button"
                onClick={() => go("signin")}
                className="rounded-full px-3 py-2 text-sm text-cream-50/75"
              >
                {t("landing.app.skip")}
              </button>
            )}
          </header>

          <AnimatePresence mode="wait" initial={false}>
            {step === "intro" && (
              <m.section
                key="intro"
                exit={{ opacity: 0 }}
                className="relative flex flex-1 flex-col"
              >
                <Globe
                  scenes={scenes}
                  layout="below"
                  labels={labels}
                  dragHint=""
                  className="relative mx-auto mt-2 aspect-square w-full max-w-[26rem]"
                />
                <div className="mt-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  <m.h1
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.8 }}
                    className="font-serif text-display-sm font-medium"
                  >
                    {t("landing.hero.title")}
                  </m.h1>
                  <button
                    type="button"
                    onClick={() => go(0)}
                    className="btn mt-7 w-full rounded-2xl bg-cream-50 py-4 text-base font-semibold text-night-950"
                  >
                    {t("landing.app.start")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteOpen(true);
                      go("signin");
                    }}
                    className="mt-3 w-full py-2 text-sm text-cream-50/75"
                  >
                    {t("landing.app.haveInvite")}
                  </button>
                </div>
              </m.section>
            )}

            {cardIndex !== null && (
              <m.section
                key={`card-${cardIndex}`}
                initial={{ opacity: 0, x: 40 * forward }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 * forward }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  const swipe = info.offset.x * forward;
                  if (swipe < -60) go(cardIndex < 2 ? ((cardIndex + 1) as Step) : "signin");
                  else if (swipe > 60 && cardIndex > 0) go((cardIndex - 1) as Step);
                }}
                className="flex flex-1 touch-pan-y flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              >
                <div className="flex flex-1 items-center justify-center py-6">
                  {CARDS[cardIndex].key === "together" && <TogetherVisual />}
                  {CARDS[cardIndex].key === "guide" && (
                    <Robot className="aspect-square w-full max-w-[20rem]" />
                  )}
                  {CARDS[cardIndex].key === "organized" && <OrganizedVisual />}
                </div>
                <h2 className="font-serif text-display-sm font-medium">
                  {t(`landing.app.cards.${CARDS[cardIndex].key}.title` as TKey)}
                </h2>
                <p className="mt-3 text-[17px] leading-relaxed text-cream-50/75">
                  {t(`landing.app.cards.${CARDS[cardIndex].key}.text` as TKey)}
                </p>
                <div className="mt-8 flex items-center justify-between">
                  <div className="flex gap-2" aria-label={t("landing.app.stepOf", { n: cardIndex + 1, total: 3 })}>
                    {CARDS.map((card, index) => (
                      <span
                        key={card.key}
                        className={`h-2 rounded-full transition-all ${
                          index === cardIndex ? "w-6 bg-brass-500" : "w-2 bg-cream-50/30"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => go(cardIndex < 2 ? ((cardIndex + 1) as Step) : "signin")}
                    className="btn rounded-2xl bg-cream-50 px-6 py-3.5 text-base font-semibold text-night-950"
                  >
                    {cardIndex < 2 ? t("landing.app.next") : t("landing.app.start")}
                    <ChevronLeft size={18} strokeWidth={2} aria-hidden className="ltr:rotate-180" />
                  </button>
                </div>
              </m.section>
            )}

            {step === "signin" && (
              <m.section
                key="signin"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              >
                <div aria-hidden className="final-horizon pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[60%]" />
                <div className="relative flex flex-1 flex-col justify-center">
                  <h2 className="font-serif text-display-sm font-medium">{t("landing.app.signInTitle")}</h2>
                  <p className="mt-3 text-[17px] text-cream-50/75">{t("landing.app.signInText")}</p>
                  <div className="mt-8">
                    <SignInPanel tone="dark" onSignedIn={() => router.replace("/trips")} />
                  </div>

                  <InviteCodeEntry key={inviteOpen ? "open" : "closed"} startOpen={inviteOpen} onBeforeGo={markSeen} className="mt-6" />
                </div>
                <p className="relative mt-6 text-center text-xs leading-relaxed text-cream-50/55">
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
              </m.section>
            )}
          </AnimatePresence>
        </main>
      </MotionConfig>
    </LazyMotion>
  );
}
