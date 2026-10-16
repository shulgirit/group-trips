"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Glyph } from "@/components/ui/Icon";

// WebGL orb (React Bits) — loaded only where the guide appears
const Orb = dynamic(() => import("@/components/vendor/react-bits/Orb"), { ssr: false });

export type CompanionState = "idle" | "thinking";

const PALETTE = ["#d8b277", "#6f9fb3", "#1c2a43"]; // brass · sea-glass · deep ink
// Must match the surface exactly, or the orb shows as a tinted square
const BACKGROUND = { page: "#f7f5f0", light: "#f1f3ef", white: "#ffffff", night: "#070c16" } as const;

/**
 * The trip's AI guide made visible: a living brass-and-sea orb. Calm while
 * idle, a quicker swirl while it thinks. Pauses when off screen; a CSS orb
 * stands in until WebGL is ready (or if it never is).
 */
export function Companion({
  state = "idle",
  size = 72,
  ground = "light",
  interactive = false,
  className = "",
  label,
  glyph,
  avatar,
}: {
  state?: CompanionState;
  size?: number;
  /** Surface behind the orb, so its glow blends cleanly */
  ground?: keyof typeof BACKGROUND;
  /** Follows the pointer / pulses on tap (hero use) */
  interactive?: boolean;
  className?: string;
  /** Accessible name; decorative when omitted */
  label?: string;
  /** The persona's chosen icon (trip setup), shown at the heart of the orb */
  glyph?: string;
  /** The guide's face chosen at trip setup (robot or uploaded) — replaces the orb */
  avatar?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  // No WebGL2? The Orb bails out on its own and the CSS orb remains
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.01,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const thinking = state === "thinking";
  if (avatar) {
    return (
      <div
        ref={ref}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`companion-avatar relative shrink-0 rounded-full ${thinking ? "companion-avatar-thinking" : ""} ${className}`}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- small local/storage avatar */}
        <img src={avatar} alt="" className="relative h-full w-full rounded-full bg-night-900 object-cover" />
      </div>
    );
  }
  return (
    <div
      ref={ref}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`companion relative shrink-0 ${thinking ? "companion-thinking" : ""} ${
        // On light surfaces the orb's own backdrop never matches exactly — keep it a circle
        ground === "night" ? "" : "overflow-hidden rounded-full"
      } ${className}`}
      style={{ width: size, height: size }}
      data-ground={ground}
    >
      <span aria-hidden className="companion-fallback absolute inset-[14%] rounded-full" />
      {(
        <Orb
          colors={PALETTE}
          backgroundColor={BACKGROUND[ground]}
          size={0.92}
          glow={thinking ? 1.6 : 1.05}
          wobble={thinking ? 1.6 : 0.8}
          speed={thinking ? 1.8 : 0.55}
          hoverIntensity={interactive ? 1 : 0.4}
          forceHoverState={thinking}
          followCursor={interactive}
          clickPulse={interactive}
          rotateOnHover={interactive}
          paused={!visible}
          dpr={Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)}
          className="absolute inset-0"
        />
      )}
      {glyph && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgb(7_12_22/0.55)]">
          <Glyph value={glyph} size={Math.round(size * 0.3)} strokeWidth={1.75} />
        </span>
      )}
    </div>
  );
}
