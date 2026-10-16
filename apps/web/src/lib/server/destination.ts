import "server-only";

/** Destination lookup for the trip creator (Google Places API New). */

const EURO = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "ME", "XK", "AD", "MC",
  "SM", "VA",
]);

/** Local currency per country (ISO 4217) — popular destinations. */
const COUNTRY_CURRENCY: Record<string, string> = {
  IL: "ILS", US: "USD", GB: "GBP", CH: "CHF", NO: "NOK", SE: "SEK",
  DK: "DKK", IS: "ISK", CZ: "CZK", HU: "HUF", PL: "PLN", RO: "RON",
  BG: "BGN", RS: "RSD", AL: "ALL", MK: "MKD", BA: "BAM", GE: "GEL",
  AM: "AMD", AZ: "AZN", TR: "TRY", AE: "AED", JO: "JOD", EG: "EGP",
  MA: "MAD", TH: "THB", VN: "VND", KH: "KHR", LA: "LAK", MM: "MMK",
  ID: "IDR", MY: "MYR", SG: "SGD", PH: "PHP", JP: "JPY", KR: "KRW",
  CN: "CNY", HK: "HKD", TW: "TWD", IN: "INR", LK: "LKR", NP: "NPR",
  MV: "MVR", AU: "AUD", NZ: "NZD", CA: "CAD", MX: "MXN", BR: "BRL",
  AR: "ARS", CL: "CLP", PE: "PEN", CO: "COP", CR: "CRC", ZA: "ZAR",
  KE: "KES", TZ: "TZS", SC: "SCR", MU: "MUR", UA: "UAH",
  UZ: "UZS", KZ: "KZT", CU: "CUP", DO: "DOP",
};

export function currencyFor(country: string): string {
  if (EURO.has(country)) return "EUR";
  return COUNTRY_CURRENCY[country] ?? "USD";
}

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
  VN: "Asia/Ho_Chi_Minh", KH: "Asia/Phnom_Penh", LA: "Asia/Vientiane",
  SG: "Asia/Singapore", MY: "Asia/Kuala_Lumpur", IN: "Asia/Kolkata",
  JO: "Asia/Amman", EG: "Africa/Cairo", MA: "Africa/Casablanca",
  US: "America/New_York", MX: "America/Mexico_City", AL: "Europe/Tirane",
};


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

async function autocompleteRequest(input: string, types: string[] | null) {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
    body: JSON.stringify({
      input,
      languageCode: "he",
      // Google allows at most 5 types — more and the whole request fails
      ...(types ? { includedPrimaryTypes: types } : {}),
    }),
  });
  if (!response.ok) {
    console.error("[destination] autocomplete", response.status, (await response.text()).slice(0, 200));
    return [];
  }
  const data = await response.json();
  return (data.suggestions ?? []) as {
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
}

export async function autocompleteDestination(
  input: string
): Promise<DestinationSuggestion[]> {
  let suggestions = await autocompleteRequest(input, [
    "locality",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "country",
    "natural_feature",
  ]);
  // Islands, regions with unusual types, landmarks: fall back to any place
  if (!suggestions.length) suggestions = await autocompleteRequest(input, null);
  return suggestions
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
  currency: string;
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
