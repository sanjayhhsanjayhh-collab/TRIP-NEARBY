import { getSourceCounts } from "@/lib/districts";
import { rateLimited } from "@/lib/security";

export async function GET(request: Request) {
  if (rateLimited(request, "discovery-sources", 60)) return Response.json({ error: "Please slow down and try again shortly." }, { status: 429 });
  const counts = await getSourceCounts();
  return Response.json({ counts, integrations: { googlePlaces: !!process.env.GOOGLE_MAPS_SERVER_API_KEY,
    googleRoutes: !!process.env.GOOGLE_MAPS_SERVER_API_KEY, openStreetMap: true, communitySubmissions: true,
    officialSources: true, emailDelivery: false },
    message: "Published destinations are source-backed. Live Google Places and OSM results are references, not TripNearby-verified tourist destinations." },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
