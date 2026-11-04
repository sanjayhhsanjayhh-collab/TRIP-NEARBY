import { z } from "zod";
import { getBoundaryNeighbors, getDistrictPage, getDistrictStats, verificationLabels } from "@/lib/districts";
import { computeRoadMatrix } from "@/lib/google";
import { rateLimited } from "@/lib/security";

const radii = [5, 10, 25, 50, 100];
const schema = z.object({
  district: z.string().min(1).max(120), state: z.string().max(120).optional(),
  search: z.string().max(100).optional(), category: z.string().max(100).optional(), taluk: z.string().max(120).optional(),
  verification: z.string().max(30).optional().refine((v) => !v || v in verificationLabels),
  hidden: z.enum(["true", "false"]).optional(),
  sort: z.enum(["featured", "name", "distance", "hidden", "verification"]).default("featured"),
  page: z.coerce.number().int().min(1).max(1000).default(1), pageSize: z.coerce.number().int().min(1).max(60).default(12),
  lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().refine((v) => radii.includes(v)).optional(), roads: z.enum(["true", "false"]).optional(),
  stats: z.enum(["true", "false"]).optional(), boundary: z.enum(["true", "false"]).optional(),
});

export async function GET(request: Request) {
  if (rateLimited(request, "district-read", 150)) return Response.json({ error: "Please slow down and try again shortly." }, { status: 429 });
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid district filters." }, { status: 400 });
  const q = parsed.data;
  const origin = q.lat !== undefined && q.lng !== undefined ? { latitude: q.lat, longitude: q.lng } : undefined;
  if ((q.lat === undefined) !== (q.lng === undefined)) return Response.json({ error: "Provide both latitude and longitude." }, { status: 400 });
  if (q.radius !== undefined && !origin) return Response.json({ error: "A location is required for radius filtering." }, { status: 400 });
  const page = await getDistrictPage({ districtSlug: q.district, stateSlug: q.state, search: q.search,
    category: q.category, taluk: q.taluk, verification: q.verification, hidden: q.hidden === undefined ? undefined : q.hidden === "true",
    sort: q.sort, page: q.page, pageSize: q.pageSize, origin, radiusKm: q.radius });
  let roadRoutingAvailable = false;
  let results: Record<string, unknown>[] = page.results.map((row) => ({ ...row, roadDistanceMeters: null, roadDurationSeconds: null }));
  if (origin && q.roads === "true" && process.env.GOOGLE_MAPS_SERVER_API_KEY && results.length) {
    const matrix = await computeRoadMatrix(origin, page.results.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
    if (matrix) {
      roadRoutingAvailable = true;
      results = results.map((row, index) => ({ ...row, roadDistanceMeters: matrix[index]?.distanceMeters ?? null,
        roadDurationSeconds: matrix[index]?.durationSeconds ?? null }));
    }
  }
  const [stats, boundaryNeighbors] = await Promise.all([
    q.stats === "true" ? getDistrictStats(q.district) : Promise.resolve(null),
    q.boundary === "true" ? getBoundaryNeighbors(q.district) : Promise.resolve(null),
  ]);
  const headers = { "Cache-Control": q.roads === "true" || origin ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300" };
  return Response.json({ ...page, results, stats, boundaryNeighbors, roadRoutingAvailable,
    note: origin && q.roads === "true" && !roadRoutingAvailable ? "Google Routes is not configured, so road distance and travel time are unavailable. Geographic distance is shown only as a search measure, never as driving distance." : null,
  }, { headers });
}
