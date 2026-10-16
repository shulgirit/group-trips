"use client";

import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { PERSONA_GLYPHS, STROKE } from "@/components/ui/Icon";
import { useLocale, useT, type TKey } from "@/i18n";
import type { RobotHandle } from "./engine";

const PERSONAS = ["butler", "pilot", "buddy", "guide"] as const;

/**
 * The guide as a character for the landing page: a 3D robot (three.js,
 * loaded only when it scrolls near) with a speech bubble that cycles the
 * personas a trip can choose. Tapping makes it wave.
 */
export function Robot({ className = "" }: { className?: string }) {
  const t = useT();
  const { dir } = useLocale();
  const shiftRef = useRef(dir === "rtl" ? -1.0 : 1.0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<RobotHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [persona, setPersona] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let destroyed = false;
    let started = false;
    let resizeObserver: ResizeObserver | null = null;

    const start = async () => {
      if (started) return;
      started = true;
      try {
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return;
        const { createRobot } = await import("./engine");
        if (destroyed) return;
        handleRef.current = createRobot({
          canvas,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          shift: shiftRef.current,
          onReady: () => !destroyed && setReady(true),
        });
        resizeObserver = new ResizeObserver(() => handleRef.current?.resize());
        resizeObserver.observe(wrap);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error("[robot]", error);
      }
    };

    // Load when near the viewport; pause when out of it
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        handleRef.current?.setActive(entry.isIntersecting && !document.hidden);
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(wrap);
    const onVisibility = () => handleRef.current?.setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      destroyed = true;
      observer.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  // The bubble introduces a different persona every few seconds
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setPersona((value) => (value + 1) % PERSONAS.length), 3200);
    return () => clearInterval(id);
  }, []);

  const key = PERSONAS[persona];
  const Glyph = PERSONA_GLYPHS[key];
  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div aria-hidden className="robot-poster absolute inset-0" data-ready={ready} />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t("landing.ai.meet")}
        className={`absolute inset-0 h-full w-full cursor-pointer transition-opacity duration-700 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => handleRef.current?.wave()}
      />
      {/* speech bubble — real text, translatable, screen-reader friendly */}
      <div className="pointer-events-none absolute start-0 top-[10%] w-[42%] max-w-[12.5rem]" aria-live="polite">
        <AnimatePresence mode="wait">
          <m.div
            key={key}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="robot-bubble relative rounded-2xl rounded-ee-md bg-cream-50 px-4 py-3 text-night-950 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]"
          >
            <p className="flex items-center gap-2 text-[15px] font-medium">
              <Glyph size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-brass-600" />
              {t("landing.ai.hello", { name: t(`landing.ai.personas.${key}` as TKey) })}
            </p>
            <p className="mt-1 text-xs leading-snug text-ink-500">{t("landing.ai.youChoose")}</p>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
