import type { Place } from "@/types";

type NavTarget = Pick<Place, "name" | "address" | "lat" | "lng">;

function hasCoords(place: NavTarget): place is NavTarget & {
  lat: number;
  lng: number;
} {
  return typeof place.lat === "number" && typeof place.lng === "number";
}

function searchQuery(place: NavTarget): string {
  return encodeURIComponent(place.address || `${place.name} Sicily`);
}

export function wazeUrl(place: NavTarget): string {
  if (hasCoords(place)) {
    return `https://waze.com/ul?ll=${place.lat},${place.lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${searchQuery(place)}&navigate=yes`;
}

export function googleMapsUrl(place: NavTarget): string {
  if (hasCoords(place)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${searchQuery(place)}`;
}
