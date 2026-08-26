"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { useTrip } from "@/components/providers/TripProvider";
import { db, isPersonalUser } from "@/lib/firebase/client";
import { useFamilies } from "@/lib/hooks";

/**
 * First-login nudge: a Google user who hasn't linked themselves to a
 * group member gets a one-tap picker. Reappears on the next visit until
 * they choose; name-pick logins are already linked and never see it.
 */
export function IdentityPrompt() {
  const { ready, user, profile } = useFirebase();
  const trip = useTrip();
  const { families } = useFamilies();
  const [dismissed, setDismissed] = useState(false);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const show =
    !dismissed &&
    ready &&
    Boolean(user) &&
    isPersonalUser(user) &&
    Boolean(profile) &&
    !profile?.memberId &&
    Boolean(families?.length);

  if (!show) return null;

  async function link(familyId: string, memberId: string) {
    if (!user || saving) return;
    setSaving(true);
    setError("");
    try {
      await setDoc(
        doc(db(), `${trip.path}/users/${user.uid}`),
        { familyId, memberId },
        { merge: true }
      );
      // profile snapshot updates → memberId set → the sheet closes itself
    } catch {
      setError("השמירה נכשלה, נסו שוב");
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={() => setDismissed(true)}
      title="מי אתם מהחבורה? 👋"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-500">
          בחרו את השם שלכם — ככה הצבעות, הוצאות והוספות ללוח יירשמו על
          שמכם. לוקח שנייה, עושים פעם אחת.
        </p>
        <div className="flex flex-wrap gap-2">
          {families!.map((family) =>
            family.members.length === 1 ? (
              <button
                key={family.id}
                type="button"
                disabled={saving}
                onClick={() => link(family.id, family.members[0].id)}
                className="rounded-2xl bg-sea-600 px-5 py-3 text-base font-semibold text-cream-50 transition active:scale-[0.97] disabled:opacity-50"
              >
                {saving ? "…" : family.members[0].name}
              </button>
            ) : (
              <button
                key={family.id}
                type="button"
                onClick={() =>
                  setExpandedFamilyId(
                    expandedFamilyId === family.id ? null : family.id
                  )
                }
                className={`rounded-2xl px-5 py-3 text-base font-semibold transition active:scale-[0.97] ${
                  expandedFamilyId === family.id
                    ? "bg-sea-600 text-cream-50"
                    : "bg-cream-100 text-ink-700"
                }`}
              >
                {family.name}
              </button>
            )
          )}
        </div>
        {expandedFamilyId && (
          <div className="flex flex-wrap gap-2 rounded-2xl bg-cream-100 p-3">
            {families!
              .find((f) => f.id === expandedFamilyId)
              ?.members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  disabled={saving}
                  onClick={() => link(expandedFamilyId, member.id)}
                  className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition active:scale-[0.97] disabled:opacity-50"
                >
                  {saving ? "…" : member.name}
                </button>
              ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-terra-600">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="w-full text-center text-sm text-ink-500"
        >
          אחר כך
        </button>
      </div>
    </BottomSheet>
  );
}
