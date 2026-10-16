import OpenAI from "openai";
import { z } from "zod";
import { geocodePlace, ImportError, importPlaceFromUrl, type PlaceDraft } from "./import-place";

/**
 * Place enrichment: the official website (saved, pasted or discovered) via
 * Firecrawl, verified model knowledge as a fallback, a Google photo when
 * missing. Returns the field updates; the caller stores them. Behavior and
 * copy match the Firebase version (lib/server/enrich.ts).
 */

export interface EnrichablePlace {
  name: string;
  area?: string;
  website?: string;
  sourceUrl?: string;
  imageUrl?: string;
  bookingUrl?: string;
  address?: string;
  lat?: number | null;
}

export type PlaceUpdates = Partial<{
  summary: string;
  openingHours: string;
  priceNotes: string;
  tips: string;
  popularDishes: string;
  reviewsSummary: string;
  recommendedDurationMin: number;
  imageUrl: string;
  bookingUrl: string;
  website: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
}>;

export interface EnrichResult {
  ok: boolean;
  message: string;
  updates: PlaceUpdates;
}

const AGGREGATORS = /tripadvisor|facebook|instagram|booking\.com|expedia|google\.|wikipedia|youtube|tiktok/i;

async function findOfficialUrl(region: string, name: string, area?: string): Promise<string | null> {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `${name} ${area ?? ""} ${region} official website`, limit: 5 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: { web?: { url?: string }[] } };
    const urls = (data.data?.web ?? []).map((r) => r.url).filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
    return urls.find((u) => !AGGREGATORS.test(u)) ?? urls[0] ?? null;
  } catch {
    return null;
  }
}

const KnowledgeSchema = z.object({
  known: z.boolean(),
  summary: z.string(),
  tips: z.string(),
  priceNotes: z.string(),
  recommendedDurationMin: z.number().nullable(),
  popularDishes: z.string(),
});

/** Last resort: the model's own knowledge, gated hard against invention. */
async function knowledgeEnrich(region: string, audience: string, name: string, area: string | undefined, locale: "he" | "en") {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const completion = await new OpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `אתה עוזר טיולים. אם אתה מזהה בביטחון גבוה את המקום הספציפי הזה ב${region} — כתוב עליו תוכן שימושי בעברית ${audience}. אם אינך בטוח שאתה מכיר את המקום המדויק — החזר known=false ואל תמציא כלום. אל תנחש שעות פתיחה או מחירים מדויקים; עדיף שדה ריק.${locale === "en" ? " Write all text fields in English, not Hebrew." : ""}`,
        },
        { role: "user", content: `המקום: ${name}${area ? `, ${area}` : ""}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "place_knowledge",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              known: { type: "boolean" },
              summary: { type: "string" },
              tips: { type: "string" },
              priceNotes: { type: "string" },
              recommendedDurationMin: { type: ["number", "null"] },
              popularDishes: { type: "string" },
            },
            required: ["known", "summary", "tips", "priceNotes", "recommendedDurationMin", "popularDishes"],
          },
        },
      },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = KnowledgeSchema.parse(JSON.parse(raw));
    return parsed.known && parsed.summary ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeDraft(existing: EnrichablePlace, draft: Partial<PlaceDraft>, sourceUrl?: string): PlaceUpdates {
  const updates: PlaceUpdates = {};
  for (const field of ["summary", "openingHours", "priceNotes", "tips", "popularDishes", "reviewsSummary"] as const) {
    const value = draft[field];
    if (value) updates[field] = value;
  }
  if (draft.recommendedDurationMin) updates.recommendedDurationMin = draft.recommendedDurationMin;
  if (draft.imageUrl && !existing.imageUrl) updates.imageUrl = draft.imageUrl;
  if (draft.bookingUrl && !existing.bookingUrl) updates.bookingUrl = draft.bookingUrl;
  if (draft.website && !existing.website) updates.website = draft.website;
  if (draft.address && !existing.address) updates.address = draft.address;
  if (existing.lat == null && draft.lat != null) {
    updates.lat = draft.lat;
    updates.lng = draft.lng ?? null;
  }
  if (sourceUrl) updates.sourceUrl = sourceUrl;
  return updates;
}

export async function enrichPlace(
  existing: EnrichablePlace,
  options: { region: string; shortName: string; audience: string; explicitUrl?: string; locale: "he" | "en" }
): Promise<EnrichResult> {
  const { region, locale } = options;
  const explicit = options.explicitUrl && /^https?:\/\//.test(options.explicitUrl) ? options.explicitUrl : null;
  let updates: PlaceUpdates = {};
  let source = "";

  // 1) A website — saved, provided, or discovered on the web
  const url = explicit ?? existing.website ?? existing.sourceUrl ?? (await findOfficialUrl(region, existing.name, existing.area));
  if (url) {
    try {
      const draft = await importPlaceFromUrl(url, region, locale);
      updates = mergeDraft(existing, draft, url);
      source = locale === "en" ? "official website" : "האתר הרשמי";
    } catch (error) {
      if (!(error instanceof ImportError)) throw error;
    }
    // A hand-pasted link is authoritative — keep it on the place
    if (explicit) {
      updates.website = explicit;
      updates.sourceUrl = explicit;
    }
  }

  // 2) Model knowledge fallback when the web gave us nothing
  if (!("summary" in updates) && !("tips" in updates)) {
    const knowledge = await knowledgeEnrich(options.shortName, options.audience, existing.name, existing.area, locale);
    if (knowledge) {
      updates = {
        ...mergeDraft(existing, {
          summary: knowledge.summary,
          tips: knowledge.tips,
          priceNotes: knowledge.priceNotes,
          popularDishes: knowledge.popularDishes,
          recommendedDurationMin: knowledge.recommendedDurationMin,
        }),
        ...updates,
      };
      source = source || (locale === "en" ? "verified general knowledge" : "ידע כללי מאומת");
    }
  }

  // 3) A real photo if the place still has none
  if (!existing.imageUrl && !updates.imageUrl) {
    const geo = await geocodePlace(`${existing.name} ${existing.area ?? ""}`.trim());
    if (geo?.photoUrl) {
      updates.imageUrl = geo.photoUrl;
      if (existing.lat == null && geo.lat != null) {
        updates.lat = geo.lat;
        updates.lng = geo.lng;
      }
    }
  }

  const count = Object.keys(updates).length;
  if (!count) {
    return {
      ok: false,
      updates,
      message:
        locale === "en"
          ? `Couldn't find more about "${existing.name}" on its website or elsewhere. Paste a link to its website in the field below and I'll read it.`
          : `לא הצלחתי למצוא מידע נוסף על ״${existing.name}״ — לא באתר ולא במקורות אחרים. הדביקו קישור לאתר בשדה שנפתח כאן למטה ואקרא ממנו`,
    };
  }
  return {
    ok: true,
    updates,
    message:
      locale === "en"
        ? `"${existing.name}" updated (source: ${source || "Google"}): ${count} fields`
        : `״${existing.name}״ הועשר (מקור: ${source || "Google"}) — ${count} שדות עודכנו`,
  };
}
