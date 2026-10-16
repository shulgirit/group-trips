import type { GlobeScene } from "./globe/engine";
import type { TKey } from "@/i18n";

/**
 * Illustrative routes for the hero: where people might fly from, meeting at
 * one destination. Not user data — no counts or names are implied.
 */
const TEL_AVIV = { lat: 32.08, lng: 34.78 };

export const GLOBE_SCENES: (GlobeScene & { label: TKey })[] = [
  {
    id: "sicily",
    label: "landing.places.sicily",
    destination: { lat: 37.6, lng: 14.0 },
    origins: [TEL_AVIV, { lat: 51.5, lng: -0.12 }, { lat: 52.52, lng: 13.4 }, { lat: 40.71, lng: -74.0 }],
  },
  {
    id: "kyoto",
    label: "landing.places.kyoto",
    destination: { lat: 35.01, lng: 135.77 },
    origins: [TEL_AVIV, { lat: -33.87, lng: 151.2 }, { lat: 37.77, lng: -122.42 }, { lat: 1.35, lng: 103.82 }],
  },
  {
    id: "reykjavik",
    label: "landing.places.reykjavik",
    destination: { lat: 64.15, lng: -21.94 },
    origins: [TEL_AVIV, { lat: 40.71, lng: -74.0 }, { lat: 48.86, lng: 2.35 }, { lat: 43.65, lng: -79.38 }],
  },
  {
    id: "bali",
    label: "landing.places.bali",
    destination: { lat: -8.34, lng: 115.09 },
    origins: [TEL_AVIV, { lat: -37.81, lng: 144.96 }, { lat: 19.08, lng: 72.88 }, { lat: 52.37, lng: 4.9 }],
  },
  {
    id: "lisbon",
    label: "landing.places.lisbon",
    destination: { lat: 38.72, lng: -9.14 },
    origins: [TEL_AVIV, { lat: -23.55, lng: -46.63 }, { lat: 52.52, lng: 13.4 }, { lat: 42.36, lng: -71.06 }],
  },
];
