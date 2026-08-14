"use client";

import { useState } from "react";
import Image from "next/image";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { auth, db, signInWithGoogle } from "@/lib/firebase/client";
import { useFamilies } from "@/lib/hooks";
import { googleMapsUrl } from "@/lib/nav";
import { TRIP, TRIP_PATH, formatDayLabel, tripDays } from "@/lib/trip";

export default function SettingsPage() {
  const { user, personal, profile } = useFirebase();
  const { families } = useFamilies();
  const [pickingFamilyId, setPickingFamilyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const linkedFamily = families?.find((f) => f.id === profile?.familyId);
  const linkedMember = linkedFamily?.members.find(
    (m) => m.id === profile?.memberId
  );

  async function handleGoogleSignIn() {
    setMessage("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      setMessage("ההתחברות לא הושלמה — ודאו שחלונות קופצים מותרים ונסו שוב");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut(auth());
      // FirebaseProvider falls back to the shared trip identity automatically
    } finally {
      setBusy(false);
    }
  }

  async function linkMember(familyId: string, memberId: string) {
    if (!user) return;
    setMessage("");
    try {
      await setDoc(
        doc(db(), `${TRIP_PATH}/users/${user.uid}`),
        {
          displayName: user.displayName ?? "",
          email: user.email ?? "",
          photoURL: user.photoURL ?? "",
          familyId,
          memberId,
          createdAt: Date.now(),
        },
        { merge: true }
      );
      setPickingFamilyId(null);
    } catch {
      setMessage("השמירה נכשלה, נסו שוב");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink-900">
        ⚙️ הגדרות
      </h1>

      {/* Personal identity */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">
          החשבון שלי
        </h2>
        {!personal ? (
          <div className="rounded-3xl border border-sea-200 bg-sea-100/50 p-5 text-center">
            <p className="text-lg font-semibold text-ink-900">
              אתם מחוברים עם סיסמת הטיול המשותפת
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
              התחברות עם Google פותחת: שיחות AI פרטיות עם היסטוריה, אזור
              מסמכים אישי, ושם אמיתי על אירועים שאתם יוצרים
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="mt-4 rounded-2xl bg-sea-600 px-5 py-3 font-semibold text-cream-50 transition active:scale-[0.98] disabled:opacity-50"
            >
              התחברות עם Google
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-cream-200 bg-white p-4">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt=""
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sea-100 text-xl">
                  👤
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-900">
                  {user?.displayName}
                </p>
                <p className="truncate text-sm text-ink-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="rounded-xl bg-cream-100 px-3.5 py-2 text-sm font-medium text-ink-700"
              >
                התנתקות
              </button>
            </div>

            {/* Family member link */}
            <div className="mt-4 border-t border-cream-200 pt-4">
              <p className="mb-2 text-sm font-medium text-ink-700">
                {linkedMember
                  ? `מקושר ל: ${linkedMember.name} · ${linkedFamily?.name}`
                  : "מי אתם מבין המטיילים?"}
              </p>
              {!families ? (
                <ListSkeleton rows={1} />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {families.map((family) => (
                      <button
                        key={family.id}
                        type="button"
                        onClick={() =>
                          setPickingFamilyId(
                            pickingFamilyId === family.id ? null : family.id
                          )
                        }
                        className={`rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
                          pickingFamilyId === family.id
                            ? "bg-sea-600 text-cream-50"
                            : profile?.familyId === family.id
                              ? "bg-sea-100 text-sea-700"
                              : "bg-cream-100 text-ink-700"
                        }`}
                      >
                        {family.name}
                      </button>
                    ))}
                  </div>
                  {pickingFamilyId && (
                    <div className="flex flex-wrap gap-2 rounded-2xl bg-cream-100 p-3">
                      {families
                        .find((f) => f.id === pickingFamilyId)
                        ?.members.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() =>
                              linkMember(pickingFamilyId, member.id)
                            }
                            className={`rounded-full px-3.5 py-2 text-sm transition ${
                              profile?.memberId === member.id
                                ? "bg-sea-600 font-medium text-cream-50"
                                : "bg-white text-ink-700"
                            }`}
                          >
                            {member.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {message && (
          <p
            role="alert"
            className="mt-2 rounded-2xl bg-terra-100 px-4 py-2.5 text-sm font-medium text-terra-600"
          >
            {message}
          </p>
        )}
      </section>

      {/* Trip info */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">
          הטיול
        </h2>
        <div className="divide-y divide-cream-200 rounded-3xl border border-cream-200 bg-white">
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-ink-500">📅 תאריכים</p>
            <p className="mt-0.5 text-ink-900">
              {formatDayLabel(TRIP.startDate)} — {formatDayLabel(TRIP.endDate)}{" "}
              · {tripDays().length} ימים
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-ink-500">🏡 הוילה</p>
            <p className="mt-0.5 text-ink-900">{TRIP.villa.name}</p>
            <a
              href={googleMapsUrl({
                name: TRIP.villa.name,
                address: TRIP.villa.address,
                lat: TRIP.villa.lat,
                lng: TRIP.villa.lng,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block text-sm text-sea-600"
            >
              {TRIP.villa.address} ›
            </a>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-ink-500">💶 מטבע</p>
            <p className="mt-0.5 text-ink-900">אירו (EUR)</p>
          </div>
        </div>
      </section>

      {/* App */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">
          האפליקציה
        </h2>
        <div className="rounded-3xl border border-cream-200 bg-white px-4 py-3 text-sm leading-relaxed text-ink-500">
          <p>
            📲 להתקנה על מסך הבית: פתחו את האתר בספארי/כרום → שיתוף → ״הוסף
            למסך הבית״
          </p>
          <p className="mt-1">🍋 סיציליה 2026 · גרסת טיול ראשונה</p>
        </div>
      </section>
    </div>
  );
}
