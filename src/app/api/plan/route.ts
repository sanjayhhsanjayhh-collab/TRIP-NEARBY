import { z } from "zod";
import { getDestination, getNearbyDestinations } from "@/lib/catalog";
import { guardMutation, parseJson } from "@/lib/security";

const input = z.object({ startLocation: z.string().trim().min(2).max(120), destinationSlug: z.string().min(2).max(180),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), days: z.number().int().min(1).max(10),
  travellers: z.number().int().min(1).max(20), budget: z.number().int().min(0).max(10_000_000).optional(),
  transport: z.enum(["car", "bike", "public transport", "walking"]), interests: z.array(z.string().max(40)).max(6) });
const daySchema = z.object({ day: z.number().int(), title: z.string().max(120), stopSlugs: z.array(z.string()).max(5), note: z.string().max(500) });

export async function POST(request: Request) {
  const blocked = guardMutation(request, "trip-plan", 12);
  if (blocked) return blocked;
  const parsed = input.safeParse(await parseJson(request));
  if (!parsed.success) return Response.json({ error: "Please complete the trip details with a valid destination." }, { status: 400 });
  const data = parsed.data;
  const main = await getDestination(data.destinationSlug);
  if (!main) return Response.json({ error: "Choose a destination from the published catalog." }, { status: 404 });
  const nearby = (await getNearbyDestinations(main.latitude, main.longitude, 100, main.id)).slice(0, 12);
  const candidates = [main, ...nearby];
  const availableSlugs = new Set(candidates.map((place) => place.slug));
  let days = Array.from({ length: data.days }, (_, index) => ({
    day: index + 1, title: index === 0 ? `Discover ${main.name}` : `Explore around ${main.district}`,
    stopSlugs: index === 0 ? [main.slug] : nearby.filter((_, n) => n % Math.max(1, data.days - 1) === index - 1).slice(0, 3).map((p) => p.slug),
    note: index === 0 ? "Plan your arrival and explore at your own pace. Check access and conditions before departure."
      : "These are location-based suggestions, not a confirmed route. Verify local access and travel times.",
  }));
  let provider = "catalog";
  let warning: string | null = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", store: false,
          input: [
            { role: "system", content: "You are a cautious Karnataka travel planner. Use ONLY the provided destination slugs. Never invent places, fees, opening hours, road distances, travel times, bookings or prices. Keep notes practical and qualified. Return exactly the requested number of days." },
            { role: "user", content: JSON.stringify({ request: data, main: main.name,
              allowedStops: candidates.map((p) => ({ slug: p.slug, name: p.name, district: p.district, category: p.category, source: p.sourceUrl })) }) },
          ], text: { format: { type: "json_schema", name: "grounded_itinerary", strict: true, schema: {
            type: "object", properties: { days: { type: "array", items: { type: "object", properties: {
              day: { type: "integer" }, title: { type: "string" }, stopSlugs: { type: "array", items: { type: "string" } }, note: { type: "string" },
            }, required: ["day", "title", "stopSlugs", "note"], additionalProperties: false } } }, required: ["days"], additionalProperties: false,
          } } }, max_output_tokens: 1500 }), signal: AbortSignal.timeout(18000), cache: "no-store",
      });
      if (!response.ok) throw new Error("AI service unavailable");
      const body = await response.json() as { output?: { content?: { type: string; text?: string }[] }[] };
      const content = body.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("");
      const result = z.object({ days: z.array(daySchema).min(data.days).max(data.days) }).parse(JSON.parse(content || "{}"));
      days = result.days.map((day, index) => ({ ...day, day: index + 1, stopSlugs: day.stopSlugs.filter((slug) => availableSlugs.has(slug)) }));
      if (!days.some((day) => day.stopSlugs.includes(main.slug))) days[0].stopSlugs.unshift(main.slug);
      provider = "openai";
    } catch { warning = "AI generation was unavailable; a catalog-based outline was created instead."; }
  }
  return Response.json({ provider, warning, main: { name: main.name, slug: main.slug },
    days: days.map((day) => ({ day: day.day, title: day.title, note: day.note,
      stops: day.stopSlugs.map((slug) => candidates.find((place) => place.slug === slug)).filter((place) => !!place)
        .map((place) => ({ id: place!.id, slug: place!.slug, name: place!.name, district: place!.district, category: place!.category,
          latitude: place!.latitude, longitude: place!.longitude, sourceUrl: place!.sourceUrl })) })),
    disclaimer: "Suggested stops only. Distances, times, prices, opening hours and availability are not confirmed. Use Route Planner for live road routing when configured.",
    request: data,
  });
}
