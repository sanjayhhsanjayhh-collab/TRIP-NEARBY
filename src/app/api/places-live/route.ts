import { z } from "zod";
import { searchLivePlaces } from "@/lib/google";
import { rateLimited } from "@/lib/security";

const allowed = ["bike-rentals", "camera-rentals", "car-rentals", "camping-equipment", "travel-shops", "trekking-shops", "vehicle-services", "essential-services", "hotels", "restaurants", "guides", "attractions"] as const;
const input = z.object({ category: z.enum(allowed), lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180), radius: z.coerce.number().refine((n) => [5, 10, 25, 50, 100].includes(n)) });

export async function GET(request: Request) {
  if (rateLimited(request, "live-places", 20)) return Response.json({ error: "Live search limit reached. Try again shortly." }, { status: 429 });
  const parsed = input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Choose a valid category, location and radius." }, { status: 400 });
  if (!process.env.GOOGLE_MAPS_SERVER_API_KEY) return Response.json({ configured: false, results: [],
    message: "Live Google Places search is not configured. Add GOOGLE_MAPS_SERVER_API_KEY to enable it." });
  try {
    const { category, lat, lng, radius } = parsed.data;
    const results = await searchLivePlaces(category, { latitude: lat, longitude: lng }, radius);
    return Response.json({ configured: true, results, searchedRadiusKm: Math.min(radius, 50),
      message: radius === 100 ? "Google Places limits a single live search to 50 km. Approved TripNearby listings use the full 100 km filter." : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live search is temporarily unavailable." }, { status: 502 });
  }
}
