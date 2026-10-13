"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { InviteLinks, inviteUrl } from "@/components/product/InviteLinks";
import { apiFetch } from "@/lib/firebase/client";
import { useCollectionData, useDocData, useFamilies } from "@/lib/hooks";
import type { TripMember } from "@/lib/trip-doc";

const ROLE_LABEL: Record<string, string> = {
  owner: "מארגן/ת",
  admin: "מנהל/ת",
  member: "",
  kid: "ילד/ה",
};

/** Self-serve trips: organizer tools + kid-device pairing + leave trip. */
export function TripAdminSection() {
  const trip = useTrip();
  const { user } = useFirebase();
  const { families } = useFamilies();
  const { data: me } = useDocData<TripMember>(
    `${trip.path}/members/${user?.uid ?? "_"}`
  );
  const { data: members } = useCollectionData<TripMember & { id: string }>(
    `${trip.path}/members`
  );
  const [kidLink, setKidLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (trip.legacy || !user || !me) return null;
  const isAdmin = me.role === "owner" || me.role === "admin";
  const isKid = me.role === "kid";

  async function pairKid() {
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch(`/api/trips/${trip.id}/invites`, {
        method: "POST",
        body: JSON.stringify({ role: "kid" }),
      });
      if (!response.ok) throw new Error();
      const { code } = await response.json();
      setKidLink(inviteUrl(code));
    } catch {
      setMessage("לא הצלחנו ליצור קישור — נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(uid: string, name: string) {
    if (!confirm(`להסיר את ${name || "המשתתף"} מהטיול?`)) return;
    await apiFetch(`/api/trips/${trip.id}?member=${uid}`, { method: "DELETE" });
  }

  async function leave() {
    if (!confirm("לצאת מהטיול? תוכלו לחזור רק עם קישור הזמנה חדש")) return;
    const response = await apiFetch(`/api/trips/${trip.id}?member=self`, {
      method: "DELETE",
    });
    if (response.ok) window.location.replace("/trips");
    else setMessage("מארגן/ת הטיול לא יכול/ה לצאת — אפשר לארכב את הטיול");
  }

  return (
    <>
      {isAdmin && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-900">
              הזמנת החבורה 📩
            </h2>
            <Link
              href={`/new?trip=${trip.id}`}
              className="chip gap-1.5 text-sea-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              עריכת הטיול
            </Link>
          </div>
          <InviteLinks
            tripId={trip.id}
            tripName={trip.name}
            emoji={trip.emoji}
            families={(families ?? []).map((f) => ({ id: f.id, name: f.name }))}
          />
        </section>
      )}

      {!isKid && (
        <section className="card space-y-3 px-4 py-4">
          <h2 className="font-display text-lg font-bold text-ink-900">
            📱 חיבור הטלפון של הילדים
          </h2>
          <p className="text-sm leading-relaxed text-ink-500">
            בלי אימייל ובלי סיסמה: פותחים את הקישור בטלפון של הילד/ה, בוחרים
            שם — וזהו. הקישור תקף ל-24 שעות.
          </p>
          {kidLink ? (
            <div className="space-y-2">
              <p className="rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink-700" dir="ltr">
                {kidLink}
              </p>
              <button
                type="button"
                className="btn-soft w-full py-2.5 text-sm"
                onClick={() => navigator.clipboard?.writeText(kidLink)}
              >
                העתקת הקישור
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={pairKid}
              className="btn-outline w-full py-2.5 text-sm"
            >
              {busy ? "רגע…" : "יצירת קישור לילדים"}
            </button>
          )}
        </section>
      )}

      {isAdmin && members && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-ink-900">
            מי בטיול ({members.length})
          </h2>
          <ul className="card divide-y divide-cream-200/80 overflow-hidden">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sea-100 text-sm font-bold text-sea-700">
                  {(member.displayName || "?").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                  {member.displayName || "ללא שם"}
                  {ROLE_LABEL[member.role] && (
                    <span className="ms-2 text-xs text-ink-500">
                      {ROLE_LABEL[member.role]}
                    </span>
                  )}
                </span>
                {member.role !== "owner" && member.id !== user.uid && (
                  <button
                    type="button"
                    onClick={() => removeMember(member.id, member.displayName)}
                    className="text-xs font-medium text-terra-600"
                  >
                    הסרה
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {me.role !== "owner" && (
        <button
          type="button"
          onClick={leave}
          className="w-full text-center text-sm font-medium text-terra-600"
        >
          יציאה מהטיול
        </button>
      )}
      {message && <p className="text-center text-sm text-terra-600">{message}</p>}
    </>
  );
}
