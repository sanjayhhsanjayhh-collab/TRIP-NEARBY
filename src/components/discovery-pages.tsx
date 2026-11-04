"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Bell, Check, ChevronDown, Compass, LocateFixed, MapPin, Navigation, Plus, Route, Search, Sparkles, X } from "lucide-react";
import { ActionNotice, PhotoUpload, postAction } from "@/components/action-utils";
import { InteractiveMap, type MapMarker } from "@/components/interactive-map";
import { EmptyState, PlaceCard, SectionHeading } from "@/components/ui";
import type { CatalogPlace } from "@/lib/catalog";
import { decodePolyline, directionsUrl, formatDuration, type Point } from "@/lib/geo";

const radii = [5, 10, 25, 50, 100];
const locate = (success: (point: Point) => void, failure: (message: string) => void) => {
  if (!navigator.geolocation) { failure("Geolocation is not available in this browser."); return; }
  navigator.geolocation.getCurrentPosition((position) => success({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    () => failure("Location permission was denied or your position could not be found."), { timeout: 12000, enableHighAccuracy: false });
};

export function ExploreBrowser({ places, categories, districts, initialSearch = "", initialCategory = "", initialDistrict = "" }: {
  places: CatalogPlace[]; categories: { name: string; slug: string }[]; districts: { name: string; slug: string }[];
  initialSearch?: string; initialCategory?: string; initialDistrict?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [district, setDistrict] = useState(initialDistrict);
  const [sort, setSort] = useState("featured");
  const results = useMemo(() => places.filter((place) => {
    const query = search.trim().toLowerCase();
    return (!query || `${place.name} ${place.district} ${place.description}`.toLowerCase().includes(query) ||
      (place.slug === "shanti-sagara" && ["shantisagara kere", "sulekere", "shanthi sagara"].some((alias) => alias.includes(query))))
      && (!category || place.categorySlug === category) && (!district || place.districtSlug === district);
  }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name)), [places, search, category, district, sort]);
  return <><div className="filter-bar"><div className="field"><label className="sr-only" htmlFor="explore-search">Search destinations</label><input id="explore-search" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a place, district or experience…" /></div>
    <div className="field"><label className="sr-only" htmlFor="explore-district">District</label><select id="explore-district" className="form-control" value={district} onChange={(e) => setDistrict(e.target.value)}><option value="">All districts</option>{districts.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></div>
    <div className="field"><label className="sr-only" htmlFor="explore-sort">Sort by</label><select id="explore-sort" className="form-control" value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Featured first</option><option value="name">Name A–Z</option></select></div></div>
    <div className="filter-pills"><button className={`filter-pill ${!category ? "active" : ""}`} onClick={() => setCategory("")}>All places</button>{categories.map((item) => <button key={item.slug} className={`filter-pill ${category === item.slug ? "active" : ""}`} onClick={() => setCategory(item.slug)}>{item.name}</button>)}</div>
    <p className="result-count">Showing {results.length} source-backed {results.length === 1 ? "place" : "places"}{district ? ` in ${districts.find((d) => d.slug === district)?.name}` : ""}</p>
    {results.length ? <div className="places-grid">{results.map((place) => <PlaceCard key={place.id} place={place} />)}</div> : <EmptyState title="No matching places yet" description="Try a different district, category or search term. Only published, source-backed places appear here." />}
  </>;
}

export function HiddenBrowser({ places, loggedIn }: { places: CatalogPlace[]; loggedIn: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<Point | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await postAction({ action: "submit-hidden", name: form.get("name"), description: form.get("description"),
        category: form.get("category"), district: form.get("district"), latitude: Number(form.get("latitude")),
        longitude: Number(form.get("longitude")), directions: form.get("directions"), sourceUrl: form.get("sourceUrl"), imageUrl: photo || null });
      setMessage(String(result.message)); setError(false); setShowForm(false); setPhoto("");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not submit place."); setError(true); }
    finally { setLoading(false); }
  };
  return <><div className="section-heading"><div><p className="eyebrow">Away from the usual</p><h2>Go somewhere different.</h2><p className="section-description">These quieter places have published sources. A new suggestion only appears after an admin checks its location and tourism information.</p></div><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? "Close form" : "Suggest a place"} <Plus size={16} /></button></div>
    <ActionNotice text={message} error={error} />
    {showForm && <div className="white-card" style={{ marginBottom: 28, maxWidth: 780 }}><h3>Suggest a hidden place</h3>{!loggedIn ? <div className="notice">Please <Link href={`/auth?mode=login&next=${encodeURIComponent("/hidden-places")}`}>log in</Link> before suggesting a place. Submitted places remain unpublished until verified.</div> : <form onSubmit={submit}>
      <div className="form-row"><div className="form-field"><label htmlFor="hidden-name">Place name *</label><input id="hidden-name" className="form-control" name="name" required minLength={3} /></div><div className="form-field"><label htmlFor="hidden-category">Category *</label><input id="hidden-category" className="form-control" name="category" required placeholder="Lake, temple, viewpoint…" /></div></div>
      <div className="form-row"><div className="form-field"><label htmlFor="hidden-taluk">Taluk (optional)</label><input id="hidden-taluk" className="form-control" name="taluk" placeholder="e.g. Channagiri" /></div><div className="form-field"><label htmlFor="hidden-town">Town or village (optional)</label><input id="hidden-town" className="form-control" name="town" /></div></div>
      <div className="form-field"><label htmlFor="hidden-precision">What does your map pin represent? *</label><select id="hidden-precision" className="form-control" name="coordinatePrecision"><option value="locality">Town or village reference</option><option value="site">Exact site / entrance</option></select><p className="form-help">Choose “exact site” only if you verified the entrance coordinates.</p></div>
      <div className="form-field"><label htmlFor="hidden-description">What makes this place worth visiting? *</label><textarea id="hidden-description" className="form-control" name="description" required minLength={30} placeholder="Describe the place and what visitors should know." /></div>
      <div className="form-row three"><div className="form-field"><label htmlFor="hidden-district">District</label><input id="hidden-district" className="form-control" name="district" placeholder="e.g. Davanagere" /></div><div className="form-field"><label htmlFor="hidden-lat">Latitude *</label><input id="hidden-lat" className="form-control" name="latitude" type="number" required step="any" min="-90" max="90" defaultValue={coords?.latitude} key={`lat-${coords?.latitude}`} /></div><div className="form-field"><label htmlFor="hidden-lng">Longitude *</label><input id="hidden-lng" className="form-control" name="longitude" type="number" required step="any" min="-180" max="180" defaultValue={coords?.longitude} key={`lng-${coords?.longitude}`} /></div></div>
      <button type="button" className="btn btn-outline" style={{ marginBottom: 16 }} onClick={() => locate(setCoords, (text) => { setError(true); setMessage(text); })}><LocateFixed size={15} /> Use my current location</button>
      <div className="form-row"><div className="form-field"><label htmlFor="hidden-source">Source link (helps verification)</label><input id="hidden-source" className="form-control" name="sourceUrl" type="url" placeholder="https://…" /></div><div className="form-field"><label htmlFor="hidden-directions">Suggested directions</label><input id="hidden-directions" className="form-control" name="directions" placeholder="Nearest road or access point" /></div></div>
      <PhotoUpload value={photo} onChange={setPhoto} /><p className="form-help">Please share real information only. We do not publish unverified suggestions or Punyasthala without a confirmed location and source.</p><div className="form-actions"><button className="btn btn-primary" disabled={loading}>{loading ? "Submitting…" : "Submit for review"} <ArrowRight size={15} /></button></div>
    </form>}</div>}
    <div className="places-grid">{places.map((place) => <PlaceCard key={place.id} place={place} />)}</div>
    {!places.length && <EmptyState title="No approved offbeat places yet" description="Be the first to suggest a real place. Each submission is reviewed before publication." />}
  </>;
}

type NearbyPlace = CatalogPlace & { proximityKm: number; roadDistanceMeters: number | null; roadDurationSeconds: number | null };
export function NearbyExplorer({ places, initialSlug, loggedIn }: { places: CatalogPlace[]; initialSlug: string; loggedIn: boolean }) {
  const [slug, setSlug] = useState(initialSlug);
  const [gps, setGps] = useState<Point | null>(null);
  const [radius, setRadius] = useState(25);
  const [items, setItems] = useState<NearbyPlace[]>([]);
  const [origin, setOrigin] = useState<{ name: string; latitude: number; longitude: number } | null>(null);
  const [routing, setRouting] = useState(false);
  const [busy, setBusy] = useState(true);
  const [sort, setSort] = useState("nearest");
  const [selected, setSelected] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [tracking, setTracking] = useState(false);
  const [notify, setNotify] = useState(false);
  const [frequency, setFrequency] = useState(30);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const notifiedAt = useRef(0);
  const currentPlace = places.find((place) => place.slug === slug);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ radius: String(radius) });
    if (gps) { params.set("lat", String(gps.latitude)); params.set("lng", String(gps.longitude)); }
    else params.set("near", slug);
    setBusy(true);
    fetch(`/api/places?${params}`, { signal: controller.signal }).then(async (res) => {
      const result = await res.json(); if (!res.ok) throw new Error(result.error || "Nearby search failed."); return result;
    }).then((result) => { setItems(result.results); setOrigin(result.origin); setRouting(result.roadRoutingAvailable); setError(false); setNotice(null); })
      .catch((cause) => { if (cause.name !== "AbortError") { setError(true); setNotice(cause.message); } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [slug, gps?.latitude, gps?.longitude, radius]);
  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition((position) => setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => { setTracking(false); setError(true); setNotice("Tracking stopped: location permission is unavailable."); },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [tracking]);
  useEffect(() => {
    if (tracking && notify && items.length && typeof Notification !== "undefined" && Notification.permission === "granted" && Date.now() - notifiedAt.current > frequency * 60000) {
      const nearest = items.find((place) => !skipped.includes(place.id));
      if (nearest) { new Notification("A place to discover nearby", { body: `${nearest.name} is in your search area. Check the route before travelling.` }); notifiedAt.current = Date.now(); }
    }
  }, [items, tracking, notify, frequency, skipped]);
  const visible = [...items].filter((place) => !skipped.includes(place.id)).sort((a, b) => {
    if (sort === "hidden") return Number(b.isHidden) - Number(a.isHidden) || a.proximityKm - b.proximityKm;
    if (sort === "category") return a.category.localeCompare(b.category);
    if (sort === "travel" && routing) return (a.roadDurationSeconds ?? Infinity) - (b.roadDurationSeconds ?? Infinity);
    return routing ? (a.roadDistanceMeters ?? Infinity) - (b.roadDistanceMeters ?? Infinity) : a.proximityKm - b.proximityKm;
  });
  const markers: MapMarker[] = [...(origin ? [{ id: "origin", name: origin.name, latitude: origin.latitude, longitude: origin.longitude, kind: "origin" as const }] : []),
    ...visible.map((place) => ({ id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude, slug: place.slug, kind: place.isHidden ? "hidden" as const : "place" as const }))];
  const saveTrip = async () => {
    if (!loggedIn) { setError(true); setNotice("Log in to save a trip, or open the route in Google Maps below."); return; }
    const stops = [currentPlace, ...items.filter((place) => selected.includes(place.id))].filter((place) => !!place).map((place) => ({ destinationId: place.id, day: 1 }));
    if (!stops.length) { setError(true); setNotice("Choose at least one catalog destination to save."); return; }
    try { const result = await postAction({ action: "create-trip", title: `${origin?.name ?? "Nearby"} discoveries`, days: 1, stops });
      window.location.href = `/trips?highlight=${result.tripId}`;
    } catch (cause) { setError(true); setNotice(cause instanceof Error ? cause.message : "Could not save trip."); }
  };
  const requestNotifications = async (checked: boolean) => {
    if (!checked) { setNotify(false); return; }
    if (!("Notification" in window)) { setNotice("This browser does not support notifications."); return; }
    const result = await Notification.requestPermission();
    if (result === "granted") setNotify(true); else { setError(true); setNotice("Notifications were not enabled. Nearby search still works."); }
  };
  const next = visible[0];
  return <><div className="filter-bar"><div className="field"><label className="small muted" htmlFor="near-origin">Starting point</label><select className="form-control" id="near-origin" value={gps ? "gps" : slug} onChange={(e) => { if (e.target.value === "gps") return; setGps(null); setSlug(e.target.value); setSelected([]); }}><option value="gps" disabled={!gps}>Your current location {gps ? "(active)" : "(use GPS below)"}</option>{places.map((place) => <option key={place.id} value={place.slug}>{place.name} · {place.district}</option>)}</select></div><button className="btn btn-outline" onClick={() => locate((point) => { setGps(point); setNotice("Location is used only for this search unless you enable the companion below."); setError(false); }, (text) => { setNotice(text); setError(true); })}><LocateFixed size={16} /> Use my location</button></div>
    <div className="result-topbar"><div><span className="small muted">Search radius around {origin?.name ?? currentPlace?.name ?? "your location"}</span><div className="radius-row" style={{ marginTop: 9 }}>{radii.map((km) => <button key={km} className={`radius-button ${radius === km ? "active" : ""}`} onClick={() => setRadius(km)}>{km} km</button>)}</div></div><div className="form-field" style={{ marginBottom: 0 }}><label htmlFor="near-sort">Sort results</label><select id="near-sort" className="form-control" value={sort} onChange={(e) => setSort(e.target.value)}><option value="nearest">{routing ? "Shortest road distance" : "Geographic proximity"}</option><option value="hidden">Offbeat first</option><option value="category">Category</option><option value="travel" disabled={!routing}>Travel time {routing ? "" : "(requires Routes API)"}</option></select></div></div>
    <ActionNotice text={notice} error={error} />
    {!routing && <p className="notice notice-warning" style={{ marginBottom: 17 }}>Search radius uses geographic proximity, not driving distance. Road distances and travel times require the Google Routes API. Use Directions to check the real journey.</p>}
    <div className="nearby-layout"><div><div className="result-topbar"><h3>{busy ? "Finding places…" : `${visible.length} places to explore`}</h3>{selected.length > 0 && <button onClick={saveTrip} className="btn btn-primary" style={{ minHeight: 36, padding: "0 11px" }}>Save {selected.length} stops <ArrowRight size={13} /></button>}</div>
      {next && !busy && <div className="notice" style={{ marginBottom: 14 }}><strong>{routing && next.roadDistanceMeters !== null ? "Recommended next stop" : "A nearby option"}:</strong> {next.name}{!routing && " (proximity only; compare routes before travelling)"}.</div>}
      <div className="nearby-results">{busy ? <p className="muted small">Searching the published catalog…</p> : visible.length ? visible.map((place) => <div className="nearby-card" key={place.id}>{place.imageUrl ? <img src={place.imageUrl} alt={place.name} /> : <div className="mini-placeholder" />}<div className="nearby-card-body"><Link href={`/places/${place.slug}`}>{place.name}</Link><p>{place.category} · {place.district} {place.isHidden && "· Offbeat"}</p><p>{place.roadDistanceMeters !== null ? `${(place.roadDistanceMeters / 1000).toFixed(1)} km by road · ${formatDuration(place.roadDurationSeconds ?? 0)}` : "Road distance unavailable"}</p><div className="nearby-card-actions"><button onClick={() => setSelected((old) => old.includes(place.id) ? old.filter((id) => id !== place.id) : [...old, place.id])}>{selected.includes(place.id) ? "✓ Added" : "+ Add stop"}</button><a href={directionsUrl(place, origin ?? undefined)} target="_blank" rel="noopener noreferrer">Directions ↗</a><button onClick={() => setSkipped((old) => [...old, place.id])}>Skip</button></div></div></div>) : <EmptyState title="No places in this radius" description="Try a wider radius or a different starting point. We don't invent places to fill results." />}</div>
      <div className="companion-card"><h3><Bell size={15} className="inline" /> Optional travel companion</h3><p>With your permission, your browser can look for new places as your location changes. Tracking stops immediately when you switch it off or leave this page.</p><label className="toggle-row"><input type="checkbox" checked={tracking} onChange={(e) => { setTracking(e.target.checked); if (!e.target.checked) { setNotify(false); setGps(null); } }} /> Enable live location</label>{tracking && <div style={{ marginTop: 12 }}><label className="toggle-row"><input type="checkbox" checked={notify} onChange={(e) => void requestNotifications(e.target.checked)} /> Send browser notifications</label><label className="small muted" style={{ display: "block", marginTop: 10 }}>At most once every <select className="form-control" style={{ width: 125, marginLeft: 6 }} value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}><option value={10}>10 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label></div>}</div>
    </div><InteractiveMap center={origin ?? { latitude: 14.13, longitude: 75.90472 }} markers={markers} height={600} /></div>
    {selected.length > 0 && <div className="form-actions" style={{ marginTop: 22 }}><Link href={`/route-planner?stops=${[slug, ...items.filter((place) => selected.includes(place.id)).map((place) => place.slug)].join(",")}`} className="btn btn-outline"><Route size={16} /> Plan route with selected stops</Link><button className="btn btn-primary" onClick={saveTrip}>Save to my trips <ArrowRight size={16} /></button></div>}
  </>;
}

export function MapExplorer({ places, categories }: { places: CatalogPlace[]; categories: { name: string; slug: string }[] }) {
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<CatalogPlace | null>(null);
  const [gps, setGps] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = places.filter((place) => !category || place.categorySlug === category);
  const markers: MapMarker[] = [...(gps ? [{ id: "gps", name: "Your location", ...gps, kind: "origin" as const }] : []),
    ...filtered.map((place) => ({ id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude, slug: place.slug,
      kind: place.isHidden ? "hidden" as const : "place" as const }))];
  return <><div className="filter-bar"><div className="field"><label className="sr-only" htmlFor="map-category">Category</label><select id="map-category" className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div><button className="btn btn-outline" onClick={() => locate(setGps, setError)}><LocateFixed size={16} /> Show my location</button><span className="small muted">{filtered.length} published places on map</span></div>
    {error && <p className="inline-error">{error}</p>}<div className="content-sidebar" style={{ gridTemplateColumns: "minmax(0,1fr) 290px" }}><InteractiveMap center={gps ?? { latitude: 14.2, longitude: 75.8 }} markers={markers} height={620} zoom={7} /><div style={{ maxHeight: 620, overflowY: "auto" }}>{filtered.map((place) => <button key={place.id} onClick={() => setSelected(place)} className="market-card" style={{ width: "100%", textAlign: "left", cursor: "pointer", borderColor: selected?.id === place.id ? "#639979" : undefined }}><strong style={{ fontSize: 13 }}>{place.name}</strong><p>{place.category} · {place.district}</p><Link href={`/places/${place.slug}`} className="text-link">View details <ArrowRight size={13} /></Link></button>)}</div></div><p className="form-help" style={{ marginTop: 10 }}>Map pins show reference locations, not guaranteed entrances. Open a place for source and visitor details.</p>
  </>;
}

type RouteResult = { distanceMeters: number; durationSeconds: number; encodedPolyline: string; waypointOrder: number[];
  suggestions: (CatalogPlace & { corridorKm: number })[]; note: string };
export function RoutePlanner({ places, initialSlugs = [], loggedIn }: { places: CatalogPlace[]; initialSlugs?: string[]; loggedIn: boolean }) {
  const [originType, setOriginType] = useState("bengaluru");
  const [gps, setGps] = useState<Point | null>(null);
  const [destination, setDestination] = useState(initialSlugs[0] || "shanti-sagara");
  const [extra, setExtra] = useState(initialSlugs.slice(1));
  const [newStop, setNewStop] = useState("");
  const [mode, setMode] = useState<"DRIVE" | "WALK" | "BICYCLE">("DRIVE");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const originPoint = originType === "gps" && gps ? gps : originType === "bengaluru" ? { latitude: 12.9716, longitude: 77.5946 } : places.find((p) => p.slug === originType) ?? { latitude: 12.9716, longitude: 77.5946 };
  const stops = [destination, ...extra].map((slug) => places.find((place) => place.slug === slug)).filter((place) => !!place);
  const points = [originPoint, ...stops.map((place) => ({ latitude: place.latitude, longitude: place.longitude }))];
  const orderedWaypoints = result?.waypointOrder?.length === points.length - 2 ? result.waypointOrder.map((index) => points[index + 1]) : points.slice(1, -1);
  const navigation = points.length >= 2 ? directionsUrl(points[points.length - 1], originPoint, orderedWaypoints,
    mode === "DRIVE" ? "driving" : mode === "WALK" ? "walking" : "bicycling") : "#";
  const calculate = async () => {
    if (points.length < 2) return;
    setBusy(true); setMessage(null); setError(false); setResult(null);
    try { const response = await fetch("/api/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points, mode }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not calculate route."); setResult(data);
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Could not calculate route."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!loggedIn) { setError(true); setMessage("Log in to save this trip."); return; }
    try { const data = await postAction({ action: "create-trip", title: `Bengaluru to ${stops[stops.length - 1]?.name ?? "Karnataka"}`,
      startLocation: originType === "bengaluru" ? "Bengaluru" : originType === "gps" ? "My location" : places.find((p) => p.slug === originType)?.name,
      days: 1, transport: mode.toLowerCase(), stops: stops.map((place) => ({ destinationId: place.id, day: 1 })) });
      window.location.href = `/trips?highlight=${data.tripId}`;
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Could not save trip."); }
  };
  return <div className="content-sidebar" style={{ gridTemplateColumns: "390px minmax(0,1fr)" }}><div className="white-card"><h3>Build your route</h3><p>Choose your stops, then calculate a live route if Google Routes is configured. Navigation always opens in Google Maps.</p>
    <div className="form-field"><label htmlFor="route-origin">Starting from</label><select id="route-origin" className="form-control" value={originType} onChange={(e) => { setOriginType(e.target.value); setResult(null); }}><option value="bengaluru">Bengaluru (city centre)</option>{gps && <option value="gps">My current location</option>}{places.map((place) => <option key={place.id} value={place.slug}>{place.name}</option>)}</select></div><button type="button" className="btn btn-outline" style={{ marginBottom: 16 }} onClick={() => locate((point) => { setGps(point); setOriginType("gps"); setResult(null); }, (text) => { setError(true); setMessage(text); })}><LocateFixed size={15} /> Start from my GPS</button>
    <div className="form-field"><label htmlFor="route-destination">Main destination</label><select id="route-destination" className="form-control" value={destination} onChange={(e) => { setDestination(e.target.value); setResult(null); }}>{places.map((place) => <option key={place.id} value={place.slug}>{place.name} · {place.district}</option>)}</select></div>
    {extra.length > 0 && <div className="route-stops">{extra.map((slug, index) => <div className="route-stop" key={`${slug}-${index}`}><span className="stop-number">{index + 2}</span><span>{places.find((p) => p.slug === slug)?.name}</span><button aria-label={`Remove ${slug}`} onClick={() => { setExtra((old) => old.filter((_, i) => i !== index)); setResult(null); }}><X size={15} /></button></div>)}</div>}
    <div className="form-field"><label htmlFor="route-new-stop">Add another stop (up to 6)</label><div style={{ display: "flex", gap: 7 }}><select id="route-new-stop" className="form-control" value={newStop} onChange={(e) => setNewStop(e.target.value)}><option value="">Choose a place</option>{places.filter((p) => p.slug !== destination && !extra.includes(p.slug)).map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}</select><button className="btn btn-outline" type="button" disabled={!newStop || extra.length >= 6} onClick={() => { setExtra([...extra, newStop]); setNewStop(""); setResult(null); }}><Plus size={17} /></button></div></div>
    <div className="form-field"><label htmlFor="route-mode">Travel mode</label><select id="route-mode" className="form-control" value={mode} onChange={(e) => { setMode(e.target.value as typeof mode); setResult(null); }}><option value="DRIVE">Driving</option><option value="WALK">Walking</option><option value="BICYCLE">Cycling (where supported)</option></select></div>
    <div className="form-actions"><button className="btn btn-primary" onClick={calculate} disabled={busy || stops.length === 0}>{busy ? "Calculating…" : "Calculate route"} <Route size={16} /></button><a className="btn btn-outline" target="_blank" rel="noopener noreferrer" href={navigation}>Open in Google Maps <ArrowUpRight size={15} /></a></div><ActionNotice text={message} error={error} />
    {result && <><div className="route-summary"><div><strong>{(result.distanceMeters / 1000).toFixed(1)} km</strong><span>Road distance</span></div><div><strong>{formatDuration(result.durationSeconds)}</strong><span>Estimated travel time</span></div></div><p className="form-help">{result.waypointOrder.length ? "Google optimised intermediate stops. " : ""}Traffic and access can change. Check navigation before departure.</p></>}
    <button className="btn btn-outline" style={{ marginTop: 18 }} onClick={save}>Save journey to My Trips <ArrowRight size={15} /></button>
  </div><div><InteractiveMap center={originPoint} markers={[{ id: "origin", name: originType === "bengaluru" ? "Bengaluru" : "Start", ...originPoint, kind: "origin" }, ...stops.map((p) => ({ id: p.id, name: p.name, latitude: p.latitude, longitude: p.longitude, slug: p.slug, kind: p.isHidden ? "hidden" as const : "place" as const }))]} route={result ? decodePolyline(result.encodedPolyline) : []} height={490} />
    {result?.suggestions?.length ? <div style={{ marginTop: 23 }}><h3 className="serif" style={{ fontSize: 27, marginBottom: 6 }}>Interesting places along the way</h3><p className="small muted" style={{ marginBottom: 15 }}>{result.note}</p><div className="two-col">{result.suggestions.map((place) => <div className="market-card" key={place.id}><strong>{place.name}</strong><p>{place.category} · {place.district}</p><div className="market-actions"><Link className="btn btn-outline" href={`/places/${place.slug}`}>View place</Link><button className="btn btn-primary" disabled={extra.includes(place.slug) || extra.length >= 6} onClick={() => { setExtra([...extra, place.slug]); setResult(null); }}>Add stop</button></div></div>)}</div></div> : <div className="notice" style={{ marginTop: 14 }}>Choose your route stops and calculate for a mapped line and source-backed suggestions. Road metrics are shown only when returned by Google Routes.</div>}
  </div></div>;
}
