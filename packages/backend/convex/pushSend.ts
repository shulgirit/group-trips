"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { type Notice, localeOf, notice, renderNotice } from "./lib/notices";

function vapidReady(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@together.app", publicKey, privateKey);
  return true;
}

/** Best effort: never throws; dead browser subscriptions are cleaned up. */
async function deliver(
  ctx: ActionCtx,
  tripId: Id<"trips">,
  item: Notice,
  rows: Doc<"webPushSubscriptions">[]
): Promise<{ sent: number }> {
  if (!rows.length || !vapidReady()) return { sent: 0 };
  const gone: Id<"webPushSubscriptions">[] = [];
  let sent = 0;
  await Promise.all(
    rows.map(async (row) => {
      const payload = renderNotice(tripId, item, localeOf(row.locale));
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 }
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(row._id);
        else console.error("[push] web send failed", status);
      }
    })
  );
  if (gone.length) await ctx.runMutation(internal.push.dropSubscriptions, { ids: gone });
  return { sent };
}

type AppToken = { _id: Id<"appPushTokens">; token: string; locale: string };

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo push to the native app. Best effort; unregistered devices are dropped. */
async function deliverApp(ctx: ActionCtx, tripId: Id<"trips">, item: Notice, rows: AppToken[]): Promise<{ sent: number }> {
  if (!rows.length) return { sent: 0 };
  const messages = rows.map((row) => {
    const payload = renderNotice(tripId, item, localeOf(row.locale));
    return {
      to: row.token,
      title: payload.title,
      ...(payload.body ? { body: payload.body } : {}),
      sound: "default" as const,
      threadId: payload.tag,
      data: { url: payload.url, ...(payload.navUrl ? { navUrl: payload.navUrl } : {}) },
      // The app registers a "navigate" category: a Waze button on event pushes
      ...(payload.navUrl ? { categoryId: "navigate" } : {}),
    };
  });
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  const gone: Id<"appPushTokens">[] = [];
  let sent = 0;
  for (let start = 0; start < messages.length; start += 100) {
    const chunk = messages.slice(start, start + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(chunk) });
      if (!response.ok) {
        console.error("[push] expo send failed", response.status);
        continue;
      }
      const { data } = (await response.json()) as { data: { status: "ok" | "error"; details?: { error?: string } }[] };
      data.forEach((ticket, index) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") gone.push(rows[start + index]._id);
      });
    } catch (error) {
      console.error("[push] expo send failed", (error as Error).message);
    }
  }
  if (gone.length) await ctx.runMutation(internal.push.dropAppTokens, { ids: gone });
  return { sent };
}

export const toTrip = internalAction({
  args: { tripId: v.id("trips"), notice, excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, { tripId, notice: item, excludeUserId }): Promise<{ sent: number }> => {
    const [rows, tokens]: [Doc<"webPushSubscriptions">[], AppToken[]] = await Promise.all([
      ctx.runQuery(internal.push.subscriptions, { tripId, excludeUserId }),
      ctx.runQuery(internal.push.appTokens, { tripId, excludeUserId }),
    ]);
    const [web, app] = await Promise.all([deliver(ctx, tripId, item, rows), deliverApp(ctx, tripId, item, tokens)]);
    return { sent: web.sent + app.sent };
  },
});

export const toEndpoint = internalAction({
  args: { tripId: v.id("trips"), endpoint: v.string(), notice },
  handler: async (ctx, { tripId, endpoint, notice: item }): Promise<{ sent: number }> => {
    const rows: Doc<"webPushSubscriptions">[] = await ctx.runQuery(internal.push.subscriptions, { tripId, endpoint });
    return deliver(ctx, tripId, item, rows);
  },
});
