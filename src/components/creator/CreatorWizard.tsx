"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PartyPopper,
  Plane,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { InviteLinks } from "@/components/product/InviteLinks";
import { Glyph, STROKE } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale, useT, type TKey } from "@/i18n";
import { apiFetch, auth, db } from "@/lib/firebase/client";
import { useMyTrips } from "@/lib/my-trips";
import { stopsOf, type TripDoc } from "@/lib/trip-doc";
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
async function loadTripState(tripId: string): Promise<CreatorState | null> {
  const snapshot = await getDoc(doc(db(), `trips/${tripId}`));
  const data = snapshot.data() as TripDoc | undefined;
  if (!data?.destination) return null;
  const families = await getDocs(
    query(collection(db(), `trips/${tripId}/families`), orderBy("order"))
  );
  const uid = auth().currentUser?.uid;
  const me = uid ? (await getDoc(doc(db(), `trips/${tripId}/members/${uid}`))).data() : undefined;
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
    families: families.docs.map((f) => ({
      id: f.id,
      name: String(f.data().name ?? ""),
      members: ((f.data().members ?? []) as { id: string; name: string; kid?: boolean; age?: number }[]).map(
        (m) => ({ id: m.id, name: m.name, kid: Boolean(m.kid), age: m.age ?? null })
      ),
    })),
    me: me?.familyId && me?.memberId ? { familyId: me.familyId, memberId: me.memberId } : null,
    ai: {
      name: data.ai.name,
      emoji: data.ai.emoji,
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
  const { dir } = useLocale();
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
      const payload = toTripInput(state, status);
      const response = state.tripId
        ? await apiFetch(`/api/trips/${state.tripId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiFetch("/api/trips", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          body.error === "trip_limit"
            ? t("creator.errors.tripLimit")
            : t("creator.errors.saveFailed")
        );
        return null;
      }
      const tripId: string = state.tripId ?? body.tripId;
      if (!state.tripId) {
        writeLocalDraft(null);
        // New owner claim → storage uploads (booking import) work right away
        await auth().currentUser?.getIdToken(true).catch(() => undefined);
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
    apiFetch("/api/ai/trip-assist", {
      method: "POST",
      body: JSON.stringify({ action: "summary", tripId }),
    })
      .then((r) => r.json())
      .then((body) => setSummary(body.summary ?? ""))
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
          <Plane size={28} strokeWidth={STROKE} aria-hidden className="mx-auto text-sea-700" />
          <h1 className="mt-4 font-display text-2xl font-light text-ink-900">
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

  if (launched && state.tripId) {
    return (
      <ProductShell>
        <div className="space-y-6">
          <div className="text-center">
            <PartyPopper size={32} strokeWidth={STROKE} aria-hidden className="mx-auto text-lemon-500" />
            <h1 className="mt-4 font-display text-3xl font-light text-ink-900">
              {t("creator.launched.title", { name: state.name })}
            </h1>
            <p className="mt-2 text-ink-500">{t("creator.launched.text")}</p>
          </div>
          {summary ? (
            <div className="card px-5 py-5">
              <p className="flex items-center gap-2 text-sm font-medium text-ink-700">
                <Glyph value={state.ai.emoji} size={16} className="shrink-0 text-lemon-500" />
                {state.ai.name}
              </p>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-ink-900">{summary}</p>
            </div>
          ) : summary === null ? (
            <Skeleton className="h-24 w-full rounded-3xl" />
          ) : null}
          <InviteLinks
            tripId={state.tripId}
            tripName={state.name}
            emoji={state.emoji}
            families={state.families.map((f) => ({ id: f.id, name: f.name }))}
          />
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
      <div className="space-y-6">
        {/* Progress */}
        <nav aria-label={t("creator.steps.label")} className="flex items-center gap-1.5">
          {STEPS.map((s, index) => (
            <button
              key={s.key}
              type="button"
              disabled={index > step && !state.tripId}
              onClick={() => {
                if (index <= step || state.tripId) setStep(index);
              }}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <span
                className={`h-0.5 w-full rounded-full transition ${index <= step ? "bg-sea-700" : "bg-cream-200"}`}
              />
              <span
                className={`text-[11px] font-medium ${index === step ? "text-sea-700" : "text-ink-300"}`}
              >
                {t(s.label)}
              </span>
            </button>
          ))}
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
              <h1 className="font-display text-3xl font-light text-ink-900">
                {t("creator.bookings.title")}
              </h1>
              <p className="mt-2 text-ink-500">{t("creator.bookings.text")}</p>
            </header>
            <BookingImporter
              tripId={state.tripId}
              onApplied={(result) => {
                if (result.homeBase) {
                  // Reflect the new home base so later saves don't clear it
                  getDoc(doc(db(), `trips/${state.tripId}`)).then((snap) =>
                    update({ homeBase: (snap.data() as TripDoc | undefined)?.homeBase ?? null })
                  );
                }
              }}
            />
          </div>
        )}
        {stepKey === "ai" && <StepAi state={state} update={update} />}
        {stepKey === "launch" && (
          <div className="space-y-6">
            <header>
              <h1 className="font-display text-3xl font-light text-ink-900">
                {isEdit ? t("creator.launch.editTitle") : t("creator.launch.title")}
              </h1>
              <p className="mt-2 text-ink-500">
                {isEdit ? t("creator.launch.editText") : t("creator.launch.text")}
              </p>
            </header>
            <div className="card overflow-hidden">
              <div className="relative h-36 bg-sea-900">
                {primaryPlace(state)?.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={primaryPlace(state)!.coverImage!} alt="" className="h-full w-full object-cover" />
                )}
                <div className="hero-overlay absolute inset-0" />
                <p className="absolute inset-x-4 bottom-3 flex items-center gap-2 font-display text-2xl font-light text-cream-50">
                  <Glyph value={state.emoji} size={20} className="shrink-0 opacity-80" />
                  <span className="truncate">{state.name}</span>
                </p>
              </div>
              <dl className="divide-y divide-cream-200/70 text-sm">
                {(
                  [
                    [
                      MapPin,
                      state.stops.length > 1 ? t("creator.launch.route") : t("creator.launch.destination"),
                      state.stops
                        .map((s) => s.place?.label ?? "")
                        .filter(Boolean)
                        .join(routeArrow),
                    ],
                    [CalendarDays, t("creator.launch.dates"), `${tripStart(state)} – ${tripEnd(state)}`],
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
                  ] as [LucideIcon | null, string, string][]
                ).map(([Icon, label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
                    <dt className="flex items-center gap-2 text-ink-500">
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
          <p role="alert" className="text-center text-sm font-medium text-terra-600">
            {error}
          </p>
        )}

        {/* Footer nav */}
        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-cream-200/70 bg-cream-50/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="btn-soft px-4 py-3.5"
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
