import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import {
  ImportError,
  geocodePlace,
  importPlaceFromUrl,
  type PlaceDraft,
} from "@/lib/server/import-place";
import { TRIP_PATH } from "@/lib/trip";

export interface EnrichResult {
  ok: boolean;
  message: string;
  updatedFields?: string[];
}

const AGGREGATORS =
  /tripadvisor|facebook|instagram|booking\.com|expedia|google\.|wikipedia|youtube|tiktok/i;

/** Finds an official-looking website for a place via Firecrawl search. */
async function findOfficialUrl(
  name: string,
  area?: string
): Promise<string | null> {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${name} ${area ?? ""} Sicily official website`,
        limit: 5,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json();
    const results: { url?: string }[] = data?.data?.web ?? [];
    const urls = results
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
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
async function knowledgeEnrich(
  name: string,
  area?: string
): Promise<z.infer<typeof KnowledgeSchema> | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "אתה עוזר טיולים. אם אתה מזהה בביטחון גבוה את המקום הספציפי הזה בסיציליה — כתוב עליו תוכן שימושי בעברית למשפחות. אם אינך בטוח שאתה מכיר את המקום המדויק — החזר known=false ואל תמציא כלום. אל תנחש שעות פתיחה או מחירים מדויקים; עדיף שדה ריק.",
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
            required: [
              "known",
              "summary",
              "tips",
              "priceNotes",
              "recommendedDurationMin",
              "popularDishes",
            ],
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

function mergeDraft(
  existing: Record<string, unknown>,
  draft: Partial<PlaceDraft> & { imageUrl?: string },
  sourceUrl?: string
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const field of [
    "summary",
    "openingHours",
    "priceNotes",
    "tips",
    "popularDishes",
    "reviewsSummary",
  ] as const) {
    if (draft[field]) updates[field] = draft[field];
  }
  if (draft.recommendedDurationMin) {
    updates.recommendedDurationMin = draft.recommendedDurationMin;
  }
  if (draft.imageUrl && !existing.imageUrl) updates.imageUrl = draft.imageUrl;
  if (draft.bookingUrl && !existing.bookingUrl) {
    updates.bookingUrl = draft.bookingUrl;
  }
  if (draft.website && !existing.website) updates.website = draft.website;
  if (draft.address && !existing.address) updates.address = draft.address;
  if (existing.lat == null && draft.lat != null) {
    updates.lat = draft.lat;
    updates.lng = draft.lng;
  }
  if (sourceUrl) updates.sourceUrl = sourceUrl;
  return updates;
}

/**
 * Enriches a saved place: official website (saved or discovered) via
 * Firecrawl, verified model knowledge as fallback, Google photo when the
 * place has no image. Honest failure when nothing solid is found.
 */
export async function enrichSavedPlace(
  placeId: string,
  explicitUrl?: string
): Promise<EnrichResult> {
  const placeRef = adminDb().doc(`${TRIP_PATH}/places/${placeId}`);
  const snapshot = await placeRef.get();
  if (!snapshot.exists) return { ok: false, message: "המקום לא נמצא" };
  const existing = snapshot.data() as Record<string, unknown>;
  const name = String(existing.name ?? "");
  const area = existing.area ? String(existing.area) : undefined;

  let updates: Record<string, unknown> = {};
  let source = "";

  // 1) A website — saved, provided, or discovered on the web
  let url =
    (explicitUrl && /^https?:\/\//.test(explicitUrl) ? explicitUrl : null) ??
    (existing.website as string | undefined) ??
    (existing.sourceUrl as string | undefined) ??
    null;
  if (!url) {
    url = await findOfficialUrl(name, area);
  }

  if (url) {
    try {
      const draft = await importPlaceFromUrl(url);
      updates = mergeDraft(existing, draft, url);
      source = "האתר הרשמי";
    } catch (error) {
      if (!(error instanceof ImportError)) throw error;
    }
  }

  // 2) Model knowledge fallback when the web gave us nothing
  if (!Object.keys(updates).some((k) => k === "summary" || k === "tips")) {
    const knowledge = await knowledgeEnrich(name, area);
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
      source = source || "ידע כללי מאומת";
    }
  }

  // 3) A real photo if the place still has none
  if (!existing.imageUrl && !updates.imageUrl) {
    const geo = await geocodePlace(`${name} ${area ?? ""}`.trim());
    if (geo?.photoUrl) {
      updates.imageUrl = geo.photoUrl;
      if (existing.lat == null && geo.lat != null) {
        updates.lat = geo.lat;
        updates.lng = geo.lng;
      }
    }
  }

  const updatedFields = Object.keys(updates);
  if (!updatedFields.length) {
    return {
      ok: false,
      message: `לא הצלחתי למצוא מידע נוסף על ״${name}״ — לא באתר ולא במקורות אחרים. אפשר להדביק קישור ידנית בעריכת המקום`,
    };
  }

  await placeRef.update(updates);
  return {
    ok: true,
    message: `״${name}״ הועשר (מקור: ${source || "Google"}) — ${updatedFields.length} שדות עודכנו`,
    updatedFields,
  };
}
