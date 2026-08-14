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

  // Avoid hydration mismatch: render a stable skeleton until mounted
  if (timeLeft === "pending") {
    return (
      <div className="flex justify-center gap-3" aria-hidden>
        {["ימים", "שעות", "דקות", "שניות"].map((label) => (
          <div
            key={label}
            className="w-[72px] animate-pulse rounded-2xl bg-cream-50/15 py-3"
          >
            <div className="mx-auto h-8 w-10 rounded bg-cream-50/20" />
            <div className="mx-auto mt-1.5 h-3 w-8 rounded bg-cream-50/20" />
          </div>
        ))}
      </div>
    );
  }

  if (timeLeft === null) return null;

  const units = [
    { value: timeLeft.days, label: "ימים" },
    { value: timeLeft.hours, label: "שעות" },
    { value: timeLeft.minutes, label: "דקות" },
    { value: timeLeft.seconds, label: "שניות" },
  ];

  return (
    <div className="flex justify-center gap-3">
      {units.map(({ value, label }) => (
        <div
          key={label}
          className="w-[72px] rounded-2xl bg-cream-50/15 py-3 text-center backdrop-blur-sm"
        >
          <div className="text-3xl font-bold tabular-nums text-cream-50">
            {value}
          </div>
          <div className="mt-0.5 text-xs text-sea-200">{label}</div>
        </div>
      ))}
    </div>
  );
}
