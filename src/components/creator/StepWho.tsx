"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Baby, History, Plus, Trash2, UserRound } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { GROUP_KINDS, type GroupKind } from "@/lib/trip-doc";
import type { TripSummary } from "@/lib/my-trips";
import {
  peopleCounts,
  shortId,
  type CreatorFamily,
  type CreatorState,
} from "./state";

const KIND_ORDER: GroupKind[] = ["families", "friends", "couple", "other"];

function MemberRow({
  member,
  isMe,
  onChange,
  onRemove,
  onMakeMe,
  autoFocus,
}: {
  member: CreatorFamily["members"][number];
  isMe: boolean;
  onChange: (patch: Partial<CreatorFamily["members"][number]>) => void;
  onRemove: () => void;
  onMakeMe: () => void;
  autoFocus?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange({ kid: !member.kid })}
        aria-label={member.kid ? "ילד/ה — לחצו לשינוי למבוגר" : "מבוגר — לחצו לשינוי לילד/ה"}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
          member.kid ? "bg-lemon-100 text-terra-600" : "bg-sea-100 text-sea-700"
        }`}
      >
        {member.kid ? <Baby className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
      </button>
      <input
        className="field min-w-0 flex-1 py-2.5"
        placeholder={member.kid ? "שם הילד/ה" : "שם"}
        value={member.name}
        maxLength={30}
        autoFocus={autoFocus}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      {member.kid && (
        <input
          className="field w-16 px-2 py-2.5 text-center"
          inputMode="numeric"
          placeholder="גיל"
          value={member.age ?? ""}
          onChange={(event) => {
            const age = Number.parseInt(event.target.value, 10);
            onChange({ age: Number.isFinite(age) ? Math.min(age, 25) : null });
          }}
        />
      )}
      <button
        type="button"
        onClick={onMakeMe}
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold transition ${
          isMe ? "bg-terra-500 text-cream-50" : "bg-cream-100 text-ink-300"
        }`}
      >
        אני
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="הסרה"
        className="shrink-0 p-1.5 text-ink-300 hover:text-terra-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export function StepWho({
  state,
  update,
  previousTrips,
}: {
  state: CreatorState;
  update: (patch: Partial<CreatorState>) => void;
  previousTrips: TripSummary[];
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const kind = GROUP_KINDS[state.groupKind];
  const singles = state.groupKind === "friends" || state.groupKind === "couple";
  const { people, kids } = peopleCounts(state);

  useEffect(() => {
    if (focusId) {
      const timer = setTimeout(() => setFocusId(null), 300);
      return () => clearTimeout(timer);
    }
  }, [focusId]);

  function setFamilies(families: CreatorFamily[]) {
    update({ families });
  }

  function updateFamily(id: string, patch: Partial<CreatorFamily>) {
    setFamilies(state.families.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addFamily() {
    const id = shortId("f");
    const memberId = shortId("m");
    setFocusId(memberId);
    setFamilies([
      ...state.families,
      {
        id,
        name: singles ? "" : "",
        members: [{ id: memberId, name: "", kid: false, age: null }],
      },
    ]);
  }

  function addMember(familyId: string, kid: boolean) {
    const memberId = shortId("m");
    setFocusId(memberId);
    setFamilies(
      state.families.map((f) =>
        f.id === familyId
          ? { ...f, members: [...f.members, { id: memberId, name: "", kid, age: null }] }
          : f
      )
    );
  }

  function removeMember(familyId: string, memberId: string) {
    const families = state.families
      .map((f) =>
        f.id === familyId ? { ...f, members: f.members.filter((m) => m.id !== memberId) } : f
      )
      .filter((f) => f.members.length > 0);
    update({
      families,
      ...(state.me?.memberId === memberId ? { me: null } : {}),
    });
  }

  async function copyFrom(tripId: string) {
    setCopying(true);
    try {
      const snapshot = await getDocs(
        query(collection(db(), `trips/${tripId}/families`), orderBy("order"))
      );
      const families: CreatorFamily[] = snapshot.docs.map((doc) => ({
        id: shortId("f"),
        name: String(doc.data().name ?? ""),
        members: ((doc.data().members ?? []) as { name: string; kid?: boolean; age?: number }[]).map(
          (m) => ({ id: shortId("m"), name: m.name, kid: Boolean(m.kid), age: m.age ?? null })
        ),
      }));
      const source = previousTrips.find((t) => t.id === tripId);
      if (families.length) {
        update({
          families,
          me: null,
          ...(source?.doc
            ? {
                groupKind: source.doc.groupKind,
                groupName: source.doc.groupName,
                aboutUs: source.doc.aboutUs ?? state.aboutUs,
                ai: {
                  name: source.doc.ai.name,
                  emoji: source.doc.ai.emoji,
                  preset: source.doc.ai.preset,
                  rules: source.doc.ai.rules,
                  customRules: source.doc.ai.customRules,
                },
              }
            : {}),
        });
      }
    } finally {
      setCopying(false);
    }
  }

  // Friends/couple: flat list of people (each person is their own unit)
  const flatMembers = state.families.flatMap((f) =>
    f.members.map((m) => ({ family: f, member: m }))
  );

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-900">מי בא? 👨‍👩‍👧‍👦</h1>
        <p className="mt-1 text-ink-500">
          השמות מאפשרים לכל אחד לבחור את עצמו כשמצטרפים — ולעוזר ה-AI להכיר אתכם
        </p>
      </header>

      {previousTrips.length > 0 && (
        <section className="card flex items-center gap-3 bg-sea-100/40 px-4 py-3">
          <History className="h-5 w-5 shrink-0 text-sea-700" />
          <p className="min-w-0 flex-1 text-sm text-ink-700">אותה חבורה כמו פעם?</p>
          <select
            className="field w-auto max-w-[45%] py-2 text-sm"
            disabled={copying}
            value=""
            onChange={(event) => event.target.value && copyFrom(event.target.value)}
          >
            <option value="">{copying ? "מעתיקים…" : "העתקה מטיול קודם"}</option>
            {previousTrips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.emoji} {trip.name}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink-700">מה סוג החבורה?</p>
        <div className="grid grid-cols-4 gap-2">
          {KIND_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ groupKind: key })}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-sm font-semibold transition ${
                state.groupKind === key
                  ? "bg-sea-700 text-cream-50 shadow-md"
                  : "bg-cream-100 text-ink-700"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {GROUP_KINDS[key].emoji}
              </span>
              {GROUP_KINDS[key].label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <label className="text-sm font-semibold text-ink-700" htmlFor="group-name">
          שם החבורה <span className="font-normal text-ink-300">(לא חובה)</span>
        </label>
        <input
          id="group-name"
          className="field"
          placeholder={singles ? "החבר׳ה מהצבא" : "חבורת מיחא"}
          value={state.groupName}
          maxLength={40}
          onChange={(event) => update({ groupName: event.target.value })}
        />
      </section>

      {singles ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-ink-700">המשתתפים</p>
          <ul className="space-y-2">
            {flatMembers.map(({ family, member }) => (
              <MemberRow
                key={member.id}
                member={member}
                autoFocus={focusId === member.id}
                isMe={state.me?.memberId === member.id}
                onMakeMe={() => update({ me: { familyId: family.id, memberId: member.id } })}
                onRemove={() => removeMember(family.id, member.id)}
                onChange={(patch) =>
                  updateFamily(family.id, {
                    // A single person's unit is named after them
                    ...(patch.name !== undefined && family.members.length === 1
                      ? { name: patch.name }
                      : {}),
                    members: family.members.map((m) =>
                      m.id === member.id ? { ...m, ...patch } : m
                    ),
                  })
                }
              />
            ))}
          </ul>
          <button type="button" onClick={addFamily} className="btn-outline w-full py-3">
            <Plus className="h-4 w-4" /> הוספת משתתף/ת
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          {state.families.map((family, index) => (
            <div key={family.id} className="card space-y-3 px-4 py-4">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`h-3 w-3 shrink-0 rounded-full ${["bg-sea-500", "bg-terra-500", "bg-lemon-500", "bg-olive-500"][index % 4]}`}
                />
                <input
                  className="field flex-1 py-2.5 font-semibold"
                  placeholder={`שם ה${kind.unitSingular} (למשל: משפחת כהן)`}
                  value={family.name}
                  maxLength={40}
                  onChange={(event) => updateFamily(family.id, { name: event.target.value })}
                />
              </div>
              <ul className="space-y-2">
                {family.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    autoFocus={focusId === member.id}
                    isMe={state.me?.memberId === member.id}
                    onMakeMe={() => update({ me: { familyId: family.id, memberId: member.id } })}
                    onRemove={() => removeMember(family.id, member.id)}
                    onChange={(patch) =>
                      updateFamily(family.id, {
                        members: family.members.map((m) =>
                          m.id === member.id ? { ...m, ...patch } : m
                        ),
                      })
                    }
                  />
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addMember(family.id, false)}
                  className="btn-soft flex-1 py-2.5 text-sm"
                >
                  <UserRound className="h-4 w-4" /> מבוגר
                </button>
                <button
                  type="button"
                  onClick={() => addMember(family.id, true)}
                  className="btn-soft flex-1 py-2.5 text-sm"
                >
                  <Baby className="h-4 w-4" /> ילד/ה
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addFamily} className="btn-outline w-full py-3">
            <Plus className="h-4 w-4" /> הוספת {kind.unitSingular}
          </button>
        </section>
      )}

      <p className="text-center text-sm text-ink-500">
        {people} משתתפים{kids ? ` · ${kids} ילדים` : ""} · {state.families.length}{" "}
        {kind.unitLabel === "אנחנו" ? "יחידות" : kind.unitLabel}
      </p>
    </div>
  );
}
