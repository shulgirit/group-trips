"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { InviteLinks } from "@/components/product/InviteLinks";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch, auth, db } from "@/lib/firebase/client";
import { useMyTrips } from "@/lib/my-trips";
import type { TripDoc } from "@/lib/trip-doc";
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
  toTripInput,
  type CreatorState,
} from "./state";

const STEPS = [
  { key: "where", label: "יעד" },
  { key: "who", label: "חבורה" },
  { key: "bookings", label: "הזמנות" },
  { key: "ai", label: "עוזר AI" },
  { key: "launch", label: "יוצאים" },
] as const;

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
    destination: {
      label: data.destination.label,
      placeId: data.destination.placeId ?? "",
      lat: data.destination.lat,
      lng: data.destination.lng,
      region: data.destination.region,
      country: data.destination.country ?? "",
      timezone: data.timezone,
      currency: data.currency,
      coverImage: data.coverImage,
    },
    startDate: data.startDate,
    endDate: data.endDate,
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
            setError("לא מצאנו את הטיול");
            return;
          }
          setState(loaded);
          // Drafts resume where details are still missing
          setStep(loaded.status === "draft" ? 2 : 0);
        })
        .catch(() => setError("אין לכם הרשאה לערוך את הטיול הזה"));
    } else {
      const draft = readLocalDraft();
      setState(draft && !draft.tripId ? draft : initialState(user.displayName));
    }
  }, [authLoading, personal, user, editTripId]);

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
            ? "הגעתם למספר הטיולים הפעילים בחשבון חינמי (5). ארכבו טיול ישן כדי לפתוח חדש."
            : "השמירה נכשלה — בדקו את הפרטים ונסו שוב"
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
      setError("שגיאת רשת — נסו שוב");
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
          <p className="text-4xl" aria-hidden>
            ✈️
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink-900">טיול חדש</h1>
          <p className="mt-2 text-sm text-ink-500">התחברו כדי ליצור טיול ולהזמין את החבורה</p>
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
            <p className="font-semibold text-ink-900">{error}</p>
            <Link href="/trips" className="btn-soft mt-4 px-5 py-3">
              לטיולים שלי
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

  if (launched && state.tripId) {
    return (
      <ProductShell>
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-6xl" aria-hidden>
              🎉
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-ink-900">
              {state.emoji} {state.name} מוכן!
            </h1>
            <p className="mt-2 text-ink-500">עכשיו מזמינים את החבורה — כל אחד בוחר את השם שלו ונכנס</p>
          </div>
          {summary ? (
            <div className="card bg-gradient-to-br from-white to-lemon-100/60 px-5 py-4">
              <p className="text-sm font-semibold text-ink-700">
                {state.ai.emoji} {state.ai.name}:
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
          <Link href={`/t/${state.tripId}`} className="btn-primary w-full py-4 text-lg">
            כניסה לטיול →
          </Link>
        </div>
      </ProductShell>
    );
  }

  return (
    <ProductShell>
      <div className="space-y-6">
        {/* Progress */}
        <nav aria-label="שלבים" className="flex items-center gap-1.5">
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
                className={`h-1.5 w-full rounded-full transition ${index <= step ? "bg-sea-600" : "bg-cream-200"}`}
              />
              <span
                className={`text-[11px] font-semibold ${index === step ? "text-sea-700" : "text-ink-300"}`}
              >
                {s.label}
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
              <h1 className="font-display text-3xl font-bold text-ink-900">הזמנות וכרטיסים 🎟️</h1>
              <p className="mt-1 text-ink-500">
                טיסות, מלון, רכב ואטרקציות שכבר הזמנתם — ה-AI יקרא אותם ויכניס ללו״ז ולמפה.
                אפשר לדלג ולהוסיף אחר כך ממסך המסמכים.
              </p>
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
              <h1 className="font-display text-3xl font-bold text-ink-900">
                {isEdit ? "סיכום ושמירה" : "הכל מוכן? 🚀"}
              </h1>
              <p className="mt-1 text-ink-500">
                {isEdit ? "שמרו את השינויים — כל החבורה תראה אותם מיד" : "יוצרים את הטיול ומזמינים את כולם"}
              </p>
            </header>
            <div className="card overflow-hidden">
              <div className="relative h-36 bg-gradient-to-br from-sea-900 to-sea-500">
                {state.destination?.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.destination.coverImage} alt="" className="h-full w-full object-cover" />
                )}
                <div className="hero-overlay absolute inset-0" />
                <p className="absolute inset-x-4 bottom-3 font-display text-2xl font-bold text-cream-50">
                  {state.emoji} {state.name}
                </p>
              </div>
              <dl className="divide-y divide-cream-200/70 text-sm">
                {[
                  ["📍 יעד", state.destination?.label ?? ""],
                  ["📅 תאריכים", `${state.startDate} → ${state.endDate}`],
                  ["👥 משתתפים", `${people} ב-${state.families.length} ${state.groupKind === "families" ? "משפחות" : "קבוצות"}`],
                  ["✨ עוזר AI", `${state.ai.emoji} ${state.ai.name}`],
                  ["🏡 לינה", state.homeBase?.name ?? "עוד לא הוגדר"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className="truncate font-semibold text-ink-900" dir="auto">
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
        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-cream-200/70 bg-cream-50/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="btn-soft px-4 py-3.5"
              aria-label="הקודם"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {stepKey === "launch" ? (
            <button
              type="button"
              onClick={isEdit ? () => save("active").then((id) => id && router.push(`/t/${id}`)) : launch}
              disabled={saving}
              className="btn-accent flex-1 py-3.5 text-lg"
            >
              {saving ? "שומרים…" : isEdit ? "שמירת השינויים" : "יצירת הטיול 🚀"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={saving}
              className="btn-primary flex-1 py-3.5 text-lg"
            >
              {saving ? "שומרים…" : stepKey === "bookings" ? "המשך" : "הבא"}
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </ProductShell>
  );
}
