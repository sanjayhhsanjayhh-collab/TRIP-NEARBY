import { z } from "zod";
import { getDestination, getDestinations, getNearbyDestinations } from "@/lib/catalog";
import { computeRoadMatrix } from "@/lib/google";
import { rateLimited } from "@/lib/security";

const radii = [5, 10, 25, 50, 100];

export async function GET(request: Request) {
  if (rateLimited(request, "places-read", 90)) return Response.json({ error: "Please slow down and try again." }, { status: 429 });
  const params = new URL(request.url).searchParams;
  const near = params.get("near");
  const latitude = params.get("lat"), longitude = params.get("lng");
  if (near || (latitude !== null && longitude !== null)) {
    const radius = Number(params.get("radius") ?? 25);
    if (!radii.includes(radius)) return Response.json({ error: "Select a radius of 5, 10, 25, 50 or 100 km." }, { status: 400 });
    const originPlace = near ? await getDestination(near.slice(0, 180)) : null;
    if (near && !originPlace) return Response.json({ error: "Destination not found." }, { status: 404 });
    const lat = originPlace?.latitude ?? Number(latitude), lng = originPlace?.longitude ?? Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return Response.json({ error: "Enter valid coordinates." }, { status: 400 });
    }
    const nearby = await getNearbyDestinations(lat, lng, radius, originPlace?.id);
    const road = await computeRoadMatrix({ latitude: lat, longitude: lng }, nearby.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
    const results = nearby.map((place, index) => ({ ...place,
      roadDistanceMeters: road?.[index]?.distanceMeters ?? null, roadDurationSeconds: road?.[index]?.durationSeconds ?? null,
    }));
    return Response.json({ origin: { name: originPlace?.name ?? "Your location", latitude: lat, longitude: lng },
      results, radiusKm: radius, roadRoutingAvailable: road !== null,
      note: road === null ? "Search radius is geographic proximity, not road distance. Configure Google Routes API for driving distances and travel times." : null });
  }
  const query = z.object({ search: z.string().max(100).optional(), category: z.string().max(100).optional(),
    district: z.string().max(120).optional(), state: z.string().max(120).optional(), hidden: z.enum(["true", "false"]).optional() })
    .safeParse(Object.fromEntries(params.entries()));
  if (!query.success) return Response.json({ error: "Invalid search filters." }, { status: 400 });
  const places = await getDestinations({ ...query.data, hidden: query.data.hidden === undefined ? undefined : query.data.hidden === "true" });
  return Response.json({ results: places });
}
