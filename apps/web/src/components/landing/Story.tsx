"use client";

import Link from "next/link";
import { useRef } from "react";
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import {
  BedDouble,
  CalendarPlus,
  Car,
  Check,
  FileText,
  Languages,
  Link2,
  MapPinned,
  Plane,
  ScanText,
  StickyNote,
  Users,
  UtensilsCrossed,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { Companion } from "@/components/ai/Companion";
import { Robot } from "./robot/Robot";
import { InviteCodeEntry } from "@/components/onboarding/InviteCodeEntry";
import { StoreBadges } from "./StoreBadges";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { STROKE } from "@/components/ui/Icon";
import { useLocale, useT, type TKey } from "@/i18n";
import { intlLocale } from "@together/i18n/format";

/* ── shared pieces ─────────────────────────────────────────── */

function ExampleTag({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = useT();
  return (
    <span
      className={`absolute end-4 top-4 rounded-full px-2.5 py-1 text-xs ${
        tone === "dark" ? "bg-cream-50/10 text-cream-50/70" : "bg-chart-100 text-ink-500"
      }`}
    >
      {t("landing.example")}
    </span>
  );
}

function SectionText({
  title,
  text,
  tone = "light",
}: {
  title: TKey;
  text: TKey;
  tone?: "light" | "dark";
}) {
  const t = useT();
  return (
    <div className="max-w-md">
      <h2
        className={`font-serif text-display-sm font-medium lg:text-display ${
          tone === "dark" ? "text-cream-50" : "text-ink-900"
        }`}
      >
        {t(title)}
      </h2>
      <p
        className={`mt-5 text-[17px] leading-relaxed ${
          tone === "dark" ? "text-cream-50/75" : "text-ink-700"
        }`}
      >
        {t(text)}
      </p>
    </div>
  );
}

const PEOPLE: { key: TKey; tone: string }[] = [
  { key: "landing.invite.people.p1", tone: "bg-route-300 text-night-950" },
  { key: "landing.invite.people.p2", tone: "bg-cream-200 text-night-950" },
  { key: "landing.invite.people.p3", tone: "bg-brass-300 text-night-950" },
  { key: "landing.invite.people.p4", tone: "bg-night-700 text-cream-50" },
];

/** "Grandma Sharon" → S, "The Millers" → M, "משפחת לוי" → ל */
function initialOf(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1] ?? "").slice(0, 1).toUpperCase();
}

/* ── 1. invite: separate people, one link (night) ──────────── */

function InviteSection() {
  const t = useT();
  return (
    <section className="bg-night-950 px-5 pb-12 pt-10 text-cream-50 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <SectionText title="landing.invite.title" text="landing.invite.text" tone="dark" />
        <div
          className="relative rounded-[1.75rem] border border-cream-50/10 bg-night-900 p-6 sm:p-8"
          aria-label={t("landing.example")}
        >
          <ExampleTag tone="dark" />
          {/* the shared link */}
          <div className="max-w-[18rem] rounded-2xl rounded-ss-md bg-night-800 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-night-950 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-night-900 text-cream-50">
                <LogoMark size={26} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{t("landing.invite.message")}</span>
                <span className="block text-xs text-cream-50/55" dir="ltr">
                  togethergroup.app/j/sicily
                </span>
              </span>
            </div>
          </div>
          {/* people converge on one point — the logo's idea, in UI */}
          <ul className="relative mt-8 space-y-3 ps-6">
            <span
              aria-hidden
              className="absolute bottom-6 start-[11px] top-2 w-px bg-gradient-to-b from-cream-50/5 via-brass-500/60 to-brass-500"
            />
            {PEOPLE.map((person, index) => (
              <m.li
                key={person.key}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: 0.15 + index * 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex items-center gap-3"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${person.tone}`}
                >
                  {initialOf(t(person.key))}
                </span>
                <span className="text-sm">
                  {t(person.key)}{" "}
                  <span className="text-cream-50/55">{t("landing.invite.joined")}</span>
                </span>
              </m.li>
            ))}
            <li className="relative flex items-center gap-3 pt-1">
              <span className="flex h-9 w-9 items-center justify-center">
                <span className="h-3 w-3 rounded-full bg-brass-500 shadow-[0_0_0_6px_rgb(176_138_85/0.18)]" />
              </span>
              <span className="font-serif text-lg">{t("landing.places.sicily")}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── 2. from scattered to sorted (the one scroll moment) ───── */

const SCATTERED: { key: TKey; Icon: LucideIcon; x: number; y: number; r: number }[] = [
  { key: "landing.sorted.items.flight", Icon: Plane, x: -30, y: -10, r: -4 },
  { key: "landing.sorted.items.hotel", Icon: FileText, x: 24, y: 6, r: 3 },
  { key: "landing.sorted.items.link", Icon: Link2, x: -12, y: 18, r: 2 },
  { key: "landing.sorted.items.note", Icon: StickyNote, x: 30, y: -6, r: -2 },
];

const EVENTS: { key: TKey; time: string; Icon: LucideIcon }[] = [
  { key: "landing.sorted.events.flight", time: "09:40", Icon: Plane },
  { key: "landing.sorted.events.car", time: "13:15", Icon: Car },
  { key: "landing.sorted.events.villa", time: "15:00", Icon: BedDouble },
  { key: "landing.sorted.events.dinner", time: "20:00", Icon: UtensilsCrossed },
];

function ScatteredItem({
  item,
  progress,
  index,
  still,
}: {
  item: (typeof SCATTERED)[number];
  progress: MotionValue<number>;
  index: number;
  still: boolean;
}) {
  const t = useT();
  const start = 0.12 + index * 0.04;
  const opacity = useTransform(progress, [start, start + 0.22], [1, 0.55]);
  const rotate = useTransform(progress, [start, start + 0.22], [item.r, 0]);
  const x = useTransform(progress, [start, start + 0.22], [item.x, 0]);
  return (
    <m.li
      style={still ? undefined : { opacity, rotate, x }}
      className="flex items-center gap-3 rounded-xl border border-chart-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgb(15_27_45/0.05)]"
    >
      <item.Icon size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
      <span className="truncate text-sm text-ink-700" dir="auto">
        {t(item.key)}
      </span>
    </m.li>
  );
}

function EventRow({
  event,
  progress,
  index,
  still,
  last,
}: {
  event: (typeof EVENTS)[number];
  progress: MotionValue<number>;
  index: number;
  still: boolean;
  last: boolean;
}) {
  const t = useT();
  const start = 0.16 + index * 0.05;
  const opacity = useTransform(progress, [start, start + 0.12], [0, 1]);
  const y = useTransform(progress, [start, start + 0.12], [10, 0]);
  return (
    <m.li style={still ? undefined : { opacity, y }} className="relative flex gap-4 pb-5 last:pb-0">
      <span className="relative flex w-3 shrink-0 justify-center">
        {!last && <span aria-hidden className="absolute top-4 h-full w-px bg-route-300" />}
        <span
          className={`mt-1.5 h-3 w-3 rounded-full border-2 ${
            last ? "border-brass-500 bg-brass-500" : "border-route-500 bg-white"
          }`}
        />
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2.5">
          <event.Icon size={17} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
          <span className="text-[15px] font-medium leading-snug text-ink-900">{t(event.key)}</span>
        </span>
        <span className="shrink-0 text-sm tabular-nums text-ink-500" dir="ltr">
          {event.time}
        </span>
      </span>
    </m.li>
  );
}

function SortedSection() {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const still = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  return (
    <section className="bg-chart-50 px-5 pb-16 lg:px-10 lg:pb-24">
      <div aria-hidden className="dawn -mx-5 mb-4 h-24 lg:-mx-10 lg:h-40" />
      <div ref={ref} className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionText title="landing.sorted.title" text="landing.sorted.text" />
        <div
          className="relative grid gap-6 rounded-[1.75rem] bg-chart-100/70 p-6 sm:grid-cols-[0.85fr_1.15fr] sm:p-8"
          aria-label={t("landing.example")}
        >
          <ExampleTag />
          <div>
            <p className="text-sm text-ink-500">{t("landing.sorted.scattered")}</p>
            <ul className="mt-3 space-y-2.5">
              {SCATTERED.map((item, index) => (
                <ScatteredItem key={item.key} item={item} progress={scrollYProgress} index={index} still={still} />
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm text-ink-500">{t("landing.sorted.organized")}</p>
            <div className="mt-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgb(15_27_45/0.05),0_12px_32px_-20px_rgb(15_27_45/0.25)]">
              <p className="font-serif text-xl text-ink-900">{t("landing.sorted.day")}</p>
              <ol className="mt-4">
                {EVENTS.map((event, index) => (
                  <EventRow
                    key={event.key}
                    event={event}
                    progress={scrollYProgress}
                    index={index}
                    still={still}
                    last={index === EVENTS.length - 1}
                  />
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3. AI travel guide — the guide's own stage ───────────── */

const CAPS: { key: string; Icon: LucideIcon }[] = [
  { key: "places", Icon: MapPinned },
  { key: "plan", Icon: CalendarPlus },
  { key: "poll", Icon: Vote },
  { key: "read", Icon: ScanText },
  { key: "group", Icon: Users },
  { key: "language", Icon: Languages },
];

function AiSection() {
  const t = useT();
  return (
    <section className="relative isolate overflow-hidden bg-night-950 px-5 py-16 text-cream-50 lg:px-10 lg:py-24">
      <div aria-hidden className="ai-aura absolute inset-0 -z-10" />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-14">
          <Robot className="order-2 mx-auto aspect-square w-full max-w-[22rem] lg:ms-auto lg:me-0 lg:max-w-[26rem]" />
          <div className="max-w-xl lg:order-1">
            <p className="text-sm text-brass-300">{t("landing.ai.meet")}</p>
            <h2 className="mt-2 font-serif text-display-sm font-medium lg:text-display">{t("landing.ai.title")}</h2>
            <p className="mt-5 text-[17px] leading-relaxed text-cream-50/75">{t("landing.ai.text")}</p>
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* example conversation */}
          <div
            className="relative rounded-[1.75rem] border border-cream-50/10 bg-night-900 p-5 sm:p-7"
            aria-label={t("landing.example")}
          >
            <ExampleTag tone="dark" />
            <div className="flex justify-end pt-8">
              <p className="max-w-[82%] rounded-2xl rounded-ee-md bg-cream-50 px-4 py-3 text-[15px] leading-relaxed text-night-950">
                {t("landing.ai.question")}
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <Companion size={36} ground="night" className="-mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed text-cream-50/90">{t("landing.ai.answer")}</p>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {[
                    ["landing.ai.place1", "landing.ai.place1Meta"],
                    ["landing.ai.place2", "landing.ai.place2Meta"],
                  ].map(([name, meta]) => (
                    <li key={name} className="rounded-xl border border-cream-50/10 bg-night-800 px-4 py-3">
                      <span className="block text-[15px] font-medium" dir="ltr">
                        {t(name as TKey)}
                      </span>
                      <span className="mt-0.5 block text-sm text-cream-50/60">{t(meta as TKey)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-route-500/25 px-3 py-1.5 text-sm text-route-100">
                  <Check size={15} strokeWidth={2} aria-hidden />
                  {t("landing.ai.done")}
                </p>
              </div>
            </div>
          </div>

          {/* what it can actually do (its real tools) */}
          <ul className="grid content-start gap-x-8 gap-y-7 sm:grid-cols-2">
            {CAPS.map(({ key, Icon }) => (
              <li key={key} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass-500/40 text-brass-300">
                  <Icon size={18} strokeWidth={STROKE} aria-hidden />
                </span>
                <span>
                  <span className="block font-medium">{t(`landing.ai.caps.${key}.title` as TKey)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-cream-50/65">
                    {t(`landing.ai.caps.${key}.text` as TKey)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── 4. decide & settle ─────────────────────────────────────── */

function TogetherSection() {
  const t = useT();
  const { locale } = useLocale();
  const euro = new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const options: { key: TKey; votes: number }[] = [
    { key: "landing.together.beach", votes: 8 },
    { key: "landing.together.town", votes: 5 },
  ];
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  return (
    <section className="bg-chart-50 px-5 py-16 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionText title="landing.together.title" text="landing.together.text" />
        <div className="relative grid gap-4 sm:grid-cols-[1.2fr_1fr]" aria-label={t("landing.example")}>
          <div className="relative rounded-[1.75rem] bg-white p-6 shadow-[0_1px_2px_rgb(15_27_45/0.05)]">
            <ExampleTag />
            <p className="max-w-[75%] font-serif text-xl text-ink-900">{t("landing.together.poll")}</p>
            <ul className="mt-5 space-y-3">
              {options.map((option, index) => (
                <li key={option.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink-900">{t(option.key)}</span>
                    <span className="text-ink-500">{t("landing.together.votes", { count: option.votes })}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-chart-100">
                    <div
                      className={`h-2 rounded-full ${index === 0 ? "bg-brass-500" : "bg-route-300"}`}
                      style={{ width: `${(option.votes / total) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-between rounded-[1.75rem] bg-night-950 p-6 text-cream-50">
            <p className="text-sm text-cream-50/65">{t("landing.together.settle")}</p>
            <div className="mt-8">
              <p className="font-serif text-display-sm leading-none" dir="ltr">
                {euro.format(84)}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-cream-50/80">{t("landing.together.transfer")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 5. how it works — a real sequence, so numbered ────────── */

const STEPS = ["create", "invite", "plan", "go"] as const;

function HowSection() {
  const t = useT();
  return (
    <section id="how" className="scroll-mt-8 bg-white px-5 py-16 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-xl font-serif text-display-sm font-medium text-ink-900 lg:text-display">
          {t("landing.how.title")}
        </h2>
        <ol className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-8">
          <span
            aria-hidden
            className="absolute start-[15px] top-2 h-[calc(100%-1rem)] w-px bg-route-300 lg:start-0 lg:top-[15px] lg:h-px lg:w-full"
          />
          {STEPS.map((step, index) => (
            <li key={step} className="relative flex gap-5 lg:block">
              <span
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  index === STEPS.length - 1
                    ? "bg-brass-500 text-night-950"
                    : "border border-route-300 bg-white text-route-700"
                }`}
              >
                {index + 1}
              </span>
              <div className="lg:mt-6">
                <p className="text-lg font-medium text-ink-900">{t(`landing.how.steps.${step}.title` as TKey)}</p>
                <p className="mt-1.5 max-w-xs leading-relaxed text-ink-500">{t(`landing.how.steps.${step}.text` as TKey)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── 6. final call + footer (night) ─────────────────────────── */

function FinalSection() {
  const t = useT();
  return (
    <section className="relative isolate overflow-hidden bg-night-950 px-5 pb-10 pt-20 text-cream-50 lg:px-10 lg:pt-28">
      <div aria-hidden className="final-horizon absolute inset-x-0 bottom-0 -z-10 h-[70%]" />
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-serif text-display font-medium lg:text-display-lg">{t("landing.final.title")}</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-cream-50/75">{t("landing.final.text")}</p>
          <div className="mx-auto mt-9 max-w-xs">
            <StoreBadges className="justify-center" />
            <InviteCodeEntry className="mt-3" />
            <p className="mt-2 text-sm text-cream-50/70">{t("landing.hero.free")}</p>
          </div>
        </div>

        <footer className="mt-20 flex flex-col gap-6 border-t border-cream-50/10 pt-8 text-sm text-cream-50/60 lg:flex-row lg:items-center lg:justify-between">
          <span className="flex items-center gap-2.5 text-cream-50/85">
            <LogoMark size={22} />
            <Wordmark className="text-[13px]" />
          </span>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/terms" className="hover:text-cream-50">
              {t("product.account.termsLink")}
            </Link>
            <Link href="/privacy" className="hover:text-cream-50">
              {t("product.account.privacyLink")}
            </Link>
          </nav>
          <span className="text-cream-50/45">{t("landing.footer.credit")}</span>
        </footer>
      </div>
    </section>
  );
}

export function Story() {
  return (
    <>
      <InviteSection />
      <SortedSection />
      <AiSection />
      <TogetherSection />
      <HowSection />
      <FinalSection />
    </>
  );
}
