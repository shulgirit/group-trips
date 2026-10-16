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
  Lightbulb,
  Lock,
  Plus,
  Trash2,
  Trophy,
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
import type { Family, Place, Poll } from "@together/shared/types";
import { useTrip } from "@/components/providers/TripProvider";
import { CategoryIcon, STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { tActive } from "@together/i18n/active";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]";

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

/** Up to four initials, then "+n". */
function VoterAvatars({ voters }: { voters: NormalizedVote[] }) {
  const t = useT();
  if (!voters.length) return null;
  const shown = voters.slice(0, 4);
  const extra = voters.length - shown.length;
  return (
    <span
      className="flex -space-x-1.5 rtl:space-x-reverse"
      aria-label={voters.map((v) => v.name).join(", ")}
    >
      {shown.map((vote) => (
        <span
          key={vote.voterKey}
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-cream-100 text-xs font-medium text-ink-700"
        >
          {vote.name.slice(0, 1)}
        </span>
      ))}
      {extra > 0 && (
        <span
          aria-hidden
          className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-cream-200 px-1 text-xs text-ink-700"
        >
          {t("polls.moreVoters", { count: extra })}
        </span>
      )}
    </span>
  );
}

function scheduleHref(prefix: string, label: string, placeId?: string | null) {
  return `${prefix}/calendar/new?title=${encodeURIComponent(label)}${
    placeId ? `&placeId=${placeId}` : ""
  }`;
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
  const winner = poll.closed && winners.length === 1 ? winners[0] : null;

  async function handleVote(optionId: string) {
    if (!voterUid || poll.closed) return;
    await votePoll(poll.id, voterUid, optionId, voterName);
  }

  function placeFor(option: Poll["options"][number]): Place | null {
    // Resolve the place by id, or by name for free-text options,
    // so every option that CAN show a real photo does
    return (
      (option.placeId ? places.find((p) => p.id === option.placeId) : null) ??
      places.find(
        (p) =>
          option.label === p.name ||
          option.label.includes(p.name) ||
          p.name.includes(option.label)
      ) ??
      null
    );
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white ${CARD_SHADOW}`}
    >
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2 text-xs">
          {poll.closed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-2.5 py-1 font-medium text-ink-500">
              <Lock size={12} strokeWidth={STROKE} aria-hidden />
              {t("polls.closed")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-route-100 px-2.5 py-1 font-medium text-route-700">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-route-500" />
              {t("polls.open")}
            </span>
          )}
          {poll.pinned && (
            <span className="inline-flex items-center gap-1 text-ink-500">
              <Lightbulb size={13} strokeWidth={STROKE} aria-hidden />
              {t("polls.sheet.ideasTitle")}
            </span>
          )}
          <span className="flex-1" />
          <span className="text-ink-500">
            {votes.length ? t("polls.votes", { count: votes.length }) : t("polls.noVotes")}
          </span>
        </div>
        <h2 className="mt-3 font-display text-2xl leading-tight text-ink-900">
          <bdi>{poll.question}</bdi>
        </h2>

        {/* Closed with a clear winner: the group's decision, ready to schedule */}
        {winner && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brass-100 p-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brass-600"
            >
              <Trophy size={18} strokeWidth={STROKE} />
            </span>
            <span className="min-w-[8rem] flex-1">
              <span className="block text-xs text-ink-500">{t("polls.decided")}</span>
              <span className="block line-clamp-2 font-medium text-ink-900">
                <bdi>{winner.label}</bdi>
              </span>
            </span>
            <Link
              href={scheduleHref(prefix, winner.label, winner.placeId)}
              className="btn-primary min-h-11 shrink-0 px-3.5 text-sm"
            >
              <CalendarPlus size={16} strokeWidth={STROKE} aria-hidden />
              {t("polls.setAsEvent")}
            </Link>
          </div>
        )}

        {/* Voting state */}
        {!poll.closed &&
          (voterUid ? (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-500">
              {myVote && (
                <Check size={15} strokeWidth={STROKE} aria-hidden className="mt-[3px] shrink-0 text-brass-600" />
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
              className="mt-4 flex min-h-11 items-center gap-2.5 rounded-xl border border-cream-200 bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700"
            >
              <Lock size={15} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-500" />
              <span className="flex-1">{t("polls.signInToVote")}</span>
              <ChevronRight size={16} strokeWidth={STROKE} aria-hidden className="shrink-0 text-ink-400 rtl:rotate-180" />
            </Link>
          ))}
      </div>

      {/* Options */}
      <ul className="mt-4 space-y-2 px-3">
        {poll.options.map((option) => {
          const count = counts.get(option.id) ?? 0;
          const percent = votes.length ? Math.round((count / votes.length) * 100) : 0;
          const isWinner = poll.closed && winners.some((w) => w.id === option.id);
          const place = placeFor(option);
          const isMyVote = !poll.closed && myVote === option.id;
          const highlighted = isMyVote || isWinner;
          const voters = votes.filter((v) => v.optionId === option.id);
          return (
            <li
              key={option.id}
              className={`overflow-hidden rounded-xl border transition ${
                highlighted ? "border-brass-300 bg-brass-100/40" : "border-cream-200 bg-white"
              }`}
            >
              <button
                type="button"
                disabled={poll.closed || !voterUid}
                onClick={() => handleVote(option.id)}
                aria-pressed={!poll.closed && voterUid ? isMyVote : undefined}
                className={`flex w-full items-center gap-3 p-2 text-start disabled:opacity-100 ${
                  voterUid && !poll.closed ? "active:bg-cream-100/70" : ""
                }`}
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  {place?.imageUrl ? (
                    <Image src={place.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center bg-cream-100 text-route-700">
                      {place ? (
                        <CategoryIcon category={place.category} size={20} />
                      ) : (
                        <Lightbulb size={20} strokeWidth={STROKE} aria-hidden />
                      )}
                    </span>
                  )}
                  {highlighted && (
                    <span className="absolute bottom-1 end-1 flex h-5 w-5 items-center justify-center rounded-full bg-brass-500 text-white">
                      {isWinner ? (
                        <Trophy size={11} strokeWidth={2} aria-label={t("polls.winner")} />
                      ) : (
                        <Check size={12} strokeWidth={2.5} aria-label={t("polls.yourVote")} />
                      )}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 pe-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                      <bdi>{option.label}</bdi>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-ink-700">{count}</span>
                  </span>
                  <span className="mt-2 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-chart-100" aria-hidden>
                      <span
                        className={`block h-full rounded-full transition-[width] duration-500 ${
                          highlighted ? "bg-brass-500" : "bg-route-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-end text-xs tabular-nums text-ink-500">
                      {percent}%
                    </span>
                  </span>
                </span>
              </button>

              {/* Secondary actions for this option */}
              <div className="flex items-center gap-1 border-t border-cream-100 px-2 text-xs">
                <VoterAvatars voters={voters} />
                <span className="flex-1" />
                {place && (
                  <Link
                    href={`${prefix}/places/${place.id}`}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 font-medium text-route-700"
                  >
                    <BookOpen size={14} strokeWidth={STROKE} aria-hidden />
                    {t("polls.readAbout")}
                  </Link>
                )}
                <Link
                  href={scheduleHref(prefix, option.label, place?.id)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 font-medium text-ink-700"
                >
                  <CalendarPlus size={14} strokeWidth={STROKE} aria-hidden />
                  {t("polls.schedule")}
                </Link>
                {!poll.closed &&
                  (removingOptionId === option.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          removePollOption(poll.id, option.id);
                          setRemovingOptionId(null);
                        }}
                        className="min-h-10 px-2 font-medium text-terra-600"
                      >
                        {t("polls.confirmRemove")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingOptionId(null)}
                        className="min-h-10 px-2 text-ink-500"
                      >
                        {t("common.cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRemovingOptionId(option.id)}
                      aria-label={t("polls.removeOptionLabel", { label: option.label })}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-300"
                    >
                      <X size={15} strokeWidth={STROKE} aria-hidden />
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Who voted (names) */}
      {votes.length > 0 && (
        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={() => setVotersOpen(!votersOpen)}
            aria-expanded={votersOpen}
            className="flex min-h-11 w-full items-center gap-1.5 text-sm text-ink-500"
          >
            {t("polls.whoVoted")}
            <ChevronDown
              size={15}
              strokeWidth={STROKE}
              aria-hidden
              className={`transition-transform ${votersOpen ? "rotate-180" : ""}`}
            />
          </button>
          {votersOpen && (
            <div className="mb-1 space-y-3 rounded-xl bg-cream-50 p-3">
              {poll.options.map((option) => {
                const voters = votes.filter((v) => v.optionId === option.id);
                if (!voters.length) return null;
                return (
                  <div key={option.id}>
                    <p className="text-xs font-medium text-ink-500">
                      <bdi>{option.label}</bdi>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {voters.map((vote) => (
                        <span
                          key={vote.voterKey}
                          className="rounded-full bg-white px-2.5 py-1 text-xs text-ink-700"
                        >
                          <bdi>{vote.name}</bdi>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className={`flex items-center gap-2 border-t border-cream-100 px-3 py-2 ${votes.length ? "" : "mt-4"}`}>
        <button
          type="button"
          onClick={() => setPollClosed(poll.id, !poll.closed)}
          className="btn-soft min-h-11 px-4 text-sm"
        >
          {poll.closed ? t("polls.reopen") : t("polls.closePoll")}
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={() => deletePoll(poll.id)}
              className="btn-danger min-h-11 px-4 text-sm"
            >
              {t("polls.confirmDelete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-11 px-3 text-sm text-ink-500"
            >
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={t("polls.deletePoll")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-300 transition hover:text-terra-600"
          >
            <Trash2 size={17} strokeWidth={STROKE} aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

export default function PollsPage() {
  const { prefix } = useTrip();
  const t = useT();
  const { polls, loading } = usePolls();
  const { families } = useFamilies();
  const { places } = usePlaces();

  const sorted = (polls ?? [])
    .slice()
    .sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        (a.closed ? 1 : 0) - (b.closed ? 1 : 0)
    );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="kicker text-ink-500">{t("polls.kicker")}</p>
          <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
            {t("polls.title")}
          </h1>
        </div>
        <Link
          href={`${prefix}/polls/new`}
          className="btn-primary min-h-11 px-4 text-sm"
        >
          <Plus size={16} strokeWidth={STROKE} aria-hidden />
          {t("polls.newShort")}
        </Link>
      </div>

      {loading || !families ? (
        <ListSkeleton rows={2} />
      ) : !sorted.length ? (
        <EmptyState
          icon={Vote}
          title={t("polls.emptyTitle")}
          description={t("polls.emptyDescription")}
          action={
            <Link
              href={`${prefix}/polls/new`}
              className="btn-primary min-h-11 px-5 text-sm"
            >
              <Plus size={16} strokeWidth={STROKE} aria-hidden />
              {t("polls.firstPoll")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {sorted.map((poll) => (
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
