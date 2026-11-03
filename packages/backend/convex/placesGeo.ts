import { geocodePlace } from "@together/integrations/import-place";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { fail, requireMember } from "./lib/authz";
import { regionOf } from "./events";

/** Reads what the lookup needs; the caller must be a member of the trip. */
export const access = internalQuery({
  args: { tripId: v.id("trips"), placeId: v.id("places") },
  handler: async (ctx, { tripId, placeId }) => {
    const { trip } = await requireMember(ctx, tripId);
    const place = await ctx.db.get(placeId);
    if (!place || place.tripId !== tripId) fail("not_found");
    return { name: place.name, address: place.address ?? "", region: regionOf(trip) };
  },
});

/**
 * Moves a saved place's pin after its name or address changed: looks the new text up on Google Maps and stores the
 * coordinates (and the address, unless the person wrote one). Returns false when nothing was found (the pin stays).
 */
export const relocate = action({
  args: { tripId: v.id("trips"), placeId: v.id("places"), query: v.optional(v.string()), queries: v.optional(v.array(v.string())), keepAddress: v.optional(v.boolean()) },
  handler: async (ctx, { tripId, placeId, query, queries, keepAddress }): Promise<{ found: boolean; address?: string }> => {
    const place = await ctx.runQuery(internal.placesGeo.access, { tripId, placeId });
    // Tried in order until Google finds something: the person's own words first (a long venue name next to a town makes Google guess)
    const texts = [...(queries ?? []), ...(query ? [query] : []), `${place.name} ${place.address}`.trim(), place.name].map((text) => text.trim().slice(0, 200)).filter((text, i, all) => text && all.indexOf(text) === i).slice(0, 4);
    let geo: Awaited<ReturnType<typeof geocodePlace>> = null;
    for (const text of texts) {
      geo = await geocodePlace(text, place.region).catch(() => null);
      if (geo) break;
    }
    if (!geo) {
      console.warn("[placesGeo] nothing found for", JSON.stringify(texts));
      return { found: false };
    }
    await ctx.runMutation(internal.places.patchInternal, {
      placeId,
      patch: { lat: geo.lat, lng: geo.lng, ...(keepAddress || !geo.address ? {} : { address: geo.address }) },
    });
    return { found: true, ...(geo.address ? { address: geo.address } : {}) };
  },
});
