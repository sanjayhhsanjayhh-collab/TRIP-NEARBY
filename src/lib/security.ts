import "server-only";

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimited(request: Request, scope: string, max: number, windowMs = 60_000) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  if (buckets.size > 10000) for (const [bucket, value] of buckets) if (value.reset < now) buckets.delete(bucket);
  const current = buckets.get(key);
  if (!current || current.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return false; }
  current.count++;
  return current.count > max;
}

export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients still require authentication where applicable.
  try {
    const host = new URL(origin).host;
    return [new URL(request.url).host, request.headers.get("host"), request.headers.get("x-forwarded-host")].includes(host);
  } catch { return false; }
}

export function guardMutation(request: Request, scope: string, max = 30) {
  if (!validOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (rateLimited(request, scope, max)) return Response.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  return null;
}

export const isMediaPath = (value: string | null | undefined) => !value || /^\/api\/media\/[0-9a-f-]{36}$/.test(value);

export function parseJson(request: Request) {
  return request.json().catch(() => null) as Promise<unknown>;
}
