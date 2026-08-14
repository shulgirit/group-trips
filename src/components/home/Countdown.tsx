"use client";

import { useEffect, useState } from "react";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function calcTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1_000) % 60),
  };
}

export function Countdown({ targetIso }: { targetIso: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null | "pending">(
    "pending"
  );

  useEffect(() => {
    const target = new Date(targetIso);
    setTimeLeft(calcTimeLeft(target));
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(target));
    }, 1_000);
    return () => clearInterval(interval);
  }, [targetIso]);

  if (timeLeft === "pending") {
    return (
      <div dir="ltr" className="flex justify-center gap-2.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[68px] w-[66px] animate-pulse rounded-2xl bg-white/10"
          />
        ))}
      </div>
    );
  }

  if (timeLeft === null) return null;

  // Clock-style order (per Omer): days LEFTMOST, like 1:02:15:22.
  // dir="ltr" on the row + days first in source = days on the left,
  // regardless of the page's RTL direction.
  const units = [
    { value: timeLeft.days, label: "ימים" },
    { value: timeLeft.hours, label: "שעות" },
    { value: timeLeft.minutes, label: "דקות" },
    { value: timeLeft.seconds, label: "שניות" },
  ];

  return (
    <div dir="ltr" className="flex justify-center gap-2.5">
      {units.map(({ value, label }) => (
        <div
          key={label}
          className="w-[66px] rounded-2xl border border-white/15 bg-white/10 py-2.5 text-center backdrop-blur-md"
        >
          <div
            dir="ltr"
            className="font-display text-[1.75rem] font-bold leading-8 tabular-nums text-cream-50"
          >
            {value}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-cream-50/75">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
