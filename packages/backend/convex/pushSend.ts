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

export const toTrip = internalAction({
  args: { tripId: v.id("trips"), notice, excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, { tripId, notice: item, excludeUserId }): Promise<{ sent: number }> => {
    const rows: Doc<"webPushSubscriptions">[] = await ctx.runQuery(internal.push.subscriptions, { tripId, excludeUserId });
    return deliver(ctx, tripId, item, rows);
  },
});

export const toEndpoint = internalAction({
  args: { tripId: v.id("trips"), endpoint: v.string(), notice },
  handler: async (ctx, { tripId, endpoint, notice: item }): Promise<{ sent: number }> => {
    const rows: Doc<"webPushSubscriptions">[] = await ctx.runQuery(internal.push.subscriptions, { tripId, endpoint });
    return deliver(ctx, tripId, item, rows);
  },
});
