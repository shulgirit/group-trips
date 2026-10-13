import "server-only";

/** Destination lookup for the trip creator (Google Places API New). */

const EURO = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "ME", "XK", "AD", "MC",
  "SM", "VA",
]);

/** Fallback zones when the Time Zone API is unavailable. */
const COUNTRY_TZ: Record<string, string> = {
  IT: "Europe/Rome", FR: "Europe/Paris", ES: "Europe/Madrid", PT: "Europe/Lisbon",
  GR: "Europe/Athens", CY: "Asia/Nicosia", DE: "Europe/Berlin", AT: "Europe/Vienna",
  NL: "Europe/Amsterdam", BE: "Europe/Brussels", CH: "Europe/Zurich",
  GB: "Europe/London", IE: "Europe/Dublin", HR: "Europe/Zagreb", ME: "Europe/Podgorica",
  HU: "Europe/Budapest", CZ: "Europe/Prague", PL: "Europe/Warsaw", RO: "Europe/Bucharest",
  BG: "Europe/Sofia", GE: "Asia/Tbilisi", TR: "Europe/Istanbul", IL: "Asia/Jerusalem",
  AE: "Asia/Dubai", TH: "Asia/Bangkok", JP: "Asia/Tokyo", MT: "Europe/Malta",
  SI: "Europe/Ljubljana", NO: "Europe/Oslo", SE: "Europe/Stockholm",
  DK: "Europe/Copenhagen", FI: "Europe/Helsinki", IS: "Atlantic/Reykjavik",
};

export function currencyFor(country: string): "EUR" | "ILS" | "USD" {
  if (EURO.has(country)) return "EUR";
  if (country === "IL") return "ILS";
  return "USD";
}

function key(): string {
  const value = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!value) throw new Error("not_configured");
  return value;
}

export interface DestinationSuggestion {
  placeId: string;
  label: string;
  secondary: string;
}

export async function autocompleteDestination(
  input: string
): Promise<DestinationSuggestion[]> {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
      body: JSON.stringify({
        input,
        languageCode: "he",
        includedPrimaryTypes: [
          "locality",
          "administrative_area_level_1",
          "administrative_area_level_2",
          "country",
          "island",
          "natural_feature",
        ],
      }),
    }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return ((data.suggestions ?? []) as {
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 6)
    .map((p) => ({
      placeId: p.placeId,
      label: p.structuredFormat?.mainText?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export interface ResolvedDestination {
  label: string;
  placeId: string;
  lat: number;
  lng: number;
  region: string;
  country: string;
  timezone: string;
  currency: "EUR" | "ILS" | "USD";
  coverImage: string | null;
}

async function timezoneAt(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${key()}`
    );
    const data = await response.json();
    return data.status === "OK" ? String(data.timeZoneId) : null;
  } catch {
    return null;
  }
}

async function photoUrl(photoName: string | undefined): Promise<string | null> {
  if (!photoName) return null;
  try {
    const media = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1600&skipHttpRedirect=true&key=${key()}`
    );
    if (!media.ok) return null;
    const { photoUri } = await media.json();
    return typeof photoUri === "string" && photoUri.startsWith("https://")
      ? photoUri
      : null;
  } catch {
    return null;
  }
}

export async function resolveDestination(
  placeId: string
): Promise<ResolvedDestination | null> {
  const [he, en] = await Promise.all(
    ["he", "en"].map((language) =>
      fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${language}`,
        {
          headers: {
            "X-Goog-Api-Key": key(),
            "X-Goog-FieldMask":
              "id,displayName,location,addressComponents,photos",
          },
        }
      ).then((r) => (r.ok ? r.json() : null))
    )
  );
  if (!he?.location) return null;
  const lat = Number(he.location.latitude);
  const lng = Number(he.location.longitude);
  const country =
    ((he.addressComponents ?? []) as { shortText?: string; types?: string[] }[]).find(
      (c) => c.types?.includes("country")
    )?.shortText ?? "";
  const [timezone, cover] = await Promise.all([
    timezoneAt(lat, lng),
    photoUrl(he.photos?.[0]?.name),
  ]);
  return {
    label: String(he.displayName?.text ?? ""),
    placeId,
    lat,
    lng,
    // Latin name works best appended to Places/Waze searches
    region: String(en?.displayName?.text ?? he.displayName?.text ?? ""),
    country,
    timezone: timezone ?? COUNTRY_TZ[country] ?? "UTC",
    currency: currencyFor(country),
    coverImage: cover,
  };
}
