"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  deletePoll,
  removePollOption,
  setPollClosed,
  votePoll,
} from "@/lib/db";
import { useFamilies, usePlaces, usePolls } from "@/lib/hooks";
import { PLACE_CATEGORIES, type Family, type Place, type Poll } from "@/types";

function PollCard({
  poll,
  families,
  places,
}: {
  poll: Poll;
  families: Family[];
  places: Place[];
}) {
  const { profile } = useFirebase();
  const [votingAs, setVotingAs] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingOptionId, setRemovingOptionId] = useState<string | null>(null);

  // When you've linked yourself in Settings, you vote as your family in one tap
  const myFamilyId =
    profile?.familyId && families.some((f) => f.id === profile.familyId)
      ? profile.familyId
      : null;
  const voterFamilyId = myFamilyId ?? votingAs;
  const myFamily = families.find((f) => f.id === myFamilyId);
  const myVote = voterFamilyId ? poll.votes?.[voterFamilyId] : undefined;

  const totalVotes = Object.keys(poll.votes ?? {}).length;
  const counts = new Map<string, number>();
  for (const optionId of Object.values(poll.votes ?? {})) {
    counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
  }
  const maxCount = Math.max(0, ...counts.values());
  const winners = poll.options.filter(
    (o) => maxCount > 0 && counts.get(o.id) === maxCount
  );

  async function handleVote(optionId: string) {
    if (!voterFamilyId) return;
    await votePoll(poll.id, voterFamilyId, optionId);
    setVotingAs(null);
  }

  return (
    <div
      className={`card p-4 ${poll.pinned ? "border-lemon-300" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-xl font-bold text-ink-900">
          {poll.question}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            poll.closed
              ? "bg-cream-100 text-ink-500"
              : "bg-lemon-100 text-ink-700"
          }`}
        >
          {poll.closed ? "נסגר" : "פתוח"}
        </span>
      </div>

      {/* Voting state */}
      {!poll.closed &&
        (myFamilyId ? (
          <p className="mt-3 rounded-2xl bg-sea-100 px-3.5 py-2 text-sm text-sea-700">
            {myVote
              ? `✓ הצבעתם בתור ${myFamily?.name} — אפשר לשנות בלחיצה על אפשרות אחרת`
              : `לחצו על אפשרות כדי להצביע בתור ${myFamily?.name}`}
          </p>
        ) : (
          <div className="mt-3 rounded-2xl bg-cream-100 px-3.5 py-2.5">
            <p className="mb-1.5 text-sm font-medium text-ink-700">
              {votingAs
                ? "עכשיו לחצו על האפשרות שבחרתם ⬇️"
                : "1. בחרו את המשפחה שלכם · 2. לחצו על אפשרות"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {families.map((family) => {
                const votedOption = poll.votes?.[family.id];
                return (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() =>
                      setVotingAs(votingAs === family.id ? null : family.id)
                    }
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      votingAs === family.id
                        ? "bg-sea-600 text-cream-50"
                        : votedOption
                          ? "bg-sea-100 text-sea-700"
                          : "bg-white text-ink-700"
                    }`}
                  >
                    {family.name.replace("משפחת ", "")}
                    {votedOption ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
            <Link
              href="/settings"
              className="mt-1.5 block text-xs text-sea-600"
            >
              💡 קשרו את עצמכם למשפחה בהגדרות — ותצביעו בלחיצה אחת ›
            </Link>
          </div>
        ))}

      {/* Options with results */}
      <ul className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const count = counts.get(option.id) ?? 0;
          const percent = totalVotes ? (count / totalVotes) * 100 : 0;
          const isWinner = poll.closed && winners.some((w) => w.id === option.id);
          const place = option.placeId
            ? places.find((p) => p.id === option.placeId)
            : null;
          const isMyVote = !poll.closed && myVote === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={poll.closed || !voterFamilyId}
                onClick={() => handleVote(option.id)}
                className={`relative w-full overflow-hidden rounded-2xl border text-right transition ${
                  isWinner
                    ? "border-lemon-400 bg-lemon-100"
                    : isMyVote
                      ? "border-sea-500 bg-white ring-2 ring-sea-200"
                      : voterFamilyId
                        ? "border-sea-200 bg-white active:bg-sea-100"
                        : "border-cream-200 bg-white"
                } disabled:opacity-100`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 right-0 bg-sea-100/70"
                  style={{ width: `${percent}%` }}
                />
                <span className="relative flex items-center gap-3">
                  <span className="relative h-14 w-16 shrink-0 overflow-hidden">
                    {place?.imageUrl ? (
                      <Image
                        src={place.imageUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center bg-gradient-to-b from-sea-100 to-cream-100 text-xl">
                        {place
                          ? (PLACE_CATEGORIES[place.category]?.emoji ?? "📌")
                          : "💡"}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate py-3 font-medium text-ink-900">
                    {isWinner ? "🏆 " : ""}
                    {isMyVote ? "✓ " : ""}
                    {option.label}
                  </span>
                  <span className="px-4 font-display text-lg font-bold tabular-nums text-sea-700">
                    {count}
                  </span>
                </span>
              </button>
              <span className="mt-0.5 flex items-center gap-3 ps-1 text-xs">
                {option.placeId && (
                  <Link
                    href={`/places/${option.placeId}`}
                    className="text-sea-600"
                  >
                    לפרטי המקום ›
                  </Link>
                )}
                <Link
                  href={`/calendar/new?title=${encodeURIComponent(option.label)}${
                    option.placeId ? `&placeId=${option.placeId}` : ""
                  }`}
                  className="text-terra-500"
                >
                  📅 שבץ בלוח ›
                </Link>
                <span className="flex-1" />
                {!poll.closed &&
                  (removingOptionId === option.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          removePollOption(poll.id, option.id);
                          setRemovingOptionId(null);
                        }}
                        className="font-semibold text-terra-600"
                      >
                        להסיר?
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingOptionId(null)}
                        className="text-ink-500"
                      >
                        ביטול
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRemovingOptionId(option.id)}
                      aria-label={`הסרת ${option.label} מהסקר`}
                      className="text-ink-300"
                    >
                      ✕ הסרה
                    </button>
                  ))}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-ink-500">
          {totalVotes}/{families.length} משפחות הצביעו
        </span>
        <span className="flex-1" />
        {poll.closed && winners.length === 1 && winners[0] && (
          <Link
            href={`/calendar/new?title=${encodeURIComponent(winners[0].label)}${
              winners[0].placeId ? `&placeId=${winners[0].placeId}` : ""
            }`}
            className="rounded-xl bg-sea-600 px-3.5 py-2 font-semibold text-cream-50"
          >
            📅 קבע כפעילות
          </Link>
        )}
        <button
          type="button"
          onClick={() => setPollClosed(poll.id, !poll.closed)}
          className="rounded-xl bg-cream-100 px-3.5 py-2 font-medium text-ink-700"
        >
          {poll.closed ? "פתח מחדש" : "סגור סקר"}
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => deletePoll(poll.id)}
            className="rounded-xl bg-terra-600 px-3 py-2 text-xs font-semibold text-cream-50"
          >
            למחוק
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="מחיקת סקר"
            className="text-ink-300"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

export default function PollsPage() {
  const { polls, loading } = usePolls();
  const { families } = useFamilies();
  const { places } = usePlaces();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker text-terra-500">מחליטים ביחד</p>
          <h1 className="font-display text-3xl font-bold text-ink-900">
            סקרים
          </h1>
        </div>
        <Link href="/polls/new" className="btn-accent px-4 py-2.5 text-sm">
          + סקר
        </Link>
      </div>

      {loading || !families ? (
        <ListSkeleton rows={2} />
      ) : !polls?.length ? (
        <EmptyState
          emoji="🗳️"
          title="עוד אין סקרים"
          description="מתלבטים בין אטרקציות? פתחו סקר וכל משפחה תצביע"
          action={
            <Link href="/polls/new" className="btn-primary px-5 py-2.5 text-sm">
              + סקר ראשון
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {polls
            .slice()
            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
            .map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                families={families}
                places={places ?? []}
              />
            ))}
        </div>
      )}
    </div>
  );
}
