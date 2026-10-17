"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Plane,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { RouteArt } from "@/components/journal/RouteArt";
import { avatarSrc } from "@together/shared/avatars";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { InviteLinks } from "@/components/product/InviteLinks";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { formatShortDate } from "@together/i18n/format";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale, useT, type TKey } from "@/i18n";
import { convex } from "@/lib/convex";
import { toTripDoc } from "@/lib/convex-trip";
import { useMyTrips } from "@/lib/my-trips";
import { stopsOf } from "@together/shared/trip-doc";
import { useAuthUser } from "@/lib/use-auth-user";
import { BookingImporter } from "./BookingImporter";
import { StepAi } from "./StepAi";
import { StepWhere } from "./StepWhere";
import { StepWho } from "./StepWho";
import {
  DRAFT_KEY,
  basicsValid,
  groupValid,
  initialState,
  peopleCounts,
  primaryPlace,
  shortId,
  toTripInput,
  tripEnd,
  tripStart,
  type CreatorState,
} from "./state";

const STEPS = [
  { key: "where", label: "creator.steps.where" },
  { key: "who", label: "creator.steps.who" },
  { key: "bookings", label: "creator.steps.bookings" },
  { key: "ai", label: "creator.steps.ai" },
  { key: "launch", label: "creator.steps.launch" },
] as const satisfies readonly { key: string; label: TKey }[];

function readLocalDraft(): CreatorState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CreatorState) : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(state: CreatorState | null) {
  try {
    if (state) localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // private mode — the server draft still exists once created
  }
}

/** Loads an existing trip (draft resume / organizer edit) into wizard state. */
async function loadTripState(tripRef: string): Promise<CreatorState | null> {
  const tripId = await convex.query(api.trips.resolve, { ref: tripRef });
  if (!tripId) return null;
  const [{ trip, me: seat, avatarUrl }, familyRows] = await Promise.all([
    convex.query(api.trips.get, { tripId }),
    convex.query(api.families.list, { tripId }),
  ]);
  const data = toTripDoc(trip, avatarUrl);
  const familyKey = familyRows.find((f) => f._id === seat.familyId)?.key;
  const me = familyKey && seat.memberKey ? { familyId: familyKey, memberId: seat.memberKey } : null;
  const departureTime = data.departureAt?.slice(11, 16) ?? "";
  return {
    tripId,
    status: data.status,
    name: data.name,
    emoji: data.emoji,
    stops: stopsOf(data).map((stop) => ({
      id: /^[a-z0-9-]{2,40}$/.test(stop.id) ? stop.id : shortId("s"),
      place: {
        label: stop.label,
        placeId: stop.placeId ?? "",
        lat: stop.lat,
        lng: stop.lng,
        region: stop.region,
        country: stop.country ?? "",
        timezone: stop.timezone,
        currency: stop.currency,
        coverImage: stop.coverImage,
      },
      startDate: stop.startDate,
      endDate: stop.endDate,
    })),
    departureTime,
    groupKind: data.groupKind,
    groupName: data.groupName,
    families: familyRows.map((f) => ({
      id: f.key,
      name: f.name,
      members: f.members.map((m) => ({ id: m.key, name: m.name, kid: Boolean(m.kid), age: m.age ?? null })),
    })),
    me,
    ai: {
      name: data.ai.name,
      emoji: data.ai.emoji,
      avatar: data.ai.avatar ?? null,
      avatarStorageId: trip.ai.avatar?.kind === "file" ? trip.ai.avatar.storageId : null,
      preset: data.ai.preset,
      rules: data.ai.rules ?? [],
      customRules: data.ai.customRules ?? "",
    },
    aboutUs: data.aboutUs ?? "",
    homeBase: data.homeBase,
  };
}

export function CreatorWizard() {
  const router = useRouter();
  const t = useT();
  const { dir, locale } = useLocale();
  const params = useSearchParams();
  const editTripId = params.get("trip");
  const { user, personal, loading: authLoading } = useAuthUser();
  const { trips } = useMyTrips(personal ? user!.uid : null);
  const [state, setState] = useState<CreatorState | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [launched, setLaunched] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Initial state: an existing trip (?trip=), the local draft, or fresh
  useEffect(() => {
    if (authLoading || !personal || !user) return;
    const key = editTripId ?? "new";
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    if (editTripId) {
      loadTripState(editTripId)
        .then((loaded) => {
          if (!loaded) {
            setError(t("creator.errors.notFound"));
            return;
          }
          setState(loaded);
          // Drafts resume where details are still missing
          setStep(loaded.status === "draft" ? 2 : 0);
        })
        .catch(() => setError(t("creator.errors.noPermission")));
    } else {
      const draft = readLocalDraft();
      setState(draft && !draft.tripId ? draft : initialState(user.displayName));
    }
  }, [authLoading, personal, user, editTripId, t]);

  const update = useCallback((patch: Partial<CreatorState>) => {
    setState((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (!next.tripId) writeLocalDraft(next);
      return next;
    });
  }, []);

  async function save(status: "draft" | "active"): Promise<string | null> {
    if (!state) return null;
    setSaving(true);
    setError("");
    try {
      const input = toTripInput(state, status);
      let tripId: string;
      try {
        if (state.tripId) {
          await convex.mutation(api.trips.update, { tripId: state.tripId as Id<"trips">, input });
          tripId = state.tripId;
        } else {
          tripId = await convex.mutation(api.trips.create, { input });
        }
      } catch (err) {
        const detail = (err as { data?: { detail?: string } }).data?.detail;
        setError(detail === "trip_limit" ? t("creator.errors.tripLimit") : t("creator.errors.saveFailed"));
        return null;
      }
      if (!state.tripId) {
        writeLocalDraft(null);
        setState((current) => (current ? { ...current, tripId } : current));
        router.replace(`/new?trip=${tripId}`, { scroll: false });
        loadedFor.current = tripId;
      }
      if (status === "active") {
        setState((current) => (current ? { ...current, status: "active" } : current));
      }
      return tripId;
    } catch {
      setError(t("creator.errors.network"));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (!state) return;
    const problem = step === 0 ? basicsValid(state) : step === 1 ? groupValid(state) : null;
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    // From step 2 on there is a server trip (draft) to attach bookings to
    if (step >= 1 || state.tripId) {
      const saved = await save(state.status === "active" ? "active" : "draft");
      if (!saved) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function launch() {
    if (!state) return;
    const tripId = await save("active");
    if (!tripId) return;
    setLaunched(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    convex
      .action(api.assist.summary, { tripId: tripId as Id<"trips">, locale })
      .then((text) => setSummary(text))
      .catch(() => setSummary(""));
  }

  if (authLoading) {
    return (
      <ProductShell>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </ProductShell>
    );
  }

  if (!personal) {
    return (
      <ProductShell>
        <div className="card mx-auto max-w-sm px-6 py-8 text-center">
          <Plane size={28} strokeWidth={STROKE} aria-hidden className="mx-auto text-ink-700" />
          <h1 className="mt-4 font-display text-2xl font-medium text-ink-900">
            {t("creator.signIn.title")}
          </h1>
          <p className="mt-2 text-sm text-ink-500">{t("creator.signIn.text")}</p>
          <div className="mt-6">
            <SignInPanel />
          </div>
        </div>
      </ProductShell>
    );
  }

  if (!state) {
    return (
      <ProductShell>
        {error ? (
          <div className="card px-6 py-8 text-center">
            <p className="font-medium text-ink-900">{error}</p>
            <Link href="/trips" className="btn-soft mt-4 px-5 py-3">
              {t("product.gate.myTrips")}
            </Link>
          </div>
        ) : (
          <Skeleton className="h-96 w-full rounded-3xl" />
        )}
      </ProductShell>
    );
  }

  const isEdit = state.status === "active" && !launched;
  const { people } = peopleCounts(state);
  const stepKey = STEPS[step].key;
  const routeArrow = dir === "rtl" ? " ← " : " → ";

  const cover = primaryPlace(state)?.coverImage ?? null;
  const guideAvatar = avatarSrc(state.ai.avatar);
  const stopLabels = state.stops.map((s) => s.place?.label ?? "").filter(Boolean);
  const dateRange = (
    <span dir="ltr" className="tabular-nums">
      {tripStart(state) ? formatShortDate(tripStart(state)) : ""}–{tripEnd(state) ? formatShortDate(tripEnd(state)) : ""}
    </span>
  );

  // Who still needs a link: everyone outside the creator's own family, plus
  // anyone else inside it. A couple trip reads "send Daniel the link".
  const invitees = state.families.flatMap((f) =>
    f.members.filter((m) => !m.kid && m.id !== state.me?.memberId).map((m) => m.name)
  );
  const launchedInviteText =
    invitees.length === 1
      ? t("creator.launched.textOne", { name: invitees[0] })
      : t("creator.launched.text");

  if (launched && state.tripId) {
    return (
      <ProductShell>
        <div className="space-y-8">
          {/* Atlas moment: the routes meet, the trip exists */}
          <section className="relative -mx-4 -mt-8 overflow-hidden bg-night-950 text-cream-50 md:mx-0 md:mt-0 md:rounded-[1.75rem]">
            <div className="relative h-[19rem]">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <RouteArt seed={state.tripId} focus="top" />
              )}
              <div className="hero-overlay absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
                {cover && (
                <span aria-hidden className="mb-4 flex items-center gap-0">
                  <span className="h-px w-10 bg-cream-50/50" />
                  <span className="h-3 w-3 rounded-full bg-brass-500 shadow-[0_0_0_6px_rgb(176_138_85/0.25)]" />
                  <span className="h-px w-10 bg-cream-50/50" />
                </span>
                )}
                <h1 className="font-display text-display-sm font-medium">
                  {t("creator.launched.title", { name: state.name })}
                </h1>
                <p className="mt-2 text-[15px] text-cream-50/80">
                  <bdi>{stopLabels.join(routeArrow)}</bdi> · {dateRange}
                </p>
              </div>
            </div>
          </section>

          {summary !== "" && (
            <section className="flex gap-4 rounded-2xl bg-white px-5 py-5 shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-night-900 text-brass-300 ring-2 ring-brass-500 ring-offset-2 ring-offset-white">
                {guideAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar
                  <img src={guideAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Glyph value={state.ai.emoji} size={20} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900"><bdi>{state.ai.name}</bdi></p>
                {summary ? (
                  <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-ink-700" dir="auto">{summary}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-3.5 w-full rounded-full" />
                    <Skeleton className="h-3.5 w-4/5 rounded-full" />
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div>
              <h2 className="font-display text-2xl font-medium text-ink-900">{t("creator.wizard.inviteTitle")}</h2>
              <p className="mt-1 text-[15px] text-ink-500">{launchedInviteText}</p>
            </div>
            <InviteLinks
              tripId={state.tripId}
              tripName={state.name}
              emoji={state.emoji}
              families={state.families.map((f) => ({ id: f.id, name: f.name, members: f.members.length }))}
              myFamilyId={state.me?.familyId ?? null}
            />
          </section>
          <Link href={`/t/${state.tripId}`} className="btn-primary w-full gap-2 py-4 text-lg">
            {t("creator.launched.enter")}
            <ArrowRight size={18} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
          </Link>
        </div>
      </ProductShell>
    );
  }

  return (
    <ProductShell>
      <div className="space-y-8">
        {/* Progress: the steps as a route */}
        <nav aria-label={t("creator.steps.label")}>
          <p className="mb-3 text-sm text-ink-500">
            {t("creator.wizard.progress", { n: step + 1, total: STEPS.length })}
          </p>
          <ol className="flex items-start">
            {STEPS.map((s, index) => {
              const done = index < step;
              const current = index === step;
              const reachable = index <= step || Boolean(state.tripId);
              return (
                <li key={s.key} className="relative flex flex-1 flex-col items-center">
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={`absolute end-1/2 top-[21px] h-px w-full ${index <= step ? "bg-route-500" : "bg-chart-200"}`}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-current={current ? "step" : undefined}
                    onClick={() => {
                      if (reachable) setStep(index);
                    }}
                    className="relative z-10 flex min-h-11 w-full flex-col items-center gap-1.5 pt-3.5"
                  >
                    <span
                      aria-hidden
                      className={`flex items-center justify-center rounded-full transition ${
                        current
                          ? "h-3.5 w-3.5 bg-brass-500 ring-4 ring-brass-100"
                          : done
                            ? "h-3.5 w-3.5 bg-route-500 text-cream-50"
                            : "h-3.5 w-3.5 border-2 border-chart-200 bg-cream-50"
                      }`}
                    >
                      {done && <Check size={9} strokeWidth={3} />}
                    </span>
                    <span
                      className={`text-xs ${current ? "font-medium text-ink-900" : done ? "text-ink-700" : "text-ink-400"}`}
                    >
                      {t(s.label)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {stepKey === "where" && <StepWhere state={state} update={update} />}
        {stepKey === "who" && (
          <StepWho
            state={state}
            update={update}
            previousTrips={trips.filter((t) => t.id !== state.tripId && t.status !== "draft")}
          />
        )}
        {stepKey === "bookings" && state.tripId && (
          <div className="space-y-6">
            <header>
              <h1 className="font-display text-display-sm font-medium text-ink-900">
                {t("creator.bookings.title")}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{t("creator.bookings.text")}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    [Plane, "creator.booking.kinds.flight"],
                    [BedDouble, "creator.booking.kinds.lodging"],
                    [CarFront, "creator.booking.kinds.car"],
                    [Ticket, "creator.booking.kinds.activity"],
                  ] as const
                ).map(([Icon, key]) => (
                  <li key={key} className="chip">
                    <Icon size={14} strokeWidth={STROKE} aria-hidden className="text-route-500" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </header>
            <BookingImporter
              tripId={state.tripId}
              onApplied={(result) => {
                if (result.homeBase) {
                  // Reflect the new home base so later saves don't clear it
                  convex
                    .query(api.trips.get, { tripId: state.tripId as Id<"trips"> })
                    .then(({ trip }) => update({ homeBase: trip.homeBase }))
                    .catch(() => undefined);
                }
              }}
            />
          </div>
        )}
        {stepKey === "ai" && <StepAi state={state} update={update} />}
        {stepKey === "launch" && (
          <div className="space-y-6">
            <header>
              <h1 className="font-display text-display-sm font-medium text-ink-900">
                {isEdit ? t("creator.launch.editTitle") : t("creator.launch.title")}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
                {isEdit ? t("creator.launch.editText") : t("creator.launch.text")}
              </p>
            </header>
            <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]">
              <div className="relative h-44 bg-night-900">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <RouteArt seed={state.tripId ?? state.name} focus="top" />
                )}
                <div className="hero-overlay absolute inset-0" />
                <div className="absolute inset-x-5 bottom-4">
                  <p className="text-sm text-cream-50/80">{dateRange}</p>
                  <p className="mt-1 flex items-center gap-2 font-display text-[1.75rem] font-medium leading-tight text-cream-50">
                    <Glyph value={state.emoji} size={20} className="shrink-0 opacity-75" />
                    <span className="truncate" dir="auto">{state.name}</span>
                  </p>
                </div>
              </div>
              {/* The route itself */}
              <ol className="px-5 pt-5">
                {stopLabels.map((label, index) => (
                  <li key={`${label}-${index}`} className="relative flex items-center gap-3 pb-3 last:pb-0">
                    {index < stopLabels.length - 1 && (
                      <span aria-hidden className="absolute start-[5px] top-4 h-full w-px bg-route-300" />
                    )}
                    <span
                      aria-hidden
                      className={`relative h-[11px] w-[11px] shrink-0 rounded-full ${index === stopLabels.length - 1 && stopLabels.length > 1 ? "border-2 border-route-500 bg-white" : "bg-route-500"}`}
                    />
                    <span className="min-w-0 truncate font-medium text-ink-900" dir="auto">{label}</span>
                    {state.stops[index]?.startDate && stopLabels.length > 1 && (
                      <span dir="ltr" className="ms-auto shrink-0 text-xs tabular-nums text-ink-500">
                        {formatShortDate(state.stops[index].startDate)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <dl className="mt-4 divide-y divide-chart-200 border-t border-chart-200 text-sm">
                {(
                  [
                    [
                      Users,
                      t("creator.launch.people"),
                      t("creator.launch.peopleValue", {
                        people,
                        count: state.families.length,
                        units:
                          state.groupKind === "families"
                            ? t("creator.launch.families")
                            : t("creator.launch.groups"),
                      }),
                    ],
                    [null, t("creator.launch.ai"), state.ai.name],
                    [BedDouble, t("creator.launch.lodging"), state.homeBase?.name ?? t("creator.launch.lodgingNone")],
                    [CalendarDays, t("creator.launch.dates"), `${tripStart(state)} – ${tripEnd(state)}`],
                  ] as [LucideIcon | null, string, string][]
                ).map(([Icon, label, value]) => (
                  <div key={label} className="flex min-h-12 items-center justify-between gap-3 px-5 py-3">
                    <dt className="flex items-center gap-2.5 text-ink-500">
                      {Icon ? (
                        <Icon size={16} strokeWidth={STROKE} aria-hidden className="shrink-0" />
                      ) : (
                        <Glyph value={state.ai.emoji} size={16} className="shrink-0" />
                      )}
                      {label}
                    </dt>
                    <dd className="truncate font-medium text-ink-900" dir="auto">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-terra-100 px-4 py-3 text-center text-sm font-medium text-terra-600">
            {error}
          </p>
        )}

        {/* Footer nav */}
        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-chart-200/70 bg-cream-50/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="btn-outline px-4 py-3.5"
              aria-label={t("creator.nav.previous")}
            >
              <ChevronLeft size={20} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
            </button>
          )}
          {stepKey === "launch" ? (
            <button
              type="button"
              onClick={isEdit ? () => save("active").then((id) => id && router.push(`/t/${id}`)) : launch}
              disabled={saving}
              className="btn-accent flex-1 py-3.5 text-lg"
            >
              {saving
                ? t("common.saving")
                : isEdit
                  ? t("creator.launch.saveChanges")
                  : t("creator.launch.create")}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={saving}
              className="btn-primary flex-1 py-3.5 text-lg"
            >
              {saving
                ? t("common.saving")
                : stepKey === "bookings"
                  ? t("common.continue")
                  : t("common.next")}
              <ChevronRight size={20} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
            </button>
          )}
        </div>
      </div>
    </ProductShell>
  );
}
