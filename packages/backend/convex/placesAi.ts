import { contentLocale, isLocale, type Locale } from "@together/i18n/config";
import { placeBriefing } from "@together/integrations/assist";
import { enrichPlace } from "@together/integrations/enrich";
import { ImportError, importPlaceFromUrl, type PlaceDraft } from "@together/integrations/import-place";
import { type PlaceSearchResult, searchPlaces } from "@together/integrations/place-search";
import { GROUP_KINDS } from "@together/shared/trip-doc";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { regionOf } from "./events";

/** AI and Google lookups behind the add-place and place-detail screens. */

const lang = (locale: string | undefined): Locale => (isLocale(locale) ? locale : "he");
const shortName = (trip: Doc<"trips">) => trip.stops[0]?.label ?? trip.destination.label;

/** "From a link": scrape + extract a draft place (not saved yet). */
export const draftFromUrl = action({
  args: { tripId: v.id("trips"), url: v.string(), locale: v.optional(v.string()) },
  handler: async (ctx, { tripId, url, locale }): Promise<PlaceDraft> => {
    const { trip } = await ctx.runQuery(internal.access.member, { tripId });
    if (!/^https?:\/\//.test(url)) throw new ConvexError({ code: "invalid", detail: "url" });
    try {
      return await importPlaceFromUrl(url, regionOf(trip), contentLocale(lang(locale)));
    } catch (error) {
      throw new ConvexError({ code: "invalid", detail: error instanceof ImportError ? error.reason : "extract_failed" });
    }
  },
});

/** "By name": top Google matches with photos. */
export const search = action({
  args: { tripId: v.id("trips"), query: v.string() },
  handler: async (ctx, { tripId, query }): Promise<PlaceSearchResult[]> => {
    const { trip } = await ctx.runQuery(internal.access.member, { tripId });
    const text = query.trim();
    if (text.length < 2 || text.length > 120) throw new ConvexError({ code: "invalid", detail: "query" });
    const results = await searchPlaces(text, regionOf(trip));
    if (!results) throw new ConvexError({ code: "invalid", detail: "search_failed" });
    return results;
  },
});

/** Fills a saved place from its website / the web / model knowledge. */
export const enrich = action({
  args: { tripId: v.id("trips"), placeId: v.id("places"), url: v.optional(v.string()), locale: v.optional(v.string()) },
  handler: async (ctx, { tripId, placeId, url, locale }): Promise<{ ok: boolean; message: string; updatedFields: string[] }> => {
    const { trip } = await ctx.runQuery(internal.access.member, { tripId });
    const place = await ctx.runQuery(internal.chat.placeForEnrich, { placeId });
    if (!place || place.tripId !== tripId) throw new ConvexError({ code: "not_found" });
    const result = await enrichPlace(place, {
      region: regionOf(trip),
      shortName: shortName(trip),
      audience: trip.legacyKey === "sicily" ? "למשפחות" : "למטיילים",
      explicitUrl: url?.trim(),
      locale: contentLocale(lang(locale)),
    });
    if (result.ok) await ctx.runMutation(internal.places.patchInternal, { placeId, patch: result.updates });
    return { ok: result.ok, message: result.message, updatedFields: Object.keys(result.updates) };
  },
});

/** "Tell me more" about one recommended place. */
export const briefing = action({
  args: {
    tripId: v.id("trips"),
    name: v.string(),
    area: v.optional(v.string()),
    description: v.optional(v.string()),
    why: v.optional(v.string()),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { trip } = await ctx.runQuery(internal.access.member, { tripId: args.tripId });
    if (!process.env.OPENAI_API_KEY) throw new ConvexError({ code: "invalid", detail: "not_configured" });
    const identity =
      trip.legacyKey === "sicily"
        ? "אתה המשרת של חבורת מיחא — עוזר טיולים לארבע משפחות ישראליות עם ילדים בסיציליה (חלק מהילדים עם שתלים קוכלאריים; ציין שיקולי שמיעה רק אם באמת רלוונטי). ענה בעברית, חם, תמציתי ומעשי. בלי פתיחים מיותרים."
        : trip.legacyKey === "sardinia"
          ? "אתה ״הטייס״ — עוזר טיולים לחמישה חברים מבוגרים שחוגגים 60 בסרדיניה. ענה בעברית, ישיר, תמציתי ומעשי. בלי פתיחים מיותרים."
          : `אתה ״${trip.ai.name}״ — עוזר הטיולים של ${GROUP_KINDS[trip.groupKind].aiDescription} ב${shortName(trip)}. ענה בעברית, חם, תמציתי ומעשי. בלי פתיחים מיותרים.`;
    return placeBriefing({
      identity,
      shortName: shortName(trip),
      name: args.name.slice(0, 120),
      area: args.area?.slice(0, 120),
      description: args.description?.slice(0, 600),
      why: args.why?.slice(0, 600),
      english: lang(args.locale) !== "he",
    });
  },
});
