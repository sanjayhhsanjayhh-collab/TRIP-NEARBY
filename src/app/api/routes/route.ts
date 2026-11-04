import { z } from "zod";
import { getDestinations } from "@/lib/catalog";
import { decodePolyline, distanceToPathKm } from "@/lib/geo";
import { computeRoute } from "@/lib/google";
import { guardMutation, parseJson } from "@/lib/security";

const point = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
const routeInput = z.object({ points: z.array(point).min(2).max(8), mode: z.enum(["DRIVE", "WALK", "BICYCLE"]).default("DRIVE") });

export async function POST(request: Request) {
  const blocked = guardMutation(request, "routes", 20);
  if (blocked) return blocked;
  const parsed = routeInput.safeParse(await parseJson(request));
  if (!parsed.success) return Response.json({ error: "Choose two to eight valid route stops." }, { status: 400 });
  if (!process.env.GOOGLE_MAPS_SERVER_API_KEY) return Response.json({ error: "Road route calculation is not configured. Add GOOGLE_MAPS_SERVER_API_KEY to enable Google Routes API. You can still open the journey in Google Maps." }, { status: 503 });
  try {
    const route = await computeRoute(parsed.data.points, parsed.data.mode);
    if (!route) return Response.json({ error: "Google Routes is not configured." }, { status: 503 });
    const line = decodePolyline(route.encodedPolyline);
    const excluded = parsed.data.points;
    const suggestions = (await getDestinations({ limit: 200 }))
      .filter((place) => !excluded.some((stop) => Math.abs(stop.latitude - place.latitude) < 0.004 && Math.abs(stop.longitude - place.longitude) < 0.004))
      .map((place) => ({ ...place, corridorKm: distanceToPathKm(place, line) }))
      .filter((place) => place.corridorKm < 8)
      .sort((a, b) => a.corridorKm - b.corridorKm).slice(0, 6);
    return Response.json({ ...route, suggestions, note: "Corridor suggestions are near the route geometrically; detour distance and time have not been calculated." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not calculate the route." }, { status: 502 });
  }
}
