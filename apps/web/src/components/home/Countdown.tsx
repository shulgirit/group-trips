"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n";

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
  const t = useT();
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
      <div dir="ltr" className="flex justify-center divide-x divide-white/20" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-[72px] px-2">
            <div className="mx-auto h-10 w-10 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (timeLeft === null) return null;

  // Clock-style order (per Omer): days LEFTMOST, like 1:02:15:22.
  // dir="ltr" on the row + days first in source = days on the left,
  // regardless of the page's RTL direction.
  const units = [
    { id: "days", value: timeLeft.days, label: t("trip.countdown.days") },
    { id: "hours", value: timeLeft.hours, label: t("trip.countdown.hours") },
    { id: "minutes", value: timeLeft.minutes, label: t("trip.countdown.minutes") },
    { id: "seconds", value: timeLeft.seconds, label: t("trip.countdown.seconds") },
  ];

  return (
    <div dir="ltr" className="flex justify-center divide-x divide-white/20">
      {units.map(({ id, value, label }) => (
        <div key={id} className="w-[72px] px-2 text-center">
          <div dir="ltr" className="numerals text-[2.25rem] leading-10 text-cream-50">
            {String(value).padStart(id === "days" ? 1 : 2, "0")}
          </div>
          <div className="mt-1.5 text-xs text-cream-50/75">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
