import { isLocale, type Locale } from "@together/i18n/config";
import { translate } from "@together/i18n/translate";
import { type Infer, v } from "convex/values";

/** What happened — rendered per recipient language at send time. */
export const notice = v.union(
  v.object({ type: v.literal("poll"), title: v.string() }),
  v.object({ type: v.literal("poll_option"), title: v.string() }),
  v.object({
    type: v.literal("event"),
    title: v.string(),
    detail: v.optional(v.string()),
    day: v.string(),
    navUrl: v.optional(v.string()),
    /** Set when the AI guide created it ("<guide> added to the schedule") */
    by: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("reminder"),
    eventId: v.string(),
    title: v.string(),
    minutes: v.number(),
    detail: v.string(),
    navUrl: v.optional(v.string()),
  }),
  v.object({ type: v.literal("welcome") }),
  /** Several ideas added by the AI guide in one reply — one push, not one each */
  v.object({ type: v.literal("ideas_updated"), labels: v.array(v.string()) })
);
export type Notice = Infer<typeof notice>;

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path; the same on web and in the app's deep links */
  url: string;
  tag?: string;
  /** Waze link, shown as a "Navigate" action */
  navUrl?: string;
}

export function localeOf(value: string | undefined): Locale {
  return isLocale(value) ? value : "he";
}

export function renderNotice(tripId: string, item: Notice, locale: Locale): PushPayload {
  const base = `/t/${tripId}`;
  switch (item.type) {
    case "poll":
      return { title: translate(locale, "server.push.pollTitle"), body: item.title, url: `${base}/polls`, tag: "poll" };
    case "poll_option":
      return {
        title: translate(locale, "server.push.pollOptionTitle"),
        body: translate(locale, "server.push.pollOptionBody", { title: item.title }),
        url: `${base}/polls`,
        tag: "poll",
      };
    case "event":
      return {
        title: item.by
          ? translate(locale, "server.push.aiEventTitle", { ai: item.by })
          : translate(locale, "server.push.eventTitle"),
        body: item.detail ? `${item.title} · ${item.detail}` : item.title,
        url: `${base}/calendar?day=${item.day}`,
        tag: "event",
        navUrl: item.navUrl,
      };
    case "reminder":
      return {
        title: translate(locale, "server.push.reminderTitle", { minutes: item.minutes, title: item.title }),
        body: item.detail,
        url: base,
        tag: `reminder-${item.eventId}`,
        navUrl: item.navUrl,
      };
    case "ideas_updated":
      return {
        title: translate(locale, "server.push.ideasUpdatedTitle"),
        body:
          item.labels.slice(0, 3).join(" · ") +
          (item.labels.length > 3 ? ` ${translate(locale, "server.push.andMore", { count: item.labels.length - 3 })}` : ""),
        url: `${base}/polls`,
        tag: "poll",
      };
    case "welcome":
      return {
        title: translate(locale, "server.push.welcomeTitle"),
        body: translate(locale, "server.push.welcomeBody"),
        url: base,
        tag: "welcome",
      };
  }
}
