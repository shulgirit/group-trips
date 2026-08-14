import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { PLACE_CATEGORIES } from "@/types";

export const maxDuration = 120;

const RequestSchema = z.object({
  url: z.string().url(),
});

const DraftSchema = z.object({
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
          "סיכום קצר בעברית של מה שגולשים/מבקרים אומרים, על בסיס קטעי הביקורות שסופקו. ריק אם אין ביקורות",
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
    metadata?: { title?: string; ogImage?: string; sourceURL?: string };
  };
}

interface SearchResult {
  data?: { web?: { title?: string; description?: string; url?: string }[] };
}

async function geocode(query: string): Promise<{
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
          "X-Goog-FieldMask":
            "places.formattedAddress,places.location",
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

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.FIRECRAWL_API_KEY || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let url: string;
  try {
    ({ url } = RequestSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // 1. Scrape the page
  const scrape = await firecrawl<ScrapeResult>(
    "/scrape",
    { url, formats: ["markdown"], onlyMainContent: true },
    45_000
  );
  const markdown = scrape?.data?.markdown;
  if (!markdown) {
    return NextResponse.json({ error: "scrape_failed" }, { status: 502 });
  }
  const pageTitle = scrape?.data?.metadata?.title ?? "";
  const ogImage = scrape?.data?.metadata?.ogImage;

  // 2. Best-effort review snippets from the web
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

  // 3. Structured extraction in Hebrew
  try {
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "אתה עוזר של אפליקציית טיול משפחתי בסיציליה. חלץ מהדף מידע מובנה על המקום. אל תמציא — שדה שאין לו מידע בדף, השאר מחרוזת ריקה. טקסטים חופשיים (summary, tips, reviewsSummary, popularDishes) בעברית.",
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
      response_format: {
        type: "json_schema",
        json_schema: EXTRACT_JSON_SCHEMA,
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("empty_completion");
    const draft = DraftSchema.parse(JSON.parse(raw));

    // 4. Coordinates via Places text search
    const geo = await geocode(
      draft.address || `${draft.name} ${draft.area}`
    );

    return NextResponse.json({
      draft: {
        ...draft,
        website:
          draft.website && /^https?:\/\//.test(draft.website)
            ? draft.website
            : url,
        bookingUrl: /^https?:\/\//.test(draft.bookingUrl)
          ? draft.bookingUrl
          : "",
        imageUrl: typeof ogImage === "string" && /^https:\/\//.test(ogImage) ? ogImage : "",
        address: draft.address || geo?.address || "",
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        sourceUrl: url,
      },
    });
  } catch (error) {
    console.error("[import/place]", error);
    return NextResponse.json({ error: "extract_failed" }, { status: 502 });
  }
}
