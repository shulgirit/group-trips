"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { m } from "motion/react";
import { StoreBadges } from "./StoreBadges";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { useLocale, useT, type TKey } from "@/i18n";
import { LanguageMenu } from "./LanguageMenu";
import { InviteCodeEntry } from "@/components/onboarding/InviteCodeEntry";
import { CITY_IDS, globeScenes } from "./scenes";

// The globe (and three.js) never ships in the initial bundle
const Globe = dynamic(() => import("./globe/Globe").then((mod) => mod.Globe), {
  ssr: false,
  loading: () => <div className="globe-poster absolute inset-0" />,
});

function useWideLayout() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function Hero() {
  const t = useT();
  const { dir, locale } = useLocale();
  const scenes = useMemo(() => globeScenes(locale), [locale]);
  const wide = useWideLayout();
  const layout = wide ? (dir === "rtl" ? "end-rtl" : "end-ltr") : "below";
  const labels = useMemo(
    () => ({
      ...Object.fromEntries(CITY_IDS.map((id) => [id, t(`landing.cities.${id}` as TKey)])),
      ...Object.fromEntries(scenes.map((scene) => [scene.id, t(scene.label)])),
    }),
    [t, scenes]
  );

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-night-950 text-cream-50">
      {wide && (
        <Globe
          key={locale}
          scenes={scenes}
          layout={layout}
          labels={labels}
          dragHint={t("landing.drag")}
          className="absolute inset-0 -z-10"
        />
      )}
      {/* Keeps the headline legible where it meets the planet on desktop */}
      <div className="hero-veil pointer-events-none absolute inset-0 -z-10 hidden lg:block" aria-hidden />

      {/* On desktop the text layers sit above the globe: they let pointer events through
          (lg:pointer-events-none) and only their real content catches them, so a mouse
          drag on empty space turns the planet instead of selecting text. */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] lg:pointer-events-none lg:px-10 lg:pt-8">
        <span className="flex items-center gap-2.5 text-cream-50 lg:pointer-events-auto">
          <LogoMark size={30} />
          <Wordmark className="text-[15px]" />
        </span>
        <nav className="flex items-center gap-1 lg:pointer-events-auto">
          <Link
            href="#how"
            className="hidden rounded-full px-3 py-2 text-sm text-cream-50/80 transition hover:text-cream-50 sm:inline-flex"
          >
            {t("landing.nav.how")}
          </Link>
          <LanguageMenu />
        </nav>
      </header>

      <div className="relative mx-auto max-w-6xl px-5 pb-6 pt-10 lg:pointer-events-none lg:flex lg:min-h-[calc(100svh-5rem)] lg:items-center lg:px-10 lg:pb-16 lg:pt-0">
        <div className="max-w-[34rem] lg:pointer-events-auto">
          <m.h1
            {...rise(0.15)}
            className="font-serif text-display font-medium tracking-[-0.01em] text-cream-50 lg:text-display-xl"
          >
            {t("landing.hero.title")}
          </m.h1>
          <m.p
            {...rise(0.35)}
            className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-cream-50/80 lg:text-lg"
          >
            {t("landing.hero.lead")}
          </m.p>
          <m.div {...rise(0.55)} className="mt-8 max-w-sm">
            <StoreBadges />
            <InviteCodeEntry className="mt-3" />
            <p className="mt-2 text-sm text-cream-50/75">{t("landing.hero.free")}</p>
          </m.div>
        </div>
      </div>

      {/* Phones: the whole planet in its own frame under the text */}
      {!wide && (
        <Globe
          key={locale}
          scenes={scenes}
          layout="below"
          labels={labels}
          dragHint={t("landing.drag")}
          className="relative mx-auto aspect-square w-full max-w-[30rem]"
        />
      )}
    </section>
  );
}
