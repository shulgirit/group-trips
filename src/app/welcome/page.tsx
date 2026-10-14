"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MapPin, Sparkles, Ticket, Wallet, type LucideIcon } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { STROKE } from "@/components/ui/Icon";
import { useT, type TKey } from "@/i18n";
import { useAuthUser } from "@/lib/use-auth-user";

const FEATURES: { key: string; Icon: LucideIcon; title: TKey; text: TKey }[] = [
  {
    key: "ai",
    Icon: Sparkles,
    title: "product.welcome.features.ai.title",
    text: "product.welcome.features.ai.text",
  },
  {
    key: "bookings",
    Icon: Ticket,
    title: "product.welcome.features.bookings.title",
    text: "product.welcome.features.bookings.text",
  },
  {
    key: "map",
    Icon: MapPin,
    title: "product.welcome.features.map.title",
    text: "product.welcome.features.map.text",
  },
  {
    key: "money",
    Icon: Wallet,
    title: "product.welcome.features.money.title",
    text: "product.welcome.features.money.text",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const t = useT();
  const { personal, loading } = useAuthUser();

  useEffect(() => {
    if (!loading && personal) router.replace("/trips");
  }, [loading, personal, router]);

  return (
    <main className="min-h-dvh">
      <section className="bg-sea-950 px-6 pb-16 pt-[max(4rem,env(safe-area-inset-top))] text-center">
        <div className="mx-auto max-w-md">
          <LogoMark size={48} className="mx-auto text-cream-50" />
          <Wordmark className="mt-5 block text-sm text-lemon-300" />
          <h1 className="mt-6 font-display text-4xl font-light leading-tight text-cream-50">
            {t("common.tagline")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-cream-50/75">
            {t("product.welcome.lead")}
          </p>
          <div className="mx-auto mt-10 max-w-xs">
            <SignInPanel tone="dark" onSignedIn={() => router.replace("/trips")} />
          </div>
          <p className="mt-5 text-xs leading-relaxed text-cream-50/55">
            {t("product.welcome.consent.before")}
            <Link href="/terms" className="underline underline-offset-2">
              {t("product.welcome.consent.terms")}
            </Link>
            {t("product.welcome.consent.between")}
            <Link href="/privacy" className="underline underline-offset-2">
              {t("product.welcome.consent.privacy")}
            </Link>
            {t("product.welcome.consent.after")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-lg px-5 py-12">
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ key, Icon, title, text }) => (
            <li key={key} className="card px-5 py-5">
              <Icon size={20} strokeWidth={STROKE} aria-hidden className="text-sea-700" />
              <p className="mt-3 font-display text-base font-medium text-ink-900">{t(title)}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{t(text)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-center text-sm text-ink-500">
          {t("product.welcome.legacy.question")}{" "}
          <Link href="/gate" className="font-medium text-sea-700 underline underline-offset-2">
            {t("product.welcome.legacy.link")}
          </Link>
        </p>
      </section>
    </main>
  );
}
