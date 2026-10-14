"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Lightbulb,
  Lock,
  Plus,
  Trash2,
  Trophy,
  Users,
  Vote,
  X,
} from "lucide-react";
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
import type { Family, Place, Poll } from "@/types";
import { useTrip } from "@/components/providers/TripProvider";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { tActive } from "@/i18n/active";

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
      return { voterKey, optionId: vote, name: family?.name ?? tActive("polls.traveler") };
    }
    return {
      voterKey,
      optionId: vote.optionId,
      name: vote.name || tActive("polls.traveler"),
    };
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
  const { prefix } = useTrip();
  const t = useT();
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
    linkedMemberName ?? user?.displayName?.split(" ")[0] ?? t("polls.traveler");

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
    <div className={`card p-5 ${poll.pinned ? "border-lemon-300" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-light text-ink-900">
          {poll.question}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${
            poll.closed
              ? "border-cream-200 text-ink-500"
              : "border-lemon-300 text-ink-700"
          }`}
        >
          {poll.closed ? t("polls.closed") : t("polls.open")}
        </span>
      </div>

      {/* Voting state */}
      {!poll.closed &&
        (voterUid ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-sea-100 px-3.5 py-2 text-sm text-sea-700">
            {myVote && (
              <Check
                size={15}
                strokeWidth={STROKE}
                aria-hidden
                className="mt-[3px] shrink-0"
              />
            )}
            <span>
              {myVote
                ? t("polls.votedHint", { name: voterName })
                : t("polls.voteHint", { name: voterName })}
            </span>
          </p>
        ) : (
          <Link
            href={`${prefix}/settings`}
            className="mt-3 flex items-center gap-2 rounded-2xl border border-cream-200 px-3.5 py-2 text-sm text-ink-700"
          >
            <Lock size={14} strokeWidth={STROKE} aria-hidden className="shrink-0" />
            <span className="flex-1">{t("polls.signInToVote")}</span>
            <ChevronRight
              size={15}
              strokeWidth={STROKE}
              aria-hidden
              className="shrink-0 text-ink-300 rtl:rotate-180"
            />
          </Link>
        ))}

      {/* Options */}
      <ul className="mt-4 space-y-3">
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
                className={`relative w-full overflow-hidden rounded-2xl border text-start transition ${
                  isWinner
                    ? "border-lemon-400 bg-lemon-100"
                    : isMyVote
                      ? "border-sea-500 bg-white ring-1 ring-sea-200"
                      : voterUid && !poll.closed
                        ? "border-cream-200 bg-white active:bg-sea-100"
                        : "border-cream-200 bg-white"
                } disabled:opacity-100`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 start-0 bg-sea-100/70"
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
                      <span className="flex h-full items-center justify-center bg-cream-100 text-sea-700">
                        {place ? (
                          <CategoryIcon category={place.category} size={20} />
                        ) : (
                          <Lightbulb size={20} strokeWidth={STROKE} aria-hidden />
                        )}
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 py-3 text-ink-900">
                    {isWinner && (
                      <Trophy
                        size={15}
                        strokeWidth={STROKE}
                        aria-label={t("polls.winner")}
                        className="shrink-0 text-lemon-600"
                      />
                    )}
                    {isMyVote && (
                      <Check
                        size={15}
                        strokeWidth={STROKE}
                        aria-label={t("polls.yourVote")}
                        className="shrink-0 text-sea-700"
                      />
                    )}
                    <span className="truncate">{option.label}</span>
                  </span>
                  <span className="numerals px-4 font-display text-lg font-light tabular-nums text-sea-700">
                    {count}
                  </span>
                </span>
              </button>
              <span className="mt-1.5 flex items-center gap-2 ps-1 text-xs">
                {place && (
                  <Link
                    href={`${prefix}/places/${place.id}`}
                    className="btn-soft gap-1.5 px-3 py-1.5 text-xs text-sea-700"
                  >
                    <BookOpen size={13} strokeWidth={STROKE} aria-hidden />
                    {t("polls.readAbout")}
                  </Link>
                )}
                <Link
                  href={`${prefix}/calendar/new?title=${encodeURIComponent(option.label)}${
                    place ? `&placeId=${place.id}` : ""
                  }`}
                  className="btn-soft gap-1.5 px-3 py-1.5 text-xs text-ink-700"
                >
                  <CalendarPlus size={13} strokeWidth={STROKE} aria-hidden />
                  {t("polls.schedule")}
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
                        className="font-medium text-terra-600"
                      >
                        {t("polls.confirmRemove")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingOptionId(null)}
                        className="text-ink-500"
                      >
                        {t("common.cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRemovingOptionId(option.id)}
                      aria-label={t("polls.removeOptionLabel", { label: option.label })}
                      className="flex items-center gap-1 text-ink-300"
                    >
                      <X size={12} strokeWidth={STROKE} aria-hidden />
                      {t("polls.remove")}
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
        className="mt-4 flex w-full items-center gap-1.5 text-sm text-ink-500"
      >
        <Users size={14} strokeWidth={STROKE} aria-hidden />
        {votes.length
          ? t("polls.votes", { count: votes.length })
          : t("polls.noVotes")}
        <span className="flex-1" />
        {votes.length > 0 && (
          <>
            {t("polls.whoVoted")}
            {votersOpen ? (
              <ChevronUp size={15} strokeWidth={STROKE} aria-hidden />
            ) : (
              <ChevronDown size={15} strokeWidth={STROKE} aria-hidden />
            )}
          </>
        )}
      </button>
      {votersOpen && votes.length > 0 && (
        <div className="mt-2 space-y-2.5 rounded-2xl bg-cream-100/80 p-3">
          {poll.options.map((option) => {
            const voters = votes.filter((v) => v.optionId === option.id);
            if (!voters.length) return null;
            return (
              <div key={option.id}>
                <p className="text-xs font-medium text-ink-500">
                  {option.label}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {voters.map((vote) => (
                    <span
                      key={vote.voterKey}
                      className="rounded-full bg-white px-2.5 py-1 text-xs text-ink-700"
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
      <div className="mt-4 flex items-center gap-2 border-t border-cream-200 pt-4 text-sm">
        {poll.closed && winners.length === 1 && winners[0] && (
          <Link
            href={`${prefix}/calendar/new?title=${encodeURIComponent(winners[0].label)}${
              winners[0].placeId ? `&placeId=${winners[0].placeId}` : ""
            }`}
            className="btn-primary gap-1.5 px-3.5 py-2 text-sm"
          >
            <CalendarPlus size={15} strokeWidth={STROKE} aria-hidden />
            {t("polls.setAsEvent")}
          </Link>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setPollClosed(poll.id, !poll.closed)}
          className="btn-soft px-3.5 py-2 text-sm"
        >
          {poll.closed ? t("polls.reopen") : t("polls.closePoll")}
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => deletePoll(poll.id)}
            className="btn bg-terra-600 px-3 py-2 text-xs text-cream-50"
          >
            {t("polls.confirmDelete")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={t("polls.deletePoll")}
            className="p-1 text-ink-300"
          >
            <Trash2 size={16} strokeWidth={STROKE} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export default function PollsPage() {
  const { prefix } = useTrip();
  const t = useT();
  const { polls, loading } = usePolls();
  const { families } = useFamilies();
  const { places } = usePlaces();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="kicker text-ink-500">{t("polls.kicker")}</p>
          <h1 className="font-display text-3xl font-light tracking-tight text-ink-900">
            {t("polls.title")}
          </h1>
        </div>
        <Link
          href={`${prefix}/polls/new`}
          className="btn-accent gap-1.5 px-4 py-2.5 text-sm"
        >
          <Plus size={16} strokeWidth={STROKE} aria-hidden />
          {t("polls.newShort")}
        </Link>
      </div>

      {loading || !families ? (
        <ListSkeleton rows={2} />
      ) : !polls?.length ? (
        <EmptyState
          icon={Vote}
          title={t("polls.emptyTitle")}
          description={t("polls.emptyDescription")}
          action={
            <Link
              href={`${prefix}/polls/new`}
              className="btn-primary gap-1.5 px-5 py-2.5 text-sm"
            >
              <Plus size={16} strokeWidth={STROKE} aria-hidden />
              {t("polls.firstPoll")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
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
