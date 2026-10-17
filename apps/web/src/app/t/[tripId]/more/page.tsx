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
import { SURFACE } from "@/components/settings/SettingsGroup";
import { useSession } from "@/components/providers/SessionProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";

interface MoreRow {
  icon: LucideIcon;
  label: string;
  description: string;
  /** null = not available yet */
  href: string | null;
}

function Row({ icon: Icon, label, description, href }: MoreRow) {
  const t = useT();
  const body = (
    <>
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-200 text-ink-700"
      >
        <Icon size={18} strokeWidth={STROKE} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink-900">
          <bdi>{label}</bdi>
        </span>
        <span className="block truncate text-sm text-ink-500">
          <bdi>{description}</bdi>
        </span>
      </span>
    </>
  );
  if (!href) {
    return (
      <div className="flex min-h-16 items-center gap-4 px-4 py-3 opacity-60">
        {body}
        <span className="shrink-0 rounded-full bg-cream-100 px-2.5 py-1 text-xs text-ink-500">
          {t("settings.more.soon")}
        </span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-4 px-4 py-3 transition active:bg-cream-100"
    >
      {body}
      <ChevronRight
        size={16}
        strokeWidth={STROKE}
        aria-hidden
        className="shrink-0 text-ink-300 rtl:rotate-180"
      />
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-medium text-ink-900">{title}</h2>
      <ul className={`${SURFACE} divide-y divide-cream-200/80 overflow-hidden`}>
        {children}
      </ul>
    </section>
  );
}

export default function MorePage() {
  const trip = useTrip();
  const { personal } = useSession();
  const t = useT();

  const tripRows: MoreRow[] = [
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
  ];

  const accountRows: MoreRow[] = [
    {
      icon: Settings,
      label: t("settings.title"),
      description: t("settings.more.settingsDescription"),
      href: `${trip.prefix}/settings`,
    },
    // Shared-password logins on legacy trips have no "My trips"; Google accounts do
    ...(trip.legacy && !personal
      ? []
      : [
          {
            icon: LayoutGrid,
            label: t("settings.more.myTrips"),
            description: t("settings.more.myTripsDescription"),
            href: "/trips",
          },
        ]),
  ];

  return (
    <div className="space-y-9">
      <div>
        <p className="kicker text-ink-500">
          <bdi>{trip.name}</bdi>
        </p>
        <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
          {t("settings.more.title")}
        </h1>
      </div>

      {/* The guide: the one brass moment on this page */}
      <Link
        href={`${trip.prefix}/ai`}
        className={`${SURFACE} flex items-center gap-4 p-4 ring-1 ring-brass-300/70 transition active:scale-[0.99]`}
      >
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-night-900 text-brass-300"
        >
          {trip.ai.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- small avatar
            <img src={trip.ai.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <Glyph value={trip.ai.moreEmoji} size={22} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium text-ink-900">
            <bdi>{trip.ai.moreLabel}</bdi>
          </span>
          <span className="block text-sm text-ink-500">
            {t("settings.more.aiDescription")}
          </span>
        </span>
        <ChevronRight
          size={18}
          strokeWidth={STROKE}
          aria-hidden
          className="shrink-0 text-brass-600 rtl:rotate-180"
        />
      </Link>

      <div className="space-y-9 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0">
        <Group title={t("settings.more.groupTrip")}>
          {tripRows.map((row) => (
            <li key={row.label}>
              <Row {...row} />
            </li>
          ))}
        </Group>

        <Group title={t("settings.more.groupApp")}>
          {accountRows.map((row) => (
            <li key={row.label}>
              <Row {...row} />
            </li>
          ))}
          <li>
            <TourRow />
          </li>
          <li>
            <LogoutRow />
          </li>
        </Group>
      </div>
    </div>
  );
}
