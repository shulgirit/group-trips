import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import type { PlaceCategory } from "@/types";

const RequestSchema = z.object({
  query: z.string().trim().min(2).max(120),
});

/** Maps Google place types to our trip categories. */
function mapCategory(types: string[], primaryType?: string): PlaceCategory {
  const all = [...types, primaryType ?? ""].map((t) => t.toLowerCase());
  const has = (needle: string) => all.some((t) => t.includes(needle));

  if (has("stadium") || has("sports") || has("gym")) return "sport";
  if (has("ice_cream")) return "icecream";
  if (has("restaurant") || has("cafe") || has("bakery") || has("bar") || has("food"))
    return "restaurant";
  if (has("lodging") || has("hotel") || has("resort")) return "accommodation";
  if (has("beach")) return "beach";
  if (has("supermarket") || has("grocery")) return "supermarket";
  if (has("shopping") || has("store") || has("market")) return "shopping";
  if (has("parking")) return "parking";
  return "attraction";
}

/** Pulls the city out of an Italian formatted address ("..., 90145 Cinisi PA, Italy"). */
function extractArea(address: string): string {
  const match = address.match(/\d{5}\s+([^,]+?)(?:\s+[A-Z]{2})?,/);
  return match?.[1]?.trim() ?? "";
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let query: string;
  try {
    ({ query } = RequestSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const search = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.websiteUri,places.photos,places.rating",
      },
      body: JSON.stringify({ textQuery: `${query} Sicily`, pageSize: 3 }),
    }
  );
  if (!search.ok) {
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
  const data = await search.json();

  const results = await Promise.all(
    (data.places ?? []).slice(0, 3).map(
      async (place: {
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        types?: string[];
        primaryType?: string;
        websiteUri?: string;
        rating?: number;
        photos?: { name: string }[];
      }) => {
        let imageUrl = "";
        const photoName = place.photos?.[0]?.name;
        if (photoName) {
          try {
            const media = await fetch(
              `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${key}`
            );
            if (media.ok) {
              const { photoUri } = await media.json();
              if (typeof photoUri === "string") imageUrl = photoUri;
            }
          } catch {
            // photo is optional
          }
        }
        const address = place.formattedAddress ?? "";
        return {
          name: place.displayName?.text ?? query,
          address,
          area: extractArea(address),
          lat: place.location?.latitude ?? null,
          lng: place.location?.longitude ?? null,
          category: mapCategory(place.types ?? [], place.primaryType),
          website: place.websiteUri ?? "",
          rating: place.rating ?? null,
          imageUrl,
        };
      }
    )
  );

  return NextResponse.json({ results });
}
