"use client";

import { useEffect, useState } from "react";
import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import {
  Baby,
  Heart,
  History,
  Luggage,
  Plus,
  Trash2,
  UserRound,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { convex } from "@/lib/convex";
import type { GroupKind } from "@together/shared/trip-doc";
import type { TripSummary } from "@/lib/my-trips";
import {
  peopleCounts,
  shortId,
  type CreatorFamily,
  type CreatorState,
} from "./state";

const KIND_ORDER: GroupKind[] = ["families", "friends", "couple", "other"];

const KIND_ICON: Record<GroupKind, LucideIcon> = {
  families: Users,
  friends: Wine,
  couple: Heart,
  other: Luggage,
};

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
  const t = useT();
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange({ kid: !member.kid })}
        aria-label={member.kid ? t("creator.who.member.kidToggle") : t("creator.who.member.adultToggle")}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
          member.kid ? "border-route-300 bg-route-100 text-route-700" : "border-chart-200 bg-chart-100 text-ink-700"
        }`}
      >
        {member.kid ? (
          <Baby size={20} strokeWidth={STROKE} aria-hidden />
        ) : (
          <UserRound size={20} strokeWidth={STROKE} aria-hidden />
        )}
      </button>
      <input
        className="field min-h-11 min-w-0 flex-1 px-3 py-2"
        dir="auto"
        placeholder={member.kid ? t("creator.who.member.kidName") : t("creator.who.member.name")}
        value={member.name}
        maxLength={30}
        autoFocus={autoFocus}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      {member.kid && (
        <input
          className="field min-h-11 w-14 px-1 py-2 text-center"
          inputMode="numeric"
          placeholder={t("creator.who.member.age")}
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
        aria-pressed={isMe}
        className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium transition ${
          isMe ? "bg-sea-900 text-cream-50" : "border border-chart-200 text-ink-400"
        }`}
      >
        {t("creator.who.member.me")}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("creator.who.member.remove")}
        className="-ms-1 flex h-11 w-9 shrink-0 items-center justify-center text-ink-300 hover:text-terra-600"
      >
        <Trash2 size={16} strokeWidth={STROKE} aria-hidden />
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
  const t = useT();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [groupNameOpen, setGroupNameOpen] = useState(false);
  const kind = state.groupKind;
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
      const sourceId = tripId as Id<"trips">;
      const [rows, source] = await Promise.all([
        convex.query(api.families.list, { tripId: sourceId }),
        convex.query(api.trips.get, { tripId: sourceId }).then(({ trip }) => ({ doc: trip })),
      ]);
      const families: CreatorFamily[] = rows.map((row) => ({
        id: shortId("f"),
        name: row.name,
        members: row.members.map((m) => ({ id: shortId("m"), name: m.name, kid: Boolean(m.kid), age: m.age ?? null })),
      }));
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
                  // uploaded pictures live with the old trip — only gallery robots carry over
                  avatar: source.doc.ai.avatar?.kind === "bot" ? `bot:${source.doc.ai.avatar.id}` : null,
                  avatarStorageId: null,
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
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-display-sm font-medium text-ink-900">{t("creator.who.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{t("creator.who.text")}</p>
      </header>

      {previousTrips.length > 0 && (
        <section className="flex items-center gap-3 rounded-2xl border border-chart-200 bg-white px-4 py-3">
          <History size={20} strokeWidth={STROKE} aria-hidden className="shrink-0 text-route-500" />
          <p className="min-w-0 flex-1 text-sm text-ink-700">{t("creator.who.sameGroup")}</p>
          <select
            className="field min-h-11 w-auto max-w-[45%] py-2 text-sm"
            disabled={copying}
            value=""
            onChange={(event) => event.target.value && copyFrom(event.target.value)}
          >
            <option value="">{copying ? t("creator.who.copying") : t("creator.who.copyFrom")}</option>
            {previousTrips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-sm font-medium text-ink-700">{t("creator.who.kindLabel")}</p>
        <div className="grid grid-cols-4 gap-2">
          {KIND_ORDER.map((key) => {
            const Icon = KIND_ICON[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={state.groupKind === key}
                onClick={() => update({ groupKind: key })}
                className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-sm font-medium transition ${
                  state.groupKind === key
                    ? "border-sea-900 bg-sea-900 text-cream-50"
                    : "border-chart-200 bg-white text-ink-700"
                }`}
              >
                <Icon size={20} strokeWidth={STROKE} aria-hidden />
                {t(`creator.who.kinds.${key}`)}
              </button>
            );
          })}
        </div>
      </section>

      {groupNameOpen || state.groupName ? (
        <section className="space-y-2">
          <label className="text-sm font-medium text-ink-700" htmlFor="group-name">
            {t("creator.who.groupName")}{" "}
            <span className="font-normal text-ink-400">{t("creator.who.optional")}</span>
          </label>
          <input
            id="group-name"
            className="field"
            dir="auto"
            autoFocus={groupNameOpen && !state.groupName}
            placeholder={
              singles ? t("creator.who.groupPlaceholderSingles") : t("creator.who.groupPlaceholder")
            }
            value={state.groupName}
            maxLength={40}
            onChange={(event) => update({ groupName: event.target.value })}
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setGroupNameOpen(true)}
          className="-mt-3 flex min-h-11 items-center gap-1.5 text-sm font-medium text-route-700"
        >
          <Plus size={16} strokeWidth={STROKE} aria-hidden />
          {t("creator.wizard.addGroupName")}
        </button>
      )}

      {singles ? (
        <section className="space-y-3">
          <p className="text-sm font-medium text-ink-700">{t("creator.who.participants")}</p>
          <ul className="space-y-2.5 rounded-2xl bg-white px-3 py-3 shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]">
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
          <button type="button" onClick={addFamily} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cream-300 text-sm font-medium text-ink-700 transition hover:bg-white">
            <Plus size={16} strokeWidth={STROKE} aria-hidden /> {t("creator.who.addParticipant")}
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          {state.families.map((family, index) => (
            <div key={family.id} className="space-y-3 rounded-2xl bg-white px-3 pb-2 pt-3 shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]">
              <div className="flex items-center gap-2 border-b border-chart-200 pb-3">
                <span
                  aria-hidden
                  className={`ms-1 h-3 w-3 shrink-0 rounded-full ${["bg-route-500", "bg-sea-500", "bg-olive-500", "bg-sea-300"][index % 4]}`}
                />
                <input
                  className="min-h-11 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-lg font-medium text-ink-900 outline-none placeholder:font-normal placeholder:text-ink-300 focus:bg-chart-50"
                  dir="auto"
                  placeholder={t(`creator.who.units.${kind}.placeholder`)}
                  value={family.name}
                  maxLength={40}
                  onChange={(event) => updateFamily(family.id, { name: event.target.value })}
                />
              </div>
              <ul className="space-y-2.5">
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
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => addMember(family.id, false)}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-route-700 hover:bg-chart-50"
                >
                  <Plus size={14} strokeWidth={STROKE} aria-hidden />
                  {t("creator.who.adult")}
                </button>
                <button
                  type="button"
                  onClick={() => addMember(family.id, true)}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-route-700 hover:bg-chart-50"
                >
                  <Plus size={14} strokeWidth={STROKE} aria-hidden />
                  {t("creator.who.kid")}
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addFamily} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cream-300 text-sm font-medium text-ink-700 transition hover:bg-white">
            <Plus size={16} strokeWidth={STROKE} aria-hidden /> {t(`creator.who.units.${kind}.add`)}
          </button>
        </section>
      )}

      <p className="text-center text-sm font-medium text-ink-700">
        {[
          t("creator.who.summaryPeople", { count: people }),
          ...(kids ? [t("creator.who.summaryKids", { count: kids })] : []),
          t(`creator.who.units.${kind}.count`, { count: state.families.length }),
        ].join(" · ")}
      </p>
    </div>
  );
}
