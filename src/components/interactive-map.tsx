"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/geo";

export type MapMarker = Point & { id: string; name: string; slug?: string; kind?: "origin" | "hidden" | "place" | "service" };

export function InteractiveMap({ center, markers, route = [], height = 440, zoom = 10 }: { center: Point; markers: MapMarker[]; route?: Point[]; height?: number; zoom?: number }) {
  const element = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState("Loading map…");
  const markerKey = JSON.stringify(markers.map((m) => [m.id, m.latitude, m.longitude, m.kind]));
  const routeKey = JSON.stringify(route);
  useEffect(() => {
    let stopped = false;
    let leafletMap: import("leaflet").Map | null = null;
    const render = async () => {
      if (!element.current) return;
      element.current.replaceChildren();
      const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
      if (browserKey) {
        try {
          const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
          setOptions({ key: browserKey, v: "weekly" });
          const { Map } = await importLibrary("maps");
          if (stopped || !element.current) return;
          const map = new Map(element.current, { center: { lat: center.latitude, lng: center.longitude }, zoom,
            mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: "cooperative" });
          const googleMaps = (window as typeof window & { google: typeof google }).google.maps;
          const bounds = new googleMaps.LatLngBounds();
          for (const marker of markers) {
            const position = { lat: marker.latitude, lng: marker.longitude };
            const pin = new googleMaps.Marker({ map, position, title: marker.name,
              icon: { path: googleMaps.SymbolPath.CIRCLE, scale: marker.kind === "origin" ? 11 : 8,
                fillColor: marker.kind === "origin" ? "#dba36e" : marker.kind === "hidden" ? "#65a2b2" : "#194a3b",
                fillOpacity: 1, strokeWeight: 3, strokeColor: "#ffffff" } });
            const box = new googleMaps.InfoWindow();
            const content = document.createElement("div");
            const title = document.createElement("strong"); title.textContent = marker.name; content.appendChild(title);
            if (marker.slug) { const link = document.createElement("a"); link.href = `/places/${encodeURIComponent(marker.slug)}`; link.textContent = " View place →"; link.style.display = "block"; content.appendChild(link); }
            pin.addListener("click", () => { box.setContent(content); box.open(map, pin); });
            bounds.extend(position);
          }
          if (route.length > 1) new googleMaps.Polyline({ map, path: route.map((p) => ({ lat: p.latitude, lng: p.longitude })), strokeColor: "#194a3b", strokeWeight: 5, strokeOpacity: .9 });
          if (markers.length > 1) map.fitBounds(bounds, 56);
          setProvider("Google Maps");
          return;
        } catch { if (stopped) return; element.current?.replaceChildren(); }
      }
      try {
        const L = await import("leaflet");
        if (stopped || !element.current) return;
        leafletMap = L.map(element.current, { scrollWheelZoom: false, zoomControl: true }).setView([center.latitude, center.longitude], zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19,
        }).addTo(leafletMap);
        const bounds: [number, number][] = [];
        for (const marker of markers) {
          const coordinates: [number, number] = [marker.latitude, marker.longitude];
          bounds.push(coordinates);
          const color = marker.kind === "origin" ? "#dba36e" : marker.kind === "hidden" ? "#65a2b2" : "#194a3b";
          const pin = L.circleMarker(coordinates, { radius: marker.kind === "origin" ? 11 : 8, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }).addTo(leafletMap);
          const popup = document.createElement("div");
          const title = document.createElement("span"); title.className = "map-popup-name"; title.textContent = marker.name; popup.appendChild(title);
          if (marker.slug) { const link = document.createElement("a"); link.href = `/places/${encodeURIComponent(marker.slug)}`; link.className = "map-popup-link"; link.textContent = "View destination →"; popup.appendChild(link); }
          pin.bindPopup(popup);
        }
        if (route.length > 1) L.polyline(route.map((p) => [p.latitude, p.longitude] as [number, number]), { color: "#194a3b", weight: 5 }).addTo(leafletMap);
        if (bounds.length > 1) leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        setProvider("OpenStreetMap");
        setTimeout(() => leafletMap?.invalidateSize(), 150);
      } catch { setProvider("Map tiles unavailable"); }
    };
    void render();
    return () => { stopped = true; if (leafletMap) leafletMap.remove(); else element.current?.replaceChildren(); };
  // Marker and route signatures intentionally control reinitialisation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey, routeKey, center.latitude, center.longitude, height, zoom]);
  return <div className="map-shell" style={{ height }}><div ref={element} className="map-canvas" role="application" aria-label="Interactive destination map" /><span className="map-provider">{provider}</span></div>;
}
