import type { PlaceCategory } from "@together/shared/types";

/** Google Places text search for the "add a place by name" flow (top 3, with photos). */

function mapCategory(types: string[], primaryType?: string): PlaceCategory {
  const all = [...types, primaryType ?? ""].map((t) => t.toLowerCase());
  const has = (needle: string) => all.some((t) => t.includes(needle));
  if (has("stadium") || has("sports") || has("gym")) return "sport";
  if (has("ice_cream")) return "icecream";
  if (has("restaurant") || has("cafe") || has("bakery") || has("bar") || has("food")) return "restaurant";
  if (has("lodging") || has("hotel") || has("resort")) return "accommodation";
  if (has("beach")) return "beach";
  if (has("supermarket") || has("grocery")) return "supermarket";
  if (has("shopping") || has("store") || has("market")) return "shopping";
  if (has("parking")) return "parking";
  return "attraction";
}

/** The city from an Italian-style address ("..., 90145 Cinisi PA, Italy"). */
function extractArea(address: string): string {
  return address.match(/\d{5}\s+([^,]+?)(?:\s+[A-Z]{2})?,/)?.[1]?.trim() ?? "";
}

export interface PlaceSearchResult {
  name: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  category: PlaceCategory;
  website: string;
  rating: number | null;
  imageUrl: string;
}

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  websiteUri?: string;
  rating?: number;
  photos?: { name: string }[];
}

export async function searchPlaces(query: string, region: string): Promise<PlaceSearchResult[] | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) return null;
  const search = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.websiteUri,places.photos,places.rating",
    },
    body: JSON.stringify({ textQuery: `${query} ${region}`, pageSize: 3 }),
  });
  if (!search.ok) return null;
  const data = (await search.json()) as { places?: GooglePlace[] };
  return Promise.all(
    (data.places ?? []).slice(0, 3).map(async (place) => {
      let imageUrl = "";
      const photoName = place.photos?.[0]?.name;
      if (photoName) {
        try {
          const media = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${key}`);
          if (media.ok) {
            const { photoUri } = (await media.json()) as { photoUri?: unknown };
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
    })
  );
}
