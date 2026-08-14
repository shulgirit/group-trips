import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { PLACE_CATEGORIES } from "@/types";

/** Shared Firecrawl → OpenAI → geocode pipeline, used by the import API
 *  route and by the AI agent's enrich_place tool. */

export const PlaceDraftSchema = z.object({
  name: z.string().min(1),
  category: z.enum(Object.keys(PLACE_CATEGORIES) as [string, ...string[]]),
  area: z.string(),
  address: z.string(),
  summary: z.string(),
  openingHours: z.string(),
  priceNotes: z.string(),
  recommendedDurationMin: z.number().nullable(),
  tips: z.string(),
  popularDishes: z.string(),
  reviewsSummary: z.string(),
  website: z.string(),
  bookingUrl: z.string(),
});

export interface PlaceDraft extends z.infer<typeof PlaceDraftSchema> {
  imageUrl: string;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
}

const EXTRACT_JSON_SCHEMA = {
  name: "place_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      category: { type: "string", enum: Object.keys(PLACE_CATEGORIES) },
      area: { type: "string", description: "אזור/עיר בסיציליה, בעברית אם אפשר" },
      address: { type: "string", description: "כתובת מלאה אם מופיעה בדף" },
      summary: {
        type: "string",
        description: "תיאור בעברית, 2-4 משפטים, למשפחות ישראליות",
      },
      openingHours: { type: "string", description: "שעות פתיחה אם מופיעות" },
      priceNotes: { type: "string", description: "מחירים/טווח מחירים אם מופיעים" },
      recommendedDurationMin: {
        type: ["number", "null"],
        description: "משך ביקור מומלץ בדקות",
      },
      tips: { type: "string", description: "טיפים שימושיים בעברית" },
      popularDishes: {
        type: "string",
        description: "למסעדות: מנות שמומלצות/מוזכרות, בעברית. אחרת ריק",
      },
      reviewsSummary: {
        type: "string",
        description:
          "סיכום קצר בעברית של מה שגולשים אומרים, על בסיס קטעי הביקורות שסופקו. ריק אם אין",
      },
      website: { type: "string" },
      bookingUrl: { type: "string", description: "קישור הזמנה/כרטיסים אם קיים" },
    },
    required: [
      "name",
      "category",
      "area",
      "address",
      "summary",
      "openingHours",
      "priceNotes",
      "recommendedDurationMin",
      "tips",
      "popularDishes",
      "reviewsSummary",
      "website",
      "bookingUrl",
    ],
  },
} as const;

async function firecrawl<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`https://api.firecrawl.dev/v2${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      console.error(`[import] firecrawl ${path} ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[import] firecrawl ${path} failed`, error);
    return null;
  }
}

interface ScrapeResult {
  data?: {
    markdown?: string;
    metadata?: { title?: string; ogImage?: string };
  };
}

interface SearchResult {
  data?: { web?: { title?: string; description?: string }[] };
}

export async function geocodePlace(query: string): Promise<{
  lat: number;
  lng: number;
  address?: string;
} | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key || !query.trim()) return null;
  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.formattedAddress,places.location",
        },
        body: JSON.stringify({ textQuery: `${query} Sicily` }),
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const place = data.places?.[0];
    if (!place) return null;
    return {
      lat: place.location.latitude,
      lng: place.location.longitude,
      address: place.formattedAddress,
    };
  } catch {
    return null;
  }
}

export class ImportError extends Error {
  constructor(public reason: "scrape_failed" | "extract_failed") {
    super(reason);
  }
}

/** Scrapes a URL, hunts for reviews, extracts a Hebrew place draft. */
export async function importPlaceFromUrl(url: string): Promise<PlaceDraft> {
  if (!process.env.FIRECRAWL_API_KEY || !process.env.OPENAI_API_KEY) {
    throw new ImportError("scrape_failed");
  }

  const scrape = await firecrawl<ScrapeResult>(
    "/scrape",
    { url, formats: ["markdown"], onlyMainContent: true },
    45_000
  );
  const markdown = scrape?.data?.markdown;
  if (!markdown) throw new ImportError("scrape_failed");

  const pageTitle = scrape?.data?.metadata?.title ?? "";
  const ogImage = scrape?.data?.metadata?.ogImage;

  const search = pageTitle
    ? await firecrawl<SearchResult>(
        "/search",
        { query: `"${pageTitle}" reviews tripadvisor`, limit: 4 },
        15_000
      )
    : null;
  const reviewSnippets = (search?.data?.web ?? [])
    .map((r) => `- ${r.title}: ${r.description ?? ""}`)
    .join("\n");

  try {
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "אתה עוזר של אפליקציית טיול משפחתי בסיציליה. חלץ מהדף מידע מובנה על המקום. אל תמציא — שדה שאין לו מידע בדף, השאר מחרוזת ריקה. טקסטים חופשיים בעברית.",
        },
        {
          role: "user",
          content: `הדף (${url}):\n\n${markdown.slice(0, 24_000)}\n\n${
            reviewSnippets
              ? `קטעי ביקורות מחיפוש ברשת:\n${reviewSnippets}`
              : "(אין קטעי ביקורות)"
          }`,
        },
      ],
      response_format: { type: "json_schema", json_schema: EXTRACT_JSON_SCHEMA },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("empty");
    const draft = PlaceDraftSchema.parse(JSON.parse(raw));

    const geo = await geocodePlace(draft.address || `${draft.name} ${draft.area}`);

    return {
      ...draft,
      website:
        draft.website && /^https?:\/\//.test(draft.website) ? draft.website : url,
      bookingUrl: /^https?:\/\//.test(draft.bookingUrl) ? draft.bookingUrl : "",
      imageUrl:
        typeof ogImage === "string" && /^https:\/\//.test(ogImage) ? ogImage : "",
      address: draft.address || geo?.address || "",
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      sourceUrl: url,
    };
  } catch (error) {
    if (error instanceof ImportError) throw error;
    console.error("[import] extract failed", error);
    throw new ImportError("extract_failed");
  }
}
