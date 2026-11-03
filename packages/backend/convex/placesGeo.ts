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
  args: { tripId: v.id("trips"), placeId: v.id("places"), query: v.optional(v.string()), keepAddress: v.optional(v.boolean()) },
  handler: async (ctx, { tripId, placeId, query, keepAddress }): Promise<{ found: boolean; address?: string }> => {
    const place = await ctx.runQuery(internal.placesGeo.access, { tripId, placeId });
    const text = (query?.trim() || `${place.name} ${place.address}`.trim()).slice(0, 200);
    if (!text) return { found: false };
    const geo = await geocodePlace(text, place.region).catch(() => null);
    if (!geo) return { found: false };
    await ctx.runMutation(internal.places.patchInternal, {
      placeId,
      patch: { lat: geo.lat, lng: geo.lng, ...(keepAddress || !geo.address ? {} : { address: geo.address }) },
    });
    return { found: true, ...(geo.address ? { address: geo.address } : {}) };
  },
});
