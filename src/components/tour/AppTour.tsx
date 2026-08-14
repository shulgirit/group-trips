"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { TRIP } from "@/lib/trip";

interface TourStep {
  emoji: string;
  kicker: string;
  title: string;
  lines: string[];
  chips?: string[];
  accent: string;
}

const STEPS: TourStep[] = [
  {
    emoji: "🍋",
    kicker: "חבורת מיחא · סיציליה 2026",
    title: "ברוכים הבאים לאפליקציה שלנו!",
    lines: [
      "כל הטיול במקום אחד — במקום לחפש כתובות והחלטות בוואטסאפ",
      "כל מה שמישהו מוסיף — כולם רואים מיד, בזמן אמת",
      "דקה של הסבר, ותהיו אלופים. מוכנים? קדימה 👇",
    ],
    accent: "bg-lemon-400",
  },
  {
    emoji: "🏠",
    kicker: "המסך הראשי",
    title: "עכשיו — מה קורה ומה הבא?",
    lines: [
      "לפני הטיול: ספירה לאחור לטיסה ✈️",
      "בזמן הטיול: הפעילות הבאה — עם שעה, מי מגיע, וכפתור נווט שפותח Waze",
      "מתחת: הלו״ז של כל היום, עם סימון איפה אנחנו עכשיו",
    ],
    accent: "bg-sea-400",
  },
  {
    emoji: "📍",
    kicker: "טאב מקומות",
    title: "האטרקציות, המסעדות והחופים שלנו",
    lines: [
      "להוסיף מקום? כותבים את השם בחופשיות (״אצטדיון ברברה פלרמו״) — והאפליקציה מוצאת אותו לבד, כולל תמונה ומיקום",
      "יש קישור לאתר? מדביקים — וה-AI ממלא תיאור, שעות ומחירים",
      "בכל דף מקום יש כפתור ✨ שמוסיף עוד תוכן — ככה לא צריך לצאת לאתרים חיצוניים",
    ],
    accent: "bg-terra-400",
  },
  {
    emoji: "📅",
    kicker: "טאב לוח",
    title: "לוח הטיול — יום אחרי יום",
    lines: [
      "לוחצים על כל אירוע כדי לשנות שעה, משתתפים או טקסט",
      "הקבוצה מתפצלת? אין בעיה — חלק לכדורגל ⚽ וחלק למסעדה 🍝, והלוח מסמן זאת",
      "כ-45 דקות לפני כל פעילות — כולם מקבלים תזכורת לנייד ⏰",
    ],
    accent: "bg-sea-500",
  },
  {
    emoji: "🗺️",
    kicker: "טאב מפה",
    title: "הכל על מפה אחת",
    lines: [
      "הוילה שלנו מסומנת בסיכה כתומה גדולה 🏡 — אי אפשר לפספס",
      "לוחצים על כל סיכה — רואים תמונה ופרטים, ומנווטים בקליק",
    ],
    accent: "bg-olive-500",
  },
  {
    emoji: "🗳️",
    kicker: "סקרים (בתפריט עוד)",
    title: "מחליטים ביחד — בלי ויכוחים",
    lines: [
      "כל אחד מצביע בלחיצה אחת, ואפשר לראות מי הצביע למה",
      "ליד כל אפשרות: ״קראו על המקום״ — כל המידע בפנים",
      "כשההחלטה נפלה: ״קבע כפעילות״ מכניס ישר ללוח",
    ],
    accent: "bg-lemon-400",
  },
  {
    emoji: "💶",
    kicker: "הוצאות (בתפריט עוד)",
    title: "מי שילם ומי חייב",
    lines: [
      "קניתם בסופר? רושמים בשניות — האפליקציה מחלקת בין המשפחות",
      "בסוף הטיול: חשבון סגור אוטומטית — מי מעביר למי וכמה",
    ],
    accent: "bg-terra-400",
  },
  {
    emoji: "🦻",
    kicker: "הקסם האמיתי",
    title: "המשרת של חבורת מיחא ✨",
    lines: [
      "עוזר AI שמכיר את כל הטיול שלנו — פשוט דברו איתו חופשי:",
    ],
    chips: [
      "״תמליץ על מסעדה לילדים בפלרמו״",
      "״תוסיף למחר ב-14:00 את המעיינות החמים״",
      "״תעשה סקר לכולם — מה עושים ביום שלישי?״",
      "״מה הלו״ז של מחר?״",
    ],
    accent: "bg-lemon-400",
  },
  {
    emoji: "🎯",
    kicker: "שלושה צעדים אחרונים",
    title: "כדי לקבל את המקסימום",
    lines: [
      "1️⃣ הוסיפו למסך הבית: כפתור שיתוף ← ״הוסף למסך הבית״ — וזו אפליקציה אמיתית 📲",
      "2️⃣ בהגדרות: הפעילו התראות 🔔 — סקרים חדשים ותזכורות",
      "3️⃣ בהגדרות: קשרו את עצמכם למשפחה 👤 — ותצביעו בקליק אחד",
    ],
    accent: "bg-sea-400",
  },
];

const TOUR_SEEN_KEY = "micha-tour-seen-v1";

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // storage unavailable — the tour will simply offer itself again
  }
}

export function wasTourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
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

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  function finish() {
    markTourSeen();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-sea-900 to-sea-950"
      role="dialog"
      aria-modal="true"
      aria-label="סיור היכרות באפליקציה"
    >
      {/* Welcome photo on the first step */}
      {isFirst && (
        <div aria-hidden className="absolute inset-0 opacity-25">
          <Image
            src={TRIP.heroImage}
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
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition ${
                i <= stepIndex ? "bg-lemon-400" : "bg-white/20"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={finish}
          aria-label="דילוג על הסיור"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-cream-50"
        >
          <X size={18} />
        </button>
      </div>

      {/* Step content */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-7 text-center">
        <span
          className={`flex h-24 w-24 items-center justify-center rounded-[2rem] text-5xl shadow-[var(--shadow-float)] ${step.accent}`}
          aria-hidden
        >
          {step.emoji}
        </span>
        <p className="kicker mt-6 text-lemon-300">{step.kicker}</p>
        <h2 className="mt-2 font-display text-3xl font-bold leading-tight text-cream-50">
          {step.title}
        </h2>
        <div className="mt-5 max-w-sm space-y-3">
          {step.lines.map((line) => (
            <p
              key={line}
              className="text-[15px] leading-relaxed text-cream-50/85"
            >
              {line}
            </p>
          ))}
        </div>
        {step.chips && (
          <div className="mt-4 flex max-w-sm flex-wrap justify-center gap-2">
            {step.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm text-cream-50"
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
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cream-50"
            aria-label="הקודם"
          >
            <ChevronRight size={22} />
          </button>
        ) : (
          <span className="w-12" />
        )}
        <button
          type="button"
          onClick={() => (isLast ? finish() : setStepIndex(stepIndex + 1))}
          className={`btn flex-1 py-4 text-lg font-bold ${
            isLast
              ? "bg-lemon-400 text-sea-950"
              : "bg-cream-50 text-sea-900"
          }`}
        >
          {isLast ? "🍋 יאללה, מתחילים!" : "הבא"}
          {!isLast && <ChevronLeft size={20} />}
        </button>
      </div>
    </div>
  );
}
