import type { GlobePlace, GlobeScene } from "./globe/engine";
import type { Locale } from "@together/i18n/config";
import type { TKey } from "@/i18n";

/**
 * Illustrative routes for the hero: where people might fly from, meeting at
 * one destination. Not user data — no counts or names are implied. The first
 * route leaves from a city close to the visitor's language.
 */
type City = GlobePlace & { id: string };

const CITY = {
  telAviv: { id: "telAviv", lat: 32.08, lng: 34.78 },
  london: { id: "london", lat: 51.5, lng: -0.12 },
  berlin: { id: "berlin", lat: 52.52, lng: 13.4 },
  newYork: { id: "newYork", lat: 40.71, lng: -74.0 },
  sydney: { id: "sydney", lat: -33.87, lng: 151.2 },
  sanFrancisco: { id: "sanFrancisco", lat: 37.77, lng: -122.42 },
  singapore: { id: "singapore", lat: 1.35, lng: 103.82 },
  paris: { id: "paris", lat: 48.86, lng: 2.35 },
  toronto: { id: "toronto", lat: 43.65, lng: -79.38 },
  melbourne: { id: "melbourne", lat: -37.81, lng: 144.96 },
  mumbai: { id: "mumbai", lat: 19.08, lng: 72.88 },
  amsterdam: { id: "amsterdam", lat: 52.37, lng: 4.9 },
  saoPaulo: { id: "saoPaulo", lat: -23.55, lng: -46.63 },
  boston: { id: "boston", lat: 42.36, lng: -71.06 },
  dubai: { id: "dubai", lat: 25.2, lng: 55.27 },
  madrid: { id: "madrid", lat: 40.42, lng: -3.7 },
} satisfies Record<string, City>;

export type CityId = keyof typeof CITY;

const HOME: Record<Locale, City> = {
  he: CITY.telAviv,
  en: CITY.london,
  ar: CITY.dubai,
  es: CITY.madrid,
};

const BASE: { id: string; label: TKey; destination: GlobePlace; origins: City[] }[] = [
  {
    id: "sicily",
    label: "landing.places.sicily",
    destination: { lat: 37.6, lng: 14.0 },
    origins: [CITY.newYork, CITY.london, CITY.mumbai, CITY.saoPaulo],
  },
  {
    id: "kyoto",
    label: "landing.places.kyoto",
    destination: { lat: 35.01, lng: 135.77 },
    origins: [CITY.sydney, CITY.sanFrancisco, CITY.singapore, CITY.mumbai],
  },
  {
    id: "reykjavik",
    label: "landing.places.reykjavik",
    destination: { lat: 64.15, lng: -21.94 },
    origins: [CITY.newYork, CITY.berlin, CITY.toronto, CITY.dubai],
  },
  {
    id: "bali",
    label: "landing.places.bali",
    destination: { lat: -8.34, lng: 115.09 },
    origins: [CITY.melbourne, CITY.mumbai, CITY.amsterdam, CITY.singapore],
  },
  {
    id: "lisbon",
    label: "landing.places.lisbon",
    destination: { lat: 38.72, lng: -9.14 },
    origins: [CITY.saoPaulo, CITY.berlin, CITY.boston, CITY.sydney],
  },
];

/** Scenes for a language: home city first, then three others (no duplicates). */
export function globeScenes(locale: Locale): (GlobeScene & { label: TKey })[] {
  const home = HOME[locale];
  return BASE.map((scene) => ({
    ...scene,
    origins: [home, ...scene.origins.filter((city) => city.id !== home.id)].slice(0, 4),
  }));
}

export const CITY_IDS = Object.keys(CITY) as CityId[];
