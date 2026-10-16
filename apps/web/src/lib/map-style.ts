/**
 * Together's map: chart paper. Pale land, sea-glass water, quiet roads, so
 * the brand pins and routes carry the colour. Works with the classic
 * Google Maps JS API (no mapId — a mapId would ignore styles).
 */
export const CHART_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#eef1ec" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5868" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f6f8f4" }, { weight: 3 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9dcd8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4f7a74" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#e7ece4" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#dbe6d6" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f3e6cf" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e2cfac" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c6ccc2" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#0f1b2d" }] },
];
