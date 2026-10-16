"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { m } from "motion/react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { useLocale, useT } from "@/i18n";
import { GLOBE_SCENES } from "./scenes";

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

export function Hero({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useT();
  const { dir } = useLocale();
  const wide = useWideLayout();
  const layout = wide ? (dir === "rtl" ? "end-rtl" : "end-ltr") : "below";
  const labels = useMemo(
    () => Object.fromEntries(GLOBE_SCENES.map((scene) => [scene.id, t(scene.label)])),
    [t]
  );

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-night-950 text-cream-50">
      <Globe
        scenes={GLOBE_SCENES}
        layout={layout}
        labels={labels}
        className="absolute inset-x-0 bottom-0 -z-10 h-[62svh] lg:inset-0 lg:h-full"
      />
      {/* Keeps text legible where it overlaps the planet on small screens */}
      <div className="hero-veil pointer-events-none absolute inset-0 -z-10" aria-hidden />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-10 lg:pt-8">
        <span className="flex items-center gap-2.5 text-cream-50">
          <LogoMark size={30} />
          <Wordmark className="text-[15px]" />
        </span>
        <Link
          href="#how"
          className="rounded-full px-3 py-2 text-sm text-cream-50/80 transition hover:text-cream-50"
        >
          {t("landing.nav.how")}
        </Link>
      </header>

      <div className="relative mx-auto max-w-6xl px-5 pb-[46svh] pt-10 lg:flex lg:min-h-[calc(100svh-5rem)] lg:items-center lg:px-10 lg:pb-16 lg:pt-0">
        <div className="max-w-[34rem]">
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
          <m.div {...rise(0.55)} className="mt-8 max-w-xs">
            <SignInPanel tone="dark" onSignedIn={onSignedIn} />
            <p className="mt-3 text-sm text-cream-50/75">{t("landing.hero.free")}</p>
            <p className="mt-2 text-xs leading-relaxed text-cream-50/60">
              {t("product.welcome.consent.before")}
              <Link href="/terms" className="underline underline-offset-2 hover:text-cream-50">
                {t("product.welcome.consent.terms")}
              </Link>
              {t("product.welcome.consent.between")}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-cream-50">
                {t("product.welcome.consent.privacy")}
              </Link>
              {t("product.welcome.consent.after")}
            </p>
          </m.div>
        </div>
      </div>
    </section>
  );
}
