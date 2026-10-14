"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Citrus,
  House,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Plane,
  Vote,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { activeTrip } from "@/lib/active-trip";
import type { TripConfig } from "@/lib/trips";
import { useTrip } from "@/components/providers/TripProvider";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { useT, type TKey } from "@/i18n";

type Translate = ReturnType<typeof useT>;

interface TourStep {
  /** Lucide icon, or a stored glyph value (the AI persona) */
  icon: LucideIcon | string;
  kicker: string;
  title: string;
  lines: string[];
  chips?: string[];
}

function step(
  t: Translate,
  icon: LucideIcon | string,
  kicker: TKey,
  title: TKey,
  lines: TKey[],
  chips?: TKey[]
): TourStep {
  return {
    icon,
    kicker: t(kicker),
    title: t(title),
    lines: lines.map((key) => t(key)),
    chips: chips?.map((key) => t(key)),
  };
}

function sicilySteps(t: Translate, trip: TripConfig): TourStep[] {
  return [
    step(t, Citrus, "tour.sicily.welcome.kicker", "tour.sicily.welcome.title", [
      "tour.sicily.welcome.a",
      "tour.sicily.welcome.b",
      "tour.sicily.welcome.c",
    ]),
    step(t, House, "tour.sicily.home.kicker", "tour.sicily.home.title", [
      "tour.sicily.home.a",
      "tour.sicily.home.b",
      "tour.sicily.home.c",
    ]),
    step(t, MapPin, "tour.sicily.places.kicker", "tour.sicily.places.title", [
      "tour.sicily.places.a",
      "tour.sicily.places.b",
      "tour.sicily.places.c",
    ]),
    step(t, CalendarDays, "tour.sicily.calendar.kicker", "tour.sicily.calendar.title", [
      "tour.sicily.calendar.a",
      "tour.sicily.calendar.b",
      "tour.sicily.calendar.c",
    ]),
    step(t, MapIcon, "tour.sicily.map.kicker", "tour.sicily.map.title", [
      "tour.sicily.map.a",
      "tour.sicily.map.b",
    ]),
    step(t, Vote, "tour.sicily.polls.kicker", "tour.sicily.polls.title", [
      "tour.sicily.polls.a",
      "tour.sicily.polls.b",
      "tour.sicily.polls.c",
    ]),
    step(t, Wallet, "tour.sicily.expenses.kicker", "tour.sicily.expenses.title", [
      "tour.sicily.expenses.a",
      "tour.sicily.expenses.b",
    ]),
    step(
      t,
      trip.ai.emoji,
      "tour.sicily.ai.kicker",
      "tour.sicily.ai.title",
      ["tour.sicily.ai.a"],
      [
        "tour.sicily.ai.chips.a",
        "tour.sicily.ai.chips.b",
        "tour.sicily.ai.chips.c",
        "tour.sicily.ai.chips.d",
      ]
    ),
    step(t, ListChecks, "tour.sicily.final.kicker", "tour.sicily.final.title", [
      "tour.sicily.final.a",
      "tour.sicily.final.b",
      "tour.sicily.final.c",
    ]),
  ];
}

/** Sardinia and self-serve trips share one flow; Sardinia keeps its own voice. */
function tripSteps(t: Translate, trip: TripConfig): TourStep[] {
  const sardinia = trip.key === "sardinia";
  const welcome: TourStep = sardinia
    ? step(t, Plane, "tour.sardinia.welcome.kicker", "tour.sardinia.welcome.title", [
        "tour.sardinia.welcome.a",
        "tour.sardinia.welcome.b",
        "tour.sardinia.welcome.c",
      ])
    : {
        ...step(t, trip.emoji, "tour.trip.welcome.title", "tour.trip.welcome.title", [
          "tour.trip.welcome.a",
          "tour.trip.welcome.b",
          "tour.trip.welcome.c",
        ]),
        kicker: trip.name,
      };
  const places = step(t, MapPin, "tour.trip.places.kicker", "tour.trip.places.title", [
    sardinia ? "tour.sardinia.places.a" : "tour.trip.places.a",
    "tour.trip.places.b",
  ]);
  const expenses = step(t, Wallet, "tour.trip.expenses.kicker", "tour.trip.expenses.title", [
    sardinia ? "tour.sardinia.expenses.a" : "tour.trip.expenses.a",
    sardinia ? "tour.sardinia.expenses.b" : "tour.trip.expenses.b",
  ]);
  const ai: TourStep = {
    ...step(
      t,
      trip.ai.emoji,
      "tour.trip.ai.kicker",
      "tour.sardinia.ai.title",
      ["tour.trip.ai.a", "tour.trip.ai.b"],
      sardinia
        ? [
            "tour.sardinia.ai.chips.a",
            "tour.sardinia.ai.chips.b",
            "tour.sardinia.ai.chips.c",
            "tour.sardinia.ai.chips.d",
          ]
        : [
            "tour.trip.ai.chips.a",
            "tour.trip.ai.chips.b",
            "tour.trip.ai.chips.c",
            "tour.trip.ai.chips.d",
          ]
    ),
    ...(sardinia ? {} : { title: trip.aiName }),
  };
  return [
    welcome,
    step(t, House, "tour.trip.home.kicker", "tour.trip.home.title", [
      "tour.trip.home.a",
      "tour.trip.home.b",
    ]),
    places,
    step(t, CalendarDays, "tour.trip.calendar.kicker", "tour.trip.calendar.title", [
      "tour.trip.calendar.a",
      "tour.trip.calendar.b",
    ]),
    step(t, MapIcon, "tour.trip.map.kicker", "tour.trip.map.title", [
      "tour.trip.map.a",
      "tour.trip.map.b",
    ]),
    expenses,
    ai,
    step(t, ListChecks, "tour.trip.final.kicker", "tour.trip.final.title", [
      "tour.trip.final.a",
      "tour.trip.final.b",
      "tour.trip.final.c",
    ]),
  ];
}

export function markTourSeen() {
  try {
    localStorage.setItem(activeTrip().tourKey, "1");
  } catch {
    // storage unavailable — the tour will simply offer itself again
  }
}

export function wasTourSeen(): boolean {
  try {
    return localStorage.getItem(activeTrip().tourKey) === "1";
  } catch {
    return true;
  }
}

export function AppTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trip = useTrip();
  const t = useT();
  const steps = trip.key === "sicily" ? sicilySteps(t, trip) : tripSteps(t, trip);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  const current = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const StepIcon = typeof current.icon === "string" ? null : current.icon;

  function finish() {
    markTourSeen();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-sea-950"
      role="dialog"
      aria-modal="true"
      aria-label={t("tour.dialogLabel")}
    >
      {/* Welcome photo on the first step */}
      {isFirst && trip.heroImage && (
        <div aria-hidden className="absolute inset-0 opacity-20">
          <Image
            src={trip.heroImage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
      )}

      {/* Top bar: progress + skip */}
      <div className="relative flex items-center gap-3 px-5 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex flex-1 gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-px flex-1 transition ${
                i <= stepIndex ? "bg-lemon-400" : "bg-white/20"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={finish}
          aria-label={t("tour.skip")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-cream-50/80"
        >
          <X size={18} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>

      {/* Step content */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-7 text-center">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-full border border-lemon-400/60 text-lemon-300"
          aria-hidden
        >
          {StepIcon ? (
            <StepIcon size={30} strokeWidth={STROKE} />
          ) : (
            <Glyph value={current.icon as string} size={30} />
          )}
        </span>
        <p className="kicker mt-7 text-lemon-300">{current.kicker}</p>
        <h2 className="mt-3 font-display text-3xl font-light leading-tight text-cream-50">
          {current.title}
        </h2>
        <div className="mt-6 max-w-sm space-y-3">
          {current.lines.map((line) => (
            <p
              key={line}
              className="text-[15px] leading-relaxed text-cream-50/80"
            >
              {line}
            </p>
          ))}
        </div>
        {current.chips && (
          <div className="mt-5 flex max-w-sm flex-wrap justify-center gap-2">
            {current.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-cream-50/90"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative flex items-center gap-3 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
        {!isFirst ? (
          <button
            type="button"
            onClick={() => setStepIndex(stepIndex - 1)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 text-cream-50"
            aria-label={t("tour.previous")}
          >
            <ChevronLeft size={22} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
          </button>
        ) : (
          <span className="w-12" />
        )}
        <button
          type="button"
          onClick={() => (isLast ? finish() : setStepIndex(stepIndex + 1))}
          className={`btn flex-1 py-4 text-base ${
            isLast
              ? "bg-cream-50 text-sea-950 ring-1 ring-inset ring-lemon-400"
              : "bg-cream-50 text-sea-900"
          }`}
        >
          {isLast ? t("tour.start") : t("common.next")}
          {!isLast && (
            <ChevronRight size={20} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
          )}
        </button>
      </div>
    </div>
  );
}
