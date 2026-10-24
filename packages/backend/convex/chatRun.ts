import type { Locale } from "@together/i18n/config";
import { contentLocale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import {
  buildContext,
  type ChatPlace,
  type ChatStats,
  decorateCandidates,
  findSamePlace,
  resolveParticipants,
  resolvePlace,
  runChat,
  searchRatedPlaces,
  tripNow,
  ToolArgs,
} from "@together/integrations/ai-chat";
import { systemPrompt } from "@together/integrations/ai-persona";
import { enrichPlace } from "@together/integrations/enrich";
import { geocodePlace, importPlaceFromUrl } from "@together/integrations/import-place";
import { type Outline, planDays } from "@together/integrations/planner";
import { daysBetween } from "@together/shared/holidays";
import { stopForDay } from "@together/shared/trip-doc";
import { type Infer, v } from "convex/values";
import OpenAI from "openai";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { shiftIso } from "@together/shared/holidays";
import { rosterLabel, speakerLine } from "./chat";
import { regionOf } from "./events";
import type { placeInput } from "./places";

/**
 * One guide reply: runs the OpenAI tool loop for a pending assistant
 * message and writes the result into it. Tool side effects go through
 * internal mutations that reuse the normal rules (dedupe, reminders, one
 * notification per action). Never leaves the message pending.
 */

type Context = NonNullable<Awaited<ReturnType<typeof loadContext>>>;
type Ctx = Context;

const errorDetail = (error: unknown) => String((error as { data?: { detail?: string } })?.data?.detail ?? "");

/**
 * Writes the reply text into the pending message while the model streams: at most one write in
 * flight, at most every STREAM_EVERY_MS, always the latest text. flush() waits for the last write,
 * so nothing can land after the final answer.
 */
const STREAM_EVERY_MS = 250;
function replyStreamer(ctx: ActionCtx, replyId: Id<"chatMessages">) {
  let latest = "";
  let sent = "";
  let running = false;
  let lastAt = 0;
  async function pump() {
    if (running) return;
    running = true;
    try {
      while (latest !== sent) {
        const wait = STREAM_EVERY_MS - (Date.now() - lastAt);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        const text = latest;
        await ctx.runMutation(internal.chat.streamReply, { replyId, content: text }).catch(() => undefined);
        sent = text;
        lastAt = Date.now();
      }
    } finally {
      running = false;
    }
  }
  return {
    push(text: string) {
      latest = text;
      void pump();
    },
    async flush() {
      while (running) await new Promise((resolve) => setTimeout(resolve, 20));
    },
  };
}

function loadContext(ctx: ActionCtx, replyId: Id<"chatMessages">) {
  return ctx.runQuery(internal.chat.runContext, { replyId });
}

function executor(ctx: ActionCtx, context: Context, locale: Locale, ideas: string[]) {
  const trip = context.trip;
  const tripId = trip._id;
  const places: ChatPlace[] = [...context.places];
  const speaker = speakerLine(locale, context.speakerName, context.speakerFamily);
  // The lists the model points into by ref/name; kept current as tools change them
  const events = context.events.map((e) => ({ ...e }));
  const expenses: { id: string; ref: string; description: string }[] = context.expenses.map((x) => ({ id: x.id, ref: x.ref, description: x.description }));
  const isOrganizer = context.role === "owner" || context.role === "admin";
  const isKid = context.role === "kid";
  const canDeletePlaces = isOrganizer || (context.membersCanDeletePlaces && !isKid && !context.guest);
  const denied = (why: string) => ({ ok: false, error: `Not allowed: ${why}. Tell the user kindly and suggest asking an organizer.` });
  const eventByRef = (ref: string) => events.find((e) => e.ref === ref.trim().toLowerCase());
  const pollByQuestion = (text: string) => ctx.runQuery(internal.chatTools.findPoll, { tripId, question: text });

  return async (name: string, raw: unknown): Promise<Record<string, unknown>> => {
    switch (name) {
      case "add_place": {
        const args = ToolArgs.add_place.parse(raw);
        const region = args.region?.trim() || regionOf(trip);
        // Never duplicate — reuse an existing place with a matching name
        const existing = findSamePlace(args.name, places);
        if (existing) {
          return { ok: true, placeId: existing.id, placeName: existing.name, summary: `"${existing.name}" כבר קיים במאגר — השתמש בו` };
        }
        let input: Infer<typeof placeInput>;
        if (args.url && /^https?:\/\//.test(args.url)) {
          const draft = await importPlaceFromUrl(args.url, region);
          input = {
            name: args.name || draft.name,
            category: args.category as Doc<"places">["category"],
            ...(draft.area ? { area: draft.area } : {}),
            ...(draft.address ? { address: draft.address } : {}),
            lat: draft.lat,
            lng: draft.lng,
            ...(draft.website ? { website: draft.website } : {}),
            ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
            ...(draft.summary ? { summary: draft.summary } : {}),
            ...(draft.openingHours ? { openingHours: draft.openingHours } : {}),
            ...(draft.priceNotes ? { priceNotes: draft.priceNotes } : {}),
            ...(draft.tips ? { tips: draft.tips } : {}),
            sourceUrl: args.url,
          };
        } else {
          const geo = await geocodePlace(args.query?.trim() || args.name, region);
          if (!geo) {
            return { ok: false, error: `לא הצלחתי לאתר את "${args.query ?? args.name}" בגוגל — בקש מהמשתמש כתובת מדויקת יותר` };
          }
          input = {
            name: args.name,
            category: args.category as Doc<"places">["category"],
            ...(geo.address ? { address: geo.address } : {}),
            lat: geo.lat,
            lng: geo.lng,
            ...(geo.photoUrl ? { imageUrl: geo.photoUrl } : {}),
          };
        }
        const { id } = await ctx.runMutation(internal.chat.toolAddPlace, {
          tripId,
          input,
          createdByName: speaker ? `${speaker} (דרך ${trip.ai.name})` : trip.ai.name,
        });
        // Keep the context fresh so a chained create_event resolves it
        places.push({ id, name: input.name, category: input.category });
        return {
          ok: true,
          placeId: id,
          placeName: input.name,
          summary: `המקום "${input.name}" נוצר עם מיקום${input.imageUrl ? ", תמונה" : ""}${input.address ? ` (${input.address})` : ""}`,
        };
      }

      case "search_google_places": {
        const args = ToolArgs.search_google_places.parse(raw);
        return searchRatedPlaces(args.query, args.region?.trim() || regionOf(trip), args.minRating);
      }

      case "create_event": {
        const args = ToolArgs.create_event.parse(raw);
        if (args.day < trip.startDate || args.day > trip.endDate) {
          return { ok: false, error: `התאריך ${args.day} מחוץ לטווח הטיול` };
        }
        const place = resolvePlace(args.placeName, places);
        const startTime = args.startTime.length === 4 ? `0${args.startTime}` : args.startTime;
        const who = resolveParticipants(args.participants, context.families);
        const eventId = await ctx.runMutation(internal.chat.toolCreateEvent, {
          tripId,
          title: args.title,
          ...(args.emoji ? { emoji: args.emoji } : {}),
          day: args.day,
          startTime,
          ...(args.durationMin ? { durationMin: args.durationMin } : {}),
          placeId: (place?.id as Id<"places"> | undefined) ?? null,
          participants:
            who.type === "families" ? { type: "families", familyIds: who.familyIds as Id<"families">[] } : who,
          notes: args.notes ?? "",
        });
        return {
          ok: true,
          eventId,
          summary: `נוצר אירוע "${args.title}" ב-${args.day} בשעה ${startTime}${place ? ` (מקושר ל-${place.name})` : ""}`,
        };
      }

      case "enrich_place": {
        const args = ToolArgs.enrich_place.parse(raw);
        const target = resolvePlace(args.placeName, places);
        if (!target) return { ok: false, error: `לא נמצא מקום שמור בשם "${args.placeName}"` };
        const place = await ctx.runQuery(internal.chat.placeForEnrich, { placeId: target.id as Id<"places"> });
        if (!place) return { ok: false, error: "המקום לא נמצא" };
        const result = await enrichPlace(place, {
          region: regionOf(trip),
          shortName: trip.stops[0]?.label ?? trip.destination.label,
          audience: trip.legacyKey === "sicily" ? "למשפחות" : "למטיילים",
          explicitUrl: args.url,
          locale: contentLocale(locale),
        });
        if (result.ok) await ctx.runMutation(internal.places.patchInternal, { placeId: place._id, patch: result.updates });
        return { ok: result.ok, summary: result.message };
      }

      case "create_poll": {
        const args = ToolArgs.create_poll.parse(raw);
        const options = args.options.map((option) => ({
          label: option.label,
          placeId: (resolvePlace(option.placeName ?? option.label, places)?.id as Id<"places"> | undefined) ?? null,
        }));
        const pollId = await ctx.runMutation(internal.chat.toolCreatePoll, { tripId, question: args.question, options });
        return { ok: true, pollId, summary: `נוצר סקר "${args.question}" עם ${options.length} אפשרויות וכולם קיבלו התראה` };
      }

      case "add_poll_option": {
        const args = ToolArgs.add_poll_option.parse(raw);
        const place = resolvePlace(args.placeName ?? args.label, places);
        const result = await ctx.runMutation(internal.chat.toolAddIdea, {
          tripId,
          label: args.label,
          placeId: (place?.id as Id<"places"> | undefined) ?? null,
          locale,
        });
        if (result === "exists") return { ok: true, summary: `"${args.label}" כבר נמצא בסקר הקבוצתי` };
        ideas.push(args.label);
        return { ok: true, summary: `"${args.label}" נוסף לסקר הרעיונות` };
      }


      // ── edit tools: anything a person can do by hand ────────────────────
      case "update_event": {
        const args = ToolArgs.update_event.parse(raw);
        if (isKid) return denied("kids can't change the schedule");
        const target = eventByRef(args.ref);
        if (!target) return { ok: false, error: `No schedule item with ref ${args.ref}` };
        if (args.day && (args.day < trip.startDate || args.day > trip.endDate)) return { ok: false, error: `${args.day} is outside the trip dates` };
        const place = args.placeName ? resolvePlace(args.placeName, places) : null;
        if (args.placeName && !place) return { ok: false, error: `No saved place named "${args.placeName}"` };
        const who = args.participants ? resolveParticipants(args.participants, context.families) : null;
        await ctx.runMutation(internal.chatTools.updateEvent, {
          tripId,
          eventId: target.id as Id<"events">,
          patch: {
            ...(args.title ? { title: args.title } : {}),
            ...(args.emoji ? { emoji: args.emoji } : {}),
            ...(args.day ? { day: args.day } : {}),
            ...(args.startTime ? { startTime: args.startTime } : {}),
            ...(args.durationMin ? { durationMin: args.durationMin } : {}),
            ...(place ? { placeId: place.id as Id<"places"> } : {}),
            ...(who ? { participants: who.type === "families" ? { type: "families" as const, familyIds: who.familyIds as Id<"families">[] } : who } : {}),
            ...(args.notes !== undefined ? { notes: args.notes } : {}),
          },
        });
        if (args.day) target.day = args.day;
        if (args.startTime) target.startTime = args.startTime;
        if (args.title) target.title = args.title;
        return { ok: true, summary: `Updated "${target.title}" (${target.day} ${target.startTime})` };
      }

      case "delete_event": {
        const args = ToolArgs.delete_event.parse(raw);
        if (isKid) return denied("kids can't remove schedule items");
        const targets = args.refs.map(eventByRef).filter((e): e is Ctx["events"][number] => Boolean(e));
        if (!targets.length) return { ok: false, error: "None of those refs exist" };
        const removed = await ctx.runMutation(internal.chatTools.deleteEvents, { tripId, eventIds: targets.map((e) => e.id as Id<"events">) });
        for (const target of targets) events.splice(events.indexOf(target), 1);
        return { ok: true, summary: `Removed ${removed} item(s): ${targets.map((e) => e.title).join(", ")}` };
      }

      case "clear_day": {
        const args = ToolArgs.clear_day.parse(raw);
        if (isKid) return denied("kids can't remove schedule items");
        const removed = await ctx.runMutation(internal.chatTools.clearDay, { tripId, day: args.day, includeBookings: args.includeBookings ?? false });
        for (let i = events.length - 1; i >= 0; i--) if (events[i].day === args.day && (args.includeBookings || !events[i].booked)) events.splice(i, 1);
        return { ok: true, summary: `Cleared ${removed} item(s) from ${args.day}${args.includeBookings ? "" : " (bookings kept)"}` };
      }

      case "shift_days": {
        const args = ToolArgs.shift_days.parse(raw);
        if (isKid) return denied("kids can't change the schedule");
        try {
          const moved = await ctx.runMutation(internal.chatTools.shiftDays, { tripId, fromDay: args.fromDay, toDay: args.toDay ?? trip.endDate, byDays: args.byDays });
          for (const e of events) if (e.day >= args.fromDay && e.day <= (args.toDay ?? trip.endDate)) e.day = shiftIso(e.day, args.byDays);
          return { ok: true, summary: `Moved ${moved} item(s) by ${args.byDays} day(s)` };
        } catch (error) {
          return { ok: false, error: errorDetail(error) === "day_out_of_range" ? "That would push items outside the trip dates. Change the trip dates first." : "Couldn't move the days" };
        }
      }

      case "swap_days": {
        const args = ToolArgs.swap_days.parse(raw);
        if (isKid) return denied("kids can't change the schedule");
        if (stopForDay(trip.stops, args.dayA).label !== stopForDay(trip.stops, args.dayB).label) {
          return { ok: false, error: "Those two days are in different cities of the route, so swapping them would put activities in the wrong place. Offer to move specific items with update_event instead." };
        }
        try {
          const moved = await ctx.runMutation(internal.chatTools.swapDays, { tripId, dayA: args.dayA, dayB: args.dayB });
          for (const e of events) e.day = e.day === args.dayA ? args.dayB : e.day === args.dayB ? args.dayA : e.day;
          return { ok: true, summary: `Swapped ${args.dayA} and ${args.dayB} (${moved} items)` };
        } catch {
          return { ok: false, error: "Both days must be within the trip dates" };
        }
      }

      case "replan_day": {
        const args = ToolArgs.replan_day.parse(raw);
        if (isKid) return denied("kids can't change the schedule");
        if (args.day < trip.startDate || args.day > trip.endDate) return { ok: false, error: `${args.day} is outside the trip dates` };
        const stop = stopForDay(trip.stops, args.day);
        const outline: Outline = {
          title: trip.name,
          emoji: "sun",
          summary: trip.summary ?? "",
          datesReason: "",
          tips: [],
          startDate: trip.startDate,
          endDate: trip.endDate,
          stops: trip.stops.map((s) => ({ label: s.label, country: s.country ?? "", nights: Math.max(1, daysBetween(s.startDate, s.endDate) - 1) })),
          group: { kind: trip.groupKind, name: "", adults: Math.max(1, context.families.reduce((n, f) => n + f.members.length, 0)), kidAges: [] },
        };
        const dayNumber = daysBetween(trip.startDate, args.day);
        const planned = await planDays(outline, { text: `${trip.name}. Plan only this one day: ${args.instruction}`, locale: contentLocale(locale) }, [dayNumber], () => stop.label);
        // A re-plan never adds another hotel; the stay stays as booked/planned
        const items = (planned[0]?.items ?? []).filter((item) => item.kind !== "stay");
        if (!items.length) return { ok: false, error: "Couldn't come up with a plan for that day" };
        const stopRow = trip.stops.find((s) => s.label === stop.label);
        const geos = new Map<string, Awaited<ReturnType<typeof geocodePlace>>>();
        const wanted = [...new Set(items.filter((item) => item.kind !== "transport").map((item) => item.query))].slice(0, 12);
        await Promise.all(wanted.map(async (query) => void geos.set(query, await geocodePlace(query, stopRow ? `${stopRow.label} ${stopRow.country ?? ""}` : regionOf(trip)).catch(() => null))));
        const result = await ctx.runMutation(internal.chatTools.replaceDay, {
          tripId,
          day: args.day,
          stopLabel: stop.label,
          authorName: speaker ? `${speaker} (${trip.ai.name})` : trip.ai.name,
          items: items.map((item) => {
            const geo = geos.get(item.query) ?? null;
            return {
              time: item.time,
              title: item.title,
              kind: item.kind,
              durationMin: item.durationMin,
              why: item.why,
              query: item.query,
              geo: geo ? { lat: geo.lat, lng: geo.lng, ...(geo.address ? { address: geo.address } : {}), ...(geo.photoUrl ? { photoUrl: geo.photoUrl } : {}) } : null,
            };
          }),
        });
        return { ok: true, summary: `Re-planned ${args.day}: replaced ${result.removed} item(s) with ${result.added} new ones (booked items kept). Tell the user what the new day looks like.`, items: items.map((i) => `${i.time} ${i.title}`) };
      }

      case "change_trip_dates": {
        const args = ToolArgs.change_trip_dates.parse(raw);
        if (!isOrganizer) return denied("only organizers can change the trip dates");
        if (!args.startDate && !args.endDate) return { ok: false, error: "Give a new startDate and/or endDate" };
        try {
          const range = await ctx.runMutation(internal.chatTools.changeTripDates, { tripId, ...(args.startDate ? { startDate: args.startDate } : {}), ...(args.endDate ? { endDate: args.endDate } : {}) });
          return { ok: true, summary: `The trip now runs ${range.startDate} to ${range.endDate}` };
        } catch {
          return { ok: false, error: "Those dates don't work (end before start, or longer than 120 days)" };
        }
      }

      case "update_place": {
        const args = ToolArgs.update_place.parse(raw);
        if (isKid) return denied("kids can't edit places");
        const target = resolvePlace(args.placeName, places);
        if (!target) return { ok: false, error: `No saved place named "${args.placeName}"` };
        const { placeName: _ignored, ...patch } = args;
        void _ignored;
        await ctx.runMutation(internal.chatTools.updatePlace, { tripId, placeId: target.id as Id<"places">, patch: patch as never });
        if (args.name) target.name = args.name;
        return { ok: true, summary: `Updated the place "${target.name}"` };
      }

      case "delete_place": {
        const args = ToolArgs.delete_place.parse(raw);
        if (!canDeletePlaces) return denied("you don't have permission to delete places in this trip");
        const target = resolvePlace(args.placeName, places);
        if (!target) return { ok: false, error: `No saved place named "${args.placeName}"` };
        await ctx.runMutation(internal.chatTools.deletePlace, { tripId, placeId: target.id as Id<"places"> });
        places.splice(places.indexOf(target), 1);
        return { ok: true, summary: `Deleted "${target.name}"` };
      }

      case "set_home_base": {
        const args = ToolArgs.set_home_base.parse(raw);
        if (!isOrganizer) return denied("only organizers can set the home base");
        const target = resolvePlace(args.placeName, places);
        if (!target) return { ok: false, error: `No saved place named "${args.placeName}"` };
        await ctx.runMutation(internal.chatTools.setHomeBase, { tripId, placeId: target.id as Id<"places"> });
        return { ok: true, summary: `"${target.name}" is now the home base` };
      }

      case "vote_poll": {
        const args = ToolArgs.vote_poll.parse(raw);
        const poll = await pollByQuestion(args.question);
        if (!poll) return { ok: false, error: `No poll matching "${args.question}"` };
        const option = poll.options.find((o) => o.label.toLowerCase() === args.option.toLowerCase()) ?? poll.options.find((o) => o.label.toLowerCase().includes(args.option.toLowerCase()) || args.option.toLowerCase().includes(o.label.toLowerCase()));
        if (!option) return { ok: false, error: `No option "${args.option}" in "${poll.question}"` };
        try {
          await ctx.runMutation(internal.chatTools.votePoll, { tripId, pollId: poll.id as Id<"polls">, optionId: option.id, userId: context.ownerId });
          return { ok: true, summary: `Voted "${option.label}" in "${poll.question}"` };
        } catch {
          return { ok: false, error: "That poll is closed" };
        }
      }

      case "close_poll": {
        const args = ToolArgs.close_poll.parse(raw);
        if (isKid) return denied("kids can't close polls");
        const poll = await pollByQuestion(args.question);
        if (!poll) return { ok: false, error: `No poll matching "${args.question}"` };
        await ctx.runMutation(internal.chatTools.setPollClosed, { tripId, pollId: poll.id as Id<"polls">, closed: args.closed ?? true });
        return { ok: true, summary: `${args.closed === false ? "Reopened" : "Closed"} "${poll.question}"` };
      }

      case "delete_poll": {
        const args = ToolArgs.delete_poll.parse(raw);
        if (isKid) return denied("kids can't delete polls");
        const poll = await pollByQuestion(args.question);
        if (!poll) return { ok: false, error: `No poll matching "${args.question}"` };
        await ctx.runMutation(internal.chatTools.deletePoll, { tripId, pollId: poll.id as Id<"polls"> });
        return { ok: true, summary: `Deleted the poll "${poll.question}"` };
      }

      case "add_expense": {
        const args = ToolArgs.add_expense.parse(raw);
        if (isKid || context.guest) return denied("only adults with an account can record expenses");
        const payerName = args.payer ?? context.speakerFamily;
        const payer = payerName ? resolveParticipants([payerName], context.families) : null;
        const payerId = payer?.type === "families" ? payer.familyIds[0] : context.families.find((f) => f.id === context.myFamilyId)?.id;
        if (!payerId) return { ok: false, error: "Say which family paid" };
        const split = args.splitBetween?.length ? resolveParticipants(args.splitBetween, context.families) : null;
        const currency = (args.currency ?? trip.mainCurrency ?? trip.stops[0]?.currency ?? "EUR").toUpperCase();
        const date = args.date ?? tripNow(trip.timezone).todayIso;
        const id = await ctx.runMutation(internal.chatTools.addExpense, {
          tripId,
          payerFamilyId: payerId as Id<"families">,
          description: args.description,
          amount: args.amount,
          currency,
          date,
          participantFamilyIds: split?.type === "families" ? (split.familyIds as Id<"families">[]) : null,
          userId: context.ownerId,
        });
        expenses.push({ id, ref: `x${expenses.length + 1}`, description: args.description });
        return { ok: true, summary: `Recorded ${args.amount} ${currency} for "${args.description}"` };
      }

      case "delete_expense": {
        const args = ToolArgs.delete_expense.parse(raw);
        if (isKid || context.guest) return denied("only adults with an account can delete expenses");
        const target = expenses.find((x) => x.ref === args.ref);
        if (!target) return { ok: false, error: `No expense with ref ${args.ref}` };
        await ctx.runMutation(internal.chatTools.deleteExpense, { tripId, expenseId: target.id as Id<"expenses"> });
        expenses.splice(expenses.indexOf(target), 1);
        return { ok: true, summary: `Deleted the expense "${target.description}"` };
      }

      default:
        return { ok: false, error: "unknown_tool" };
    }
  };
}

export const run = internalAction({
  args: { replyId: v.id("chatMessages"), locale: v.string() },
  handler: async (ctx, { replyId, locale: rawLocale }): Promise<void> => {
    const locale: Locale = rawLocale === "en" || rawLocale === "ar" || rawLocale === "es" ? rawLocale : "he";
    const context = await loadContext(ctx, replyId);
    if (!context) return;
    const failWith = (key: "ai.errors.failed" | "ai.errors.notConfigured") =>
      ctx.runMutation(internal.chat.failReply, { replyId, content: translate(locale, key) });

    if (!process.env.OPENAI_API_KEY) {
      await failWith("ai.errors.notConfigured");
      return;
    }
    const trip = context.trip;
    const ideas: string[] = [];
    const startedAt = Date.now();
    const stats: ChatStats = { firstEffort: "low", rounds: 0, llmMs: 0, toolMs: 0, tools: [], promptTokens: 0, completionTokens: 0 };
    let decorateMs = 0;
    let ok = false;
    // Show the reply as it is written (AI_STREAM=0 turns it off)
    const streamer = process.env.AI_STREAM === "0" ? null : replyStreamer(ctx, replyId);
    try {
      const answer = await runChat({
        stats,
        ...(streamer ? { onReply: (text: string) => streamer.push(text) } : {}),
        openai: new OpenAI(),
        system: systemPrompt(trip, locale),
        context: buildContext({
          timezone: trip.timezone,
          startDate: trip.startDate,
          endDate: trip.endDate,
          stops: trip.stops,
          homeBase: trip.homeBase,
          homeBaseLabel: trip.legacyKey ? "הוילה" : "מקום הלינה",
          rosterLabel: rosterLabel(trip),
          aboutUs: trip.aboutUs ?? "",
          families: context.families,
          places: context.places,
          events: context.events,
          expenses: context.expenses,
          polls: context.polls,
        }),
        speaker: speakerLine(locale, context.speakerName, context.speakerFamily),
        turns: context.turns,
        range: { startDate: trip.startDate, endDate: trip.endDate },
        execute: executor(ctx, context, locale, ideas),
      });
      await streamer?.flush();
      const decorating = Date.now();
      const candidates = await decorateCandidates(answer.candidates, regionOf(trip));
      decorateMs = Date.now() - decorating;
      await ctx.runMutation(internal.chat.finish, { replyId, content: answer.reply, candidates });
      ok = true;
    } catch (error) {
      await streamer?.flush();
      console.error("[chat] run failed", error);
      await failWith("ai.errors.failed");
    } finally {
      const totalMs = Date.now() - startedAt;
      console.log(`[chat] ${ok ? "ok" : "failed"} total=${totalMs}ms llm=${stats.llmMs}ms tools=${stats.toolMs}ms decorate=${decorateMs}ms rounds=${stats.rounds} effort=${stats.firstEffort} tokens=${stats.promptTokens}+${stats.completionTokens} [${stats.tools.join(",")}]`);
      await ctx.runMutation(internal.chat.logRun, {
        tripId: trip._id,
        ok,
        totalMs,
        llmMs: stats.llmMs,
        toolMs: stats.toolMs,
        decorateMs,
        rounds: stats.rounds,
        firstEffort: stats.firstEffort,
        tools: stats.tools,
        promptTokens: stats.promptTokens,
        completionTokens: stats.completionTokens,
        model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      }).catch(() => undefined);
      await ctx.runMutation(internal.chat.notifyIdeas, { tripId: trip._id, labels: ideas, excludeUserId: context.ownerId });
    }
  },
});
