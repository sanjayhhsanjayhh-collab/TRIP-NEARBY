import { z } from "zod";
import { db } from "@/db";
import { routes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDestination } from "@/lib/catalog";
import { getDistrictPage } from "@/lib/districts";
import { decodePolyline, distanceToPathKm, type Point } from "@/lib/geo";
import { computeRoadMatrix, computeRoute } from "@/lib/google";
import { guardMutation, parseJson } from "@/lib/security";

const input = z.object({ districtSlug: z.string().min(1).max(120), start: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), name: z.string().max(160).optional() }),
  endSlug: z.string().min(1).max(180), stopSlugs: z.array(z.string().max(180)).max(6).optional(),
  mode: z.enum(["DRIVE", "WALK", "BICYCLE"]).default("DRIVE"), radius: z.number().refine((v) => [5, 10, 25, 50, 100].includes(v)).default(25) });

export async function POST(request: Request) {
  const blocked = guardMutation(request, "district-route", 20);
  if (blocked) return blocked;
  const parsed = input.safeParse(await parseJson(request));
  if (!parsed.success) return Response.json({ error: "Choose a district, start point, destination and a valid radius." }, { status: 400 });
  const { districtSlug, start, endSlug, stopSlugs, mode, radius } = parsed.data;
  const end = await getDestination(endSlug);
  if (!end) return Response.json({ error: "Choose a published destination as your route endpoint." }, { status: 404 });
  if (!process.env.GOOGLE_MAPS_SERVER_API_KEY) return Response.json({ configured: false, route: null, suggestions: [],
    message: "Live route recommendations require GOOGLE_MAPS_SERVER_API_KEY with the Routes API enabled. No road distances or travel times are being estimated." });
  const selected = await Promise.all((stopSlugs ?? []).filter((slug) => slug !== endSlug).map((slug) => getDestination(slug)));
  const extraPoints = selected.filter((place): place is NonNullable<typeof place> => !!place)
    .map((place) => ({ latitude: place.latitude, longitude: place.longitude }));
  const points: Point[] = [{ latitude: start.latitude, longitude: start.longitude }, ...extraPoints,
    { latitude: end.latitude, longitude: end.longitude }];
  try {
    const route = await computeRoute(points, mode);
    if (!route) return Response.json({ configured: false, route: null, suggestions: [], message: "Routes API is not configured." });
    const line = decodePolyline(route.encodedPolyline);
    const districtPlaces: Awaited<ReturnType<typeof getDistrictPage>>["results"] = [];
    for (let page = 1; page <= 4; page++) {
      const batch = await getDistrictPage({ districtSlug, page, pageSize: 60, sort: "name" });
      districtPlaces.push(...batch.results);
      if (!batch.hasMore) break;
    }
    const excluded = new Set([endSlug, ...(stopSlugs ?? [])]);
    const corridor = districtPlaces.filter((place) => !excluded.has(place.slug))
      .map((place) => ({ ...place, corridorKm: distanceToPathKm(place, line) }))
      .filter((place) => place.corridorKm <= Math.min(radius, 15))
      .sort((a, b) => Number(b.isHidden) - Number(a.isHidden) || a.corridorKm - b.corridorKm).slice(0, 20);
    const road = await computeRoadMatrix(start, corridor.map((place) => ({ latitude: place.latitude, longitude: place.longitude })));
    const suggestions = corridor.map((place, index) => ({ ...place, roadDistanceMeters: road?.[index]?.distanceMeters ?? null,
      roadDurationSeconds: road?.[index]?.durationSeconds ?? null }));
    const user = await getCurrentUser();
    if (user) await db.insert(routes).values({ userId: user.id, destinationId: end.id, originName: start.name ?? "Selected start",
      origin: start, destination: { latitude: end.latitude, longitude: end.longitude, name: end.name },
      travelMode: mode, provider: "Google Routes API", distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds });
    return Response.json({ configured: true, route, points, suggestions,
      nextRecommended: suggestions.find((place) => place.roadDistanceMeters !== null) ?? suggestions[0] ?? null,
      roadRoutingAvailable: road !== null,
      note: "Corridor proximity is computed from the Google route polyline. Actual road distance and travel time are shown only when returned by Google Routes. Google Places results are not treated as verified TripNearby destinations." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not calculate the live route." }, { status: 502 });
  }
}
