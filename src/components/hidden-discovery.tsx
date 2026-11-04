"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, LoaderCircle, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react";

export type SourceCounts = {
  officialGovernment: number; officialTourism: number; openStreetMap: number;
  officiallyVerified: number; locationVerified: number; communitySubmitted: number;
  pendingVerification: number; publishedHidden: number;
};
export type DiscoveryDistrict = { slug: string; name: string; center: { latitude: number; longitude: number } };
type OsmResult = { id: string; name: string; address: string; latitude: number; longitude: number; type: string; osmUrl: string; label: string; note: string };
type LiveResult = { id: string; name: string; address: string; mapsUrl?: string; type: string };

export function HiddenDiscoveryPanel({ counts, districts }: { counts: SourceCounts; districts: DiscoveryDistrict[] }) {
  const [query, setQuery] = useState("waterfall");
  const [district, setDistrict] = useState(districts[0]?.slug ?? "davanagere");
  const [radius, setRadius] = useState(25);
  const [osmResults, setOsmResults] = useState<OsmResult[] | null>(null);
  const [liveResults, setLiveResults] = useState<LiveResult[] | null>(null);
  const [osmBusy, setOsmBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const osmController = useRef<AbortController | null>(null);
  const liveController = useRef<AbortController | null>(null);
  const selected = districts.find((d) => d.slug === district) ?? districts[0];
  const labels = [
    { label: "Officially verified", count: counts.officiallyVerified, detail: "Official source + reviewed coordinates", icon: ShieldCheck },
    { label: "Location verified", count: counts.locationVerified, detail: "Public map/reference coordinates", icon: MapPin },
    { label: "Community submitted", count: counts.communitySubmitted, detail: "Traveller submission after review", icon: CheckCircle2 },
    { label: "Pending verification", count: counts.pendingVerification, detail: "Not published as a confirmed destination", icon: Sparkles },
  ];
  const searchOsm = async (event: FormEvent) => {
    event.preventDefault();
    osmController.current?.abort();
    const controller = new AbortController(); osmController.current = controller;
    setOsmBusy(true); setMessage(null); setError(false); setOsmResults(null);
    try {
      const response = await fetch(`/api/discovery/osm?${new URLSearchParams({ q: query, district })}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "OpenStreetMap lookup failed.");
      setOsmResults(data.results ?? []); setMessage(data.message ?? null);
    } catch (cause) { if ((cause as Error).name !== "AbortError") { setError(true); setMessage(cause instanceof Error ? cause.message : "OpenStreetMap lookup failed."); } }
    finally { if (!controller.signal.aborted) setOsmBusy(false); }
  };
  const searchGoogle = async () => {
    if (!selected) return;
    liveController.current?.abort();
    const controller = new AbortController(); liveController.current = controller;
    setLiveBusy(true); setMessage(null); setError(false); setLiveResults(null);
    try {
      const params = new URLSearchParams({ category: "attractions", lat: String(selected.center.latitude), lng: String(selected.center.longitude), radius: String(radius) });
      const response = await fetch(`/api/places-live?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Live Google Places search failed.");
      setLiveResults(data.results ?? []);
      setMessage(data.configured ? "Live Google Places results are references, not TripNearby-verified places. Check details with the provider." : "Google Places is not configured. Add GOOGLE_MAPS_SERVER_API_KEY to enable this source.");
    } catch (cause) { if ((cause as Error).name !== "AbortError") { setError(true); setMessage(cause instanceof Error ? cause.message : "Live search failed."); } }
    finally { if (!controller.signal.aborted) setLiveBusy(false); }
  };
  return <section className="white-card" style={{ marginBottom: 28 }}>
    <p className="eyebrow">Hidden places discovery engine</p><h3>Four ways to find a real detour.</h3>
    <p>Published destinations are source-backed. Live Google Places and OpenStreetMap results are references only; they are never silently added to the catalog as verified attractions.</p>
    <div className="stat-grid">{labels.map(({ label, count, detail, icon: Icon }) => <div className="stat-card" key={label}><Icon size={18} color="#4e8b64" /><strong>{count}</strong><span>{label}<br /><small>{detail}</small></span></div>)}</div>
    <p className="small muted">Source mix: {counts.officialGovernment} government records, {counts.officialTourism} tourism records, {counts.openStreetMap} OSM-derived records, {counts.publishedHidden} published offbeat places. {counts.pendingVerification} submissions await verification and their coordinates are not shown publicly.</p>
    <div className="filter-bar" style={{ marginTop: 20 }}><div className="field"><label className="sr-only" htmlFor="osm-query">Search OpenStreetMap</label><input id="osm-query" className="form-control" value={query} minLength={3} onChange={(e) => setQuery(e.target.value)} placeholder="Try: fort, temple, waterfall, lake…" /></div><div className="field"><label className="sr-only" htmlFor="osm-district">District</label><select id="osm-district" className="form-control" value={district} onChange={(e) => setDistrict(e.target.value)}>{districts.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select></div><button className="btn btn-primary" onClick={(e) => void searchOsm(e)} disabled={osmBusy || query.trim().length < 3}>{osmBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />} Search OSM</button></div>
    <div className="filter-bar"><div className="field"><label className="sr-only" htmlFor="live-radius">Live search radius</label><select id="live-radius" className="form-control" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>{[5, 10, 25, 50].map((km) => <option key={km} value={km}>{km} km radius</option>)}</select></div><button className="btn btn-outline" onClick={() => void searchGoogle()} disabled={liveBusy}>{liveBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />} Search live Google Places</button><span className="small muted">Google Places is limited to 50 km per live search.</span></div>
    {message && <p className={error ? "inline-error" : "notice"} role="status">{message}</p>}
    {osmResults && <div style={{ marginTop: 20 }}><h4>OpenStreetMap references · {osmResults.length}</h4>{osmResults.map((item) => <div className="admin-item" key={item.id}><strong>{item.name}</strong><p>{item.address}</p><span className="pill">{item.label}</span><p className="form-help">{item.note}</p><a className="text-link" href={item.osmUrl} target="_blank" rel="noopener noreferrer">View OSM object <ArrowUpRight size={13} /></a></div>)}{!osmResults.length && <p className="small muted">No matching OSM objects inside the stored district boundary. Try a broader local term.</p>}</div>}
    {liveResults && <div style={{ marginTop: 20 }}><h4>Google Places live references · {liveResults.length}</h4>{liveResults.map((item) => <div className="admin-item" key={item.id}><strong>{item.name}</strong><p>{item.type} · {item.address}</p><span className="pill">Not TripNearby verified</span>{item.mapsUrl && <a className="text-link" href={item.mapsUrl} target="_blank" rel="noopener noreferrer">View on Google Maps <ArrowUpRight size={13} /></a>}</div>)}{!liveResults.length && <p className="small muted">No live results, or the integration is not configured.</p>}</div>}
    <p className="form-help" style={{ marginTop: 18 }}>Found a genuine lesser-known place? Use “Suggest a place” below. A human admin verifies its source and coordinates before publication. <Link href="/hidden-places" className="text-link">Hidden places home <ArrowUpRight size={13} /></Link></p>
  </section>;
}
