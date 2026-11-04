import { z } from "zod";
import { getDistrictBoundary } from "@/lib/districts";
import { pointInPolygon } from "@/lib/geo";
import { rateLimited } from "@/lib/security";

const input = z.object({ q: z.string().trim().min(3).max(100), district: z.string().min(1).max(120) });
const cache = new Map<string, { expires: number; body: unknown }>();
let lastRequest = 0;

export async function GET(request: Request) {
  if (rateLimited(request, "osm-discovery", 8)) return Response.json({ error: "OpenStreetMap lookup limit reached. Please wait a minute." }, { status: 429 });
  const parsed = input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Enter at least three characters and choose a district." }, { status: 400 });
  const { q, district } = parsed.data;
  const boundary = await getDistrictBoundary(district);
  if (!boundary) return Response.json({ configured: true, results: [], message: "No stored district boundary is available for this district yet." });
  const key = `${district}:${q.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Response.json(cached.body);
  const viewbox = `${boundary.minLongitude},${boundary.minLatitude},${boundary.maxLongitude},${boundary.maxLatitude}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=15&countrycodes=in&bounded=1&viewbox=${encodeURIComponent(viewbox)}&q=${encodeURIComponent(q)}`;
  try {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequest));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    const response = await fetch(url, { headers: { "User-Agent": "TripNearby/1.0 (district discovery; server-side cached lookup)", Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`OpenStreetMap returned ${response.status}`);
    const data = await response.json() as { place_id: number; display_name: string; lat: string; lon: string; type: string; category?: string; osm_type: string; osm_id: number }[];
    const results = data.map((item) => ({ id: `osm-${item.place_id}`, name: item.display_name.split(",")[0], address: item.display_name,
      latitude: Number(item.lat), longitude: Number(item.lon), type: item.type || item.category || "place",
      osmUrl: `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}`,
      insideDistrictBoundary: pointInPolygon(Number(item.lat), Number(item.lon), boundary.polygon),
    })).filter((item) => item.insideDistrictBoundary)
      .map((item) => ({ ...item, label: "OpenStreetMap reference", note: "Location from OSM; tourism information and access are not TripNearby-verified." }));
    const body = { configured: true, results, source: "OpenStreetMap / Nominatim (ODbL)", boundarySource: boundary.sourceUrl,
      message: "These are transient OSM search references, not published TripNearby destinations. Submit a real place for review to add it to the catalog." };
    cache.set(key, { expires: Date.now() + 60 * 60 * 1000, body });
    return Response.json(body);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? `OpenStreetMap lookup failed: ${error.message}` : "OpenStreetMap lookup failed." }, { status: 502 });
  }
}
