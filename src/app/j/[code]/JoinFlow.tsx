"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProductShell } from "@/components/product/ProductShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch, auth, signInAsGuest } from "@/lib/firebase/client";
import type { InvitePreview } from "@/lib/trip-doc";
import { useAuthUser } from "@/lib/use-auth-user";

type Preview = InvitePreview & {
  role: "admin" | "member" | "kid";
  familyId: string | null;
  families: {
    id: string;
    name: string;
    members: { id: string; name: string; kid: boolean }[];
  }[];
  aiName: string;
  aiEmoji: string;
};

const ERRORS: Record<string, string> = {
  not_found: "הקישור לא קיים — בדקו שהעתקתם אותו במלואו",
  expired: "תוקף הקישור פג — בקשו מהמארגנים קישור חדש",
  used_up: "הקישור כבר נוצל עד הסוף — בקשו קישור חדש",
  revoked: "הקישור בוטל על ידי המארגנים",
  trip_closed: "הטיול הזה כבר נסגר",
};

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

export function JoinFlow({ code }: { code: string }) {
  const router = useRouter();
  const { user, personal, loading } = useAuthUser();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/preview?code=${encodeURIComponent(code)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "not_found");
        setPreview(body);
        setFamilyId(body.familyId);
      })
      .catch((err: Error) => setError(ERRORS[err.message] ?? ERRORS.not_found));
  }, [code]);

  const isKidInvite = preview?.role === "kid";
  const [asGuest, setAsGuest] = useState(false);
  // Anyone already signed in (account or a guest identity) picks a name next
  const canPick = isKidInvite || personal || asGuest || Boolean(user?.isAnonymous);

  async function join(memberFamilyId: string | null, memberId: string | null) {
    if (!preview || joining) return;
    setJoining(true);
    setError("");
    try {
      if ((isKidInvite || asGuest) && !auth().currentUser) await signInAsGuest();
      const response = await apiFetch("/api/invites/redeem", {
        method: "POST",
        body: JSON.stringify({ code, familyId: memberFamilyId, memberId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          body.error === "trip_full"
            ? "הטיול מלא — פנו למארגנים"
            : body.error === "sign_in_required"
              ? "צריך להתחבר עם Google או Apple"
              : (ERRORS[body.error] ?? "ההצטרפות נכשלה — נסו שוב")
        );
        return;
      }
      // Fresh token carries the trip's storage claim
      await auth().currentUser?.getIdToken(true).catch(() => undefined);
      router.replace(`/t/${body.tripId}`);
    } catch {
      setError("ההצטרפות נכשלה — בדקו את החיבור ונסו שוב");
    } finally {
      setJoining(false);
    }
  }

  if (error && !preview) {
    return (
      <ProductShell>
        <div className="card px-6 py-10 text-center">
          <p className="text-4xl" aria-hidden>
            🔗
          </p>
          <p className="mt-3 font-display text-xl font-medium text-ink-900">{error}</p>
          <Link href="/trips" className="btn-soft mt-6 px-5 py-3">
            לטיולים שלי
          </Link>
        </div>
      </ProductShell>
    );
  }

  if (!preview || loading) {
    return (
      <ProductShell>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </ProductShell>
    );
  }

  const families = familyId
    ? preview.families.filter((f) => f.id === familyId)
    : preview.families;
  // Kid links show the kids — unless the organizer didn't mark anyone as a kid
  const kidsOnly =
    isKidInvite && preview.families.some((f) => f.members.some((m) => m.kid));

  return (
    <ProductShell>
      <div className="space-y-6">
        <section className="card overflow-hidden">
          <div className="relative h-44 bg-gradient-to-br from-sea-900 via-sea-700 to-sea-500">
            {preview.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden className="absolute inset-0 flex items-center justify-center text-7xl">
                {preview.emoji}
              </span>
            )}
            <div className="hero-overlay absolute inset-0" />
            <div className="absolute inset-x-5 bottom-4">
              <p className="kicker text-lemon-300">הוזמנתם לטיול</p>
              <h1 className="font-display text-3xl font-normal text-cream-50">
                {preview.emoji} {preview.name}
              </h1>
            </div>
          </div>
          <div className="space-y-1 px-5 py-4 text-sm text-ink-700">
            <p>
              📍 {preview.destination} · {shortDate(preview.startDate)}–{shortDate(preview.endDate)}
            </p>
            {preview.organizer && <p>🧑‍✈️ מארגנים: {preview.organizer}</p>}
            <p>
              {preview.aiEmoji} {preview.aiName} — עוזר ה-AI של הטיול כבר מחכה
            </p>
            {preview.memberCount > 1 && (
              <p>👥 {preview.memberCount} כבר בפנים</p>
            )}
          </div>
        </section>

        {!canPick ? (
          <section className="card space-y-4 px-5 py-6 text-center">
            <h2 className="font-display text-xl font-medium text-ink-900">
              התחברו כדי להצטרף
            </h2>
            <p className="text-sm text-ink-500">
              חשבון אחד לכל הטיולים — בלי סיסמאות
            </p>
            <SignInPanel />
            <div className="flex items-center gap-3 text-xs text-ink-300">
              <span className="h-px flex-1 bg-cream-200" />
              או
              <span className="h-px flex-1 bg-cream-200" />
            </div>
            <button
              type="button"
              onClick={() => setAsGuest(true)}
              className="btn-soft w-full py-3.5 text-base"
            >
              המשך בלי חשבון 👋
            </button>
            <p className="text-xs leading-relaxed text-ink-500">
              בלי Gmail? אין בעיה — בוחרים שם ונכנסים. הגישה נשמרת בטלפון הזה,
              ואפשר לחבר חשבון בהמשך מתוך ההגדרות.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-ink-900">
              {kidsOnly ? "מי אתם? 👋" : "מי אתם מהחבורה? 👋"}
            </h2>
            {families.length > 1 && (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {families.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => setFamilyId(family.id)}
                    className={`chip ${familyId === family.id ? "chip-active" : ""}`}
                  >
                    {family.name}
                  </button>
                ))}
              </div>
            )}
            {families.length === 1 || familyId ? (
              <div className="flex flex-wrap gap-2">
                {(preview.families.find((f) => f.id === (familyId ?? families[0].id))?.members ?? [])
                  .filter((m) => (kidsOnly ? m.kid : true))
                  .map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={joining}
                      onClick={() => join(familyId ?? families[0].id, member.id)}
                      className="rounded-2xl bg-sea-700 px-5 py-3 text-base font-semibold text-cream-50 transition active:scale-[0.97] disabled:opacity-50"
                    >
                      {member.name}
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">בחרו משפחה ואז את השם שלכם</p>
            )}
            {!kidsOnly && (
              <button
                type="button"
                disabled={joining}
                onClick={() => join(familyId, null)}
                className="w-full pt-2 text-center text-sm font-medium text-sea-700 underline"
              >
                {joining ? "מצטרפים…" : "אני לא ברשימה — להצטרף בכל זאת"}
              </button>
            )}
            {user && personal && (
              <p className="text-center text-xs text-ink-500">
                מחוברים כ-{user.displayName || user.email}
              </p>
            )}
            {!personal && !isKidInvite && (
              <p className="text-center text-xs text-ink-500">
                נכנסים כאורח — הגישה נשמרת בטלפון הזה
              </p>
            )}
          </section>
        )}
        {error && (
          <p role="alert" className="text-center text-sm font-medium text-terra-600">
            {error}
          </p>
        )}
      </div>
    </ProductShell>
  );
}
