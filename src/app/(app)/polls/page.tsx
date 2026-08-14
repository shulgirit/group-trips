"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { deletePoll, setPollClosed, votePoll } from "@/lib/db";
import { useFamilies, usePolls } from "@/lib/hooks";
import type { Family, Poll } from "@/types";

function PollCard({ poll, families }: { poll: Poll; families: Family[] }) {
  const [votingAs, setVotingAs] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    if (!votingAs) return;
    await votePoll(poll.id, votingAs, optionId);
    setVotingAs(null);
  }

  return (
    <div className="rounded-3xl border border-cream-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-ink-900">{poll.question}</h3>
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

      {/* Voting identity picker */}
      {!poll.closed && (
        <div className="mt-3">
          <p className="mb-1.5 text-sm text-ink-500">
            {votingAs
              ? "עכשיו בחרו אפשרות ⬇️"
              : "בשם איזו משפחה מצביעים?"}
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
                        : "bg-cream-100 text-ink-700"
                  }`}
                >
                  {family.name.replace("משפחת ", "")}
                  {votedOption ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Options with results */}
      <ul className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const count = counts.get(option.id) ?? 0;
          const percent = totalVotes ? (count / totalVotes) * 100 : 0;
          const isWinner = poll.closed && winners.some((w) => w.id === option.id);
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={poll.closed || !votingAs}
                onClick={() => handleVote(option.id)}
                className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-right transition ${
                  isWinner
                    ? "border-lemon-400 bg-lemon-100"
                    : votingAs
                      ? "border-sea-200 bg-white active:bg-sea-100"
                      : "border-cream-200 bg-white"
                } disabled:opacity-100`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 right-0 bg-sea-100/70"
                  style={{ width: `${percent}%` }}
                />
                <span className="relative flex items-center justify-between">
                  <span className="font-medium text-ink-900">
                    {isWinner ? "🏆 " : ""}
                    {option.label}
                  </span>
                  <span className="text-sm tabular-nums text-ink-500">
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-900">סקרים</h1>
        <Link
          href="/polls/new"
          className="rounded-2xl bg-terra-500 px-4 py-2.5 text-sm font-semibold text-cream-50 transition active:scale-[0.98]"
        >
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
            <Link
              href="/polls/new"
              className="inline-block rounded-2xl bg-sea-600 px-5 py-2.5 text-sm font-semibold text-cream-50"
            >
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
              <PollCard key={poll.id} poll={poll} families={families} />
            ))}
        </div>
      )}
    </div>
  );
}
