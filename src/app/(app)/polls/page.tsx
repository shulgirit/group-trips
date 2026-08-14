"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronUp, Users } from "lucide-react";
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

interface NormalizedVote {
  voterKey: string;
  optionId: string;
  name: string;
}

/** Handles both new per-person votes and legacy family-keyed strings. */
function normalizeVotes(poll: Poll, families: Family[]): NormalizedVote[] {
  return Object.entries(poll.votes ?? {}).map(([voterKey, vote]) => {
    if (typeof vote === "string") {
      const family = families.find((f) => f.id === voterKey);
      return { voterKey, optionId: vote, name: family?.name ?? "מטייל" };
    }
    return { voterKey, optionId: vote.optionId, name: vote.name || "מטייל" };
  });
}

function PollCard({
  poll,
  families,
  places,
}: {
  poll: Poll;
  families: Family[];
  places: Place[];
}) {
  const { user, personal, profile } = useFirebase();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingOptionId, setRemovingOptionId] = useState<string | null>(null);
  const [votersOpen, setVotersOpen] = useState(false);

  const votes = useMemo(
    () => normalizeVotes(poll, families),
    [poll, families]
  );

  const voterUid = personal && user ? user.uid : null;
  const linkedMemberName = useMemo(() => {
    if (!profile?.memberId) return null;
    for (const family of families) {
      const member = family.members.find((m) => m.id === profile.memberId);
      if (member) return member.name;
    }
    return null;
  }, [profile, families]);
  const voterName =
    linkedMemberName ?? user?.displayName?.split(" ")[0] ?? "מטייל";

  const myVote = voterUid
    ? votes.find((v) => v.voterKey === voterUid)?.optionId
    : undefined;

  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);
  }
  const maxCount = Math.max(0, ...counts.values());
  const winners = poll.options.filter(
    (o) => maxCount > 0 && counts.get(o.id) === maxCount
  );

  async function handleVote(optionId: string) {
    if (!voterUid || poll.closed) return;
    await votePoll(poll.id, voterUid, optionId, voterName);
  }

  return (
    <div className={`card p-4 ${poll.pinned ? "border-lemon-300" : ""}`}>
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
        (voterUid ? (
          <p className="mt-3 rounded-2xl bg-sea-100 px-3.5 py-2 text-sm text-sea-700">
            {myVote
              ? `✓ הצבעתם (${voterName}) — לחיצה על אפשרות אחרת משנה את ההצבעה`
              : `היי ${voterName} — לחצו על אפשרות כדי להצביע`}
          </p>
        ) : (
          <Link
            href="/settings"
            className="mt-3 block rounded-2xl bg-cream-100 px-3.5 py-2 text-sm text-ink-700"
          >
            🔐 כדי להצביע, השלימו כניסה עם Google בהגדרות ›
          </Link>
        ))}

      {/* Options */}
      <ul className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const count = counts.get(option.id) ?? 0;
          const percent = votes.length ? (count / votes.length) * 100 : 0;
          const isWinner =
            poll.closed && winners.some((w) => w.id === option.id);
          // Resolve the place by id, or by name for free-text options,
          // so every option that CAN show a real photo does
          const place =
            (option.placeId
              ? places.find((p) => p.id === option.placeId)
              : null) ??
            places.find(
              (p) =>
                option.label === p.name ||
                option.label.includes(p.name) ||
                p.name.includes(option.label)
            ) ??
            null;
          const isMyVote = !poll.closed && myVote === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={poll.closed || !voterUid}
                onClick={() => handleVote(option.id)}
                className={`relative w-full overflow-hidden rounded-2xl border text-right transition ${
                  isWinner
                    ? "border-lemon-400 bg-lemon-100"
                    : isMyVote
                      ? "border-sea-500 bg-white ring-2 ring-sea-200"
                      : voterUid && !poll.closed
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
                  <span className="relative h-[4.5rem] w-28 shrink-0 overflow-hidden">
                    {place?.imageUrl ? (
                      <Image
                        src={place.imageUrl}
                        alt=""
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center bg-gradient-to-b from-sea-100 to-cream-100 text-2xl">
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
              <span className="mt-1.5 flex items-center gap-2 ps-1 text-xs">
                {place && (
                  <Link
                    href={`/places/${place.id}`}
                    className="btn-soft gap-1.5 px-3 py-1.5 text-xs text-sea-700"
                  >
                    <BookOpen size={13} />
                    קראו על המקום
                  </Link>
                )}
                <Link
                  href={`/calendar/new?title=${encodeURIComponent(option.label)}${
                    place ? `&placeId=${place.id}` : ""
                  }`}
                  className="btn-soft gap-1.5 px-3 py-1.5 text-xs text-terra-600"
                >
                  📅 שבץ בלוח
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

      {/* Who voted drawer */}
      <button
        type="button"
        onClick={() => setVotersOpen(!votersOpen)}
        className="mt-3 flex w-full items-center gap-1.5 text-sm font-medium text-ink-500"
      >
        <Users size={14} />
        {votes.length ? `${votes.length} הצביעו` : "עוד אין הצבעות"}
        <span className="flex-1" />
        {votes.length > 0 && (
          <>
            מי הצביע למה?
            {votersOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </>
        )}
      </button>
      {votersOpen && votes.length > 0 && (
        <div className="mt-2 space-y-2 rounded-2xl bg-cream-100/80 p-3">
          {poll.options.map((option) => {
            const voters = votes.filter((v) => v.optionId === option.id);
            if (!voters.length) return null;
            return (
              <div key={option.id}>
                <p className="text-xs font-semibold text-ink-500">
                  {option.label}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {voters.map((vote) => (
                    <span
                      key={vote.voterKey}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-700"
                    >
                      {vote.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-cream-100 pt-3 text-sm">
        {poll.closed && winners.length === 1 && winners[0] && (
          <Link
            href={`/calendar/new?title=${encodeURIComponent(winners[0].label)}${
              winners[0].placeId ? `&placeId=${winners[0].placeId}` : ""
            }`}
            className="btn-primary px-3.5 py-2 text-sm"
          >
            📅 קבע כפעילות
          </Link>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setPollClosed(poll.id, !poll.closed)}
          className="btn-soft px-3.5 py-2 text-sm"
        >
          {poll.closed ? "פתח מחדש" : "סגור סקר"}
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => deletePoll(poll.id)}
            className="btn bg-terra-600 px-3 py-2 text-xs text-cream-50"
          >
            למחוק
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="מחיקת סקר"
            className="px-1 text-ink-300"
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
          description="מתלבטים בין אטרקציות? פתחו סקר וכולם יצביעו"
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
