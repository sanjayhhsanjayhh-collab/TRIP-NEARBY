export type Point = { latitude: number; longitude: number };

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function directionsUrl(destination: Point, origin?: Point, waypoints: Point[] = [], mode = "driving") {
  const params = new URLSearchParams({ api: "1", destination: `${destination.latitude},${destination.longitude}`, travelmode: mode });
  if (origin) params.set("origin", `${origin.latitude},${origin.longitude}`);
  if (waypoints.length) params.set("waypoints", waypoints.map((point) => `${point.latitude},${point.longitude}`).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function decodePolyline(encoded: string): Point[] {
  const points: Point[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length && points.length < 20000) {
    const read = () => {
      let shift = 0, result = 0, byte: number;
      do {
        if (index >= encoded.length) return null;
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    const dLat = read(), dLng = read();
    if (dLat === null || dLng === null) break;
    lat += dLat; lng += dLng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// Geometric corridor check only; never presented as driving distance or detour time.
export function distanceToPathKm(point: Point, path: Point[]) {
  if (path.length < 2) return Infinity;
  const latScale = 111.195;
  const lonScale = 111.195 * Math.cos(point.latitude * Math.PI / 180);
  const project = (p: Point) => ({ x: (p.longitude - point.longitude) * lonScale, y: (p.latitude - point.latitude) * latScale });
  let minimum = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = project(path[i - 1]), b = project(path[i]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const fraction = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1)));
    minimum = Math.min(minimum, Math.hypot(a.x + fraction * dx, a.y + fraction * dy));
  }
  return minimum;
}

// Polygon is an array of [longitude, latitude] pairs in GeoJSON order.
export function pointInPolygon(latitude: number, longitude: number, polygon: [number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if (((yi > latitude) !== (yj > latitude)) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

export function distanceToBoundaryKm(point: Point, polygon: [number, number][]) {
  let minimum = Infinity;
  for (const [longitude, latitude] of polygon) minimum = Math.min(minimum, haversineKm(point.latitude, point.longitude, latitude, longitude));
  return minimum;
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600), minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
}
