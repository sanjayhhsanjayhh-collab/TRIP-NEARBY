export function safeNext(value?: string | null, fallback = "/profile") {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || /[\r\n]/.test(trimmed)) return fallback;
  try {
    const url = new URL(trimmed, "http://tripnearby.local");
    if (url.origin !== "http://tripnearby.local") return fallback;
    if (["/login", "/register", "/auth", "/logout"].includes(url.pathname) || url.pathname.startsWith("/api/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
