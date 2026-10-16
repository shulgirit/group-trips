"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { Hero } from "./Hero";
import { Story } from "./Story";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/** The /welcome story. Motion features load async; reduced motion is honored. */
export function Landing({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <main className="min-h-dvh bg-night-950">
          <Hero onSignedIn={onSignedIn} />
          <Story onSignedIn={onSignedIn} />
        </main>
      </MotionConfig>
    </LazyMotion>
  );
}
