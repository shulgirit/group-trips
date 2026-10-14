"use client";

import Link from "next/link";
import {
  ChevronRight,
  Images,
  LayoutGrid,
  Settings,
  Ticket,
  Users,
  Vote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LogoutRow } from "@/components/tour/LogoutRow";
import { TourRow } from "@/components/tour/TourRow";
import { useTrip } from "@/components/providers/TripProvider";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

interface MoreSection {
  icon: LucideIcon | null;
  label: string;
  description: string;
  href: string | null;
}

export default function MorePage() {
  const trip = useTrip();
  const t = useT();
  const aiHref = `${trip.prefix}/ai`;

  const sections: MoreSection[] = [
    // Legacy trips run on a shared password, so there's no "My trips" for them
    ...(trip.legacy
      ? []
      : [
          {
            icon: LayoutGrid,
            label: t("settings.more.myTrips"),
            description: t("settings.more.myTripsDescription"),
            href: "/trips",
          },
        ]),
    {
      icon: null, // the trip's AI persona glyph
      label: trip.ai.moreLabel,
      description: t("settings.more.aiDescription"),
      href: aiHref,
    },
    {
      icon: Vote,
      label: t("settings.more.polls"),
      description: t("settings.more.pollsDescription"),
      href: `${trip.prefix}/polls`,
    },
    {
      icon: Wallet,
      label: t("settings.more.expenses"),
      description: t("settings.more.expensesDescription"),
      href: `${trip.prefix}/expenses`,
    },
    {
      icon: Users,
      label: trip.group.moreLabel,
      description: trip.group.moreDescription,
      href: `${trip.prefix}/families`,
    },
    {
      icon: Ticket,
      label: t("settings.more.documents"),
      description: t("settings.more.documentsDescription"),
      href: `${trip.prefix}/documents`,
    },
    {
      icon: Images,
      label: t("settings.more.photos"),
      description: t("settings.more.photosDescription"),
      href: null,
    },
    {
      icon: Settings,
      label: t("settings.title"),
      description: t("settings.more.settingsDescription"),
      href: `${trip.prefix}/settings`,
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-light text-ink-900">
        {t("settings.more.title")}
      </h1>
      <ul className="space-y-2">
        {sections.map(({ icon: Icon, label, description, href }) => {
          const isAi = href === aiHref;
          const glyph = (
            <span
              aria-hidden
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                isAi
                  ? "border-lemon-400/70 text-lemon-500"
                  : "border-cream-200 text-ink-700"
              }`}
            >
              {Icon ? (
                <Icon size={18} strokeWidth={STROKE} />
              ) : (
                <Glyph value={trip.ai.moreEmoji} size={18} />
              )}
            </span>
          );
          const text = (
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">{label}</span>
              <span className="block text-sm text-ink-500">{description}</span>
            </span>
          );
          return (
            <li key={href ?? label}>
              {href ? (
                <Link
                  href={href}
                  className={`flex items-center gap-4 rounded-2xl border bg-white px-4 py-3.5 transition active:bg-cream-100 ${
                    isAi ? "border-lemon-300" : "border-cream-200"
                  }`}
                >
                  {glyph}
                  {text}
                  <ChevronRight
                    size={16}
                    strokeWidth={STROKE}
                    aria-hidden
                    className="shrink-0 text-ink-300 rtl:rotate-180"
                  />
                </Link>
              ) : (
                <div className="flex items-center gap-4 rounded-2xl border border-cream-200 bg-white px-4 py-3.5 opacity-60">
                  {glyph}
                  {text}
                  <span className="kicker shrink-0 text-ink-500">
                    {t("settings.more.soon")}
                  </span>
                </div>
              )}
            </li>
          );
        })}
        <li>
          <TourRow />
        </li>
        <li>
          <LogoutRow />
        </li>
      </ul>
    </div>
  );
}
