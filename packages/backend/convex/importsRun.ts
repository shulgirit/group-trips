import { extractBookings } from "@together/integrations/booking";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { bookingItem } from "./lib/validators";

/** The AI extraction behind imports.fromFile / fromText. */

export const forExtraction = internalQuery({
  args: { importId: v.id("imports") },
  handler: async (ctx, { importId }) => {
    const row = await ctx.db.get(importId);
    const trip = row ? await ctx.db.get(row.tripId) : null;
    return row && trip ? { row, tripHint: `${trip.name}, ${trip.stops[0]?.label ?? trip.destination.label}, ${trip.startDate} – ${trip.endDate}` } : null;
  },
});

export const finish = internalMutation({
  args: {
    importId: v.id("imports"),
    items: v.array(bookingItem),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { importId, items, error }) => {
    if (!(await ctx.db.get(importId))) return;
    await ctx.db.patch(importId, error ? { status: "failed", error, items: [] } : items.length ? { status: "review", items } : { status: "failed", error: "none_found", items: [] });
  },
});

function toBase64(bytes: ArrayBuffer): string {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

export const extract = internalAction({
  args: { importId: v.id("imports"), locale: v.string(), text: v.optional(v.string()) },
  handler: async (ctx, { importId, locale, text }): Promise<void> => {
    const found = await ctx.runQuery(internal.importsRun.forExtraction, { importId });
    if (!found) return;
    if (!process.env.OPENAI_API_KEY) {
      await ctx.runMutation(internal.importsRun.finish, { importId, items: [], error: "not_configured" });
      return;
    }
    try {
      let file: { base64: string; contentType: string; fileName: string } | undefined;
      if (found.row.storageId) {
        const blob = await ctx.storage.get(found.row.storageId);
        if (!blob) throw new Error("missing_file");
        file = { base64: toBase64(await blob.arrayBuffer()), contentType: found.row.contentType, fileName: found.row.fileName };
      }
      const items: Infer<typeof bookingItem>[] = await extractBookings({
        english: locale !== "he",
        text,
        file,
        tripHint: found.tripHint,
      });
      await ctx.runMutation(internal.importsRun.finish, { importId, items });
    } catch (error) {
      console.error("[imports] extract failed", error);
      await ctx.runMutation(internal.importsRun.finish, { importId, items: [], error: "unreadable" });
    }
  },
});
