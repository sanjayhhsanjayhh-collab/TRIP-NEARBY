import "server-only";
import type { Point } from "@/lib/geo";

const key = () => process.env.GOOGLE_MAPS_SERVER_API_KEY;
const waypoint = (point: Point) => ({ location: { latLng: { latitude: point.latitude, longitude: point.longitude } } });

export type RoadResult = { distanceMeters: number; durationSeconds: number } | null;

export async function computeRoadMatrix(origin: Point, destinations: Point[], mode: "DRIVE" | "WALK" | "BICYCLE" = "DRIVE") {
  if (!key() || !destinations.length) return null;
  const results: RoadResult[] = Array(destinations.length).fill(null);
  for (let start = 0; start < destinations.length; start += 20) {
    const batch = destinations.slice(start, start + 20);
    try {
      const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key()!,
          "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,status,condition" },
        body: JSON.stringify({ origins: [{ waypoint: waypoint(origin) }], destinations: batch.map((point) => ({ waypoint: waypoint(point) })), travelMode: mode }),
        cache: "no-store", signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return null;
      const data = await response.json() as { destinationIndex: number; distanceMeters?: number; duration?: string; condition?: string }[];
      if (!Array.isArray(data)) return null;
      for (const item of data) {
        if (item.condition && item.condition !== "ROUTE_EXISTS") continue;
        if (typeof item.distanceMeters === "number" && item.duration && Number.isInteger(item.destinationIndex)) {
          results[start + item.destinationIndex] = { distanceMeters: item.distanceMeters, durationSeconds: Math.round(parseFloat(item.duration)) };
        }
      }
    } catch { return null; }
  }
  return results;
}

export async function computeRoute(points: Point[], mode: "DRIVE" | "WALK" | "BICYCLE") {
  if (!key()) return null;
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key()!,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.optimizedIntermediateWaypointIndex" },
    body: JSON.stringify({ origin: waypoint(points[0]), destination: waypoint(points[points.length - 1]),
      ...(points.length > 2 ? { intermediates: points.slice(1, -1).map(waypoint) } : {}), travelMode: mode,
      polylineQuality: "OVERVIEW", ...(mode === "DRIVE" && points.length > 2 ? { optimizeWaypointOrder: true } : {}),
    }), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Routes API returned ${response.status}. Check that Routes API and billing are enabled for the server key.`);
  const data = await response.json() as { routes?: { distanceMeters: number; duration: string;
    polyline?: { encodedPolyline: string }; legs?: { distanceMeters: number; duration: string }[];
    optimizedIntermediateWaypointIndex?: number[] }[] };
  const route = data.routes?.[0];
  if (!route) throw new Error("No route is available for these stops and this travel mode.");
  return { distanceMeters: route.distanceMeters, durationSeconds: Math.round(parseFloat(route.duration)),
    encodedPolyline: route.polyline?.encodedPolyline ?? "",
    legs: route.legs?.map((leg) => ({ distanceMeters: leg.distanceMeters, durationSeconds: Math.round(parseFloat(leg.duration)) })) ?? [],
    waypointOrder: route.optimizedIntermediateWaypointIndex ?? [],
  };
}

const textQueries: Record<string, string> = {
  "bike-rentals": "bike and scooter rental", "camera-rentals": "camera equipment rental", "car-rentals": "self drive car rental",
  "camping-equipment": "camping equipment shop", "travel-shops": "travel accessories shop", "trekking-shops": "trekking gear shop",
  "vehicle-services": "vehicle repair garage", "essential-services": "petrol station pharmacy ATM", "guides": "local tour guide", "attractions": "tourist attraction",
};

export async function searchLivePlaces(category: string, center: Point, radiusKm: number) {
  if (!key()) return null;
  const circle = { center, radius: Math.min(radiusKm, 50) * 1000 };
  const isNearby = category === "hotels" || category === "restaurants";
  const endpoint = isNearby ? "https://places.googleapis.com/v1/places:searchNearby" : "https://places.googleapis.com/v1/places:searchText";
  const requestBody = isNearby
    ? { includedTypes: category === "hotels" ? ["hotel", "bed_and_breakfast", "guest_house"] : ["restaurant", "cafe"],
      maxResultCount: 15, rankPreference: "DISTANCE", locationRestriction: { circle } }
    : { textQuery: textQueries[category] ?? "travel service", locationBias: { circle }, maxResultCount: 15, regionCode: "IN" };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key()!,
    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryTypeDisplayName" },
    body: JSON.stringify(requestBody), cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}. Check API enablement and billing.`);
  const data = await response.json() as { places?: { id: string; displayName?: { text: string }; formattedAddress?: string;
    location?: { latitude: number; longitude: number }; googleMapsUri?: string; primaryTypeDisplayName?: { text: string } }[] };
  return (data.places ?? []).map((place) => ({ id: place.id, name: place.displayName?.text ?? "Unnamed place", address: place.formattedAddress ?? "",
    latitude: place.location?.latitude, longitude: place.location?.longitude, mapsUrl: place.googleMapsUri,
    type: place.primaryTypeDisplayName?.text ?? "Place" }));
}
