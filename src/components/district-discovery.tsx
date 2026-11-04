"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Compass, LoaderCircle, LocateFixed, MapPin, Plus, Route, ShieldCheck, Sparkles, X } from "lucide-react";
import { InteractiveMap, type MapMarker } from "@/components/interactive-map";
import { EmptyState, SectionHeading } from "@/components/ui";
import { verificationLabels } from "@/lib/labels";
import type { DistrictPlace } from "@/lib/districts";
import { decodePolyline, directionsUrl, formatDuration, type Point } from "@/lib/geo";

export type DistrictResult = DistrictPlace & { roadDistanceMeters?: number | null; roadDurationSeconds?: number | null };
type Neighbor = { id: string; slug: string; name: string; district: string; districtSlug: string; category: string;
  town: string | null; taluk: string | null; districtNote: string | null; verificationLabel: string;
  boundaryDistanceKm: number; sourceUrl: string | null };
type Stats = { total: number; hidden: number; officiallyVerified: number; locationVerified: number;
  communitySubmitted: number; pendingVerification: number; communitySubmissions: number; missingPhotos: number;
  localityPins: number; taluks: { name: string; count: number }[]; categories: { name: string; slug: string; count: number }[];
  missingTaluks: string[]; missingCategories: string[]; boundary: { sourceUrl: string; sourceLabel: string | null; bbox: number[] } | null };
type RouteSuggestion = DistrictResult & { corridorKm: number };
type RouteData = { configured: boolean; message?: string; note?: string; roadRoutingAvailable?: boolean;
  route?: { distanceMeters: number; durationSeconds: number; encodedPolyline: string };
  points?: Point[]; suggestions: RouteSuggestion[]; nextRecommended?: RouteSuggestion | null };
type Props = {
  districtSlug: string; stateSlug: string; districtName: string; googleConfigured: boolean;
  initial: { results: DistrictResult[]; total: number; page: number; pageSize: number; hasMore: boolean; pages: number };
  stats: Stats; boundaryNeighbors: Neighbor[];
  categories: { name: string; slug: string }[]; taluks: string[];
  center: Point; routeOptions: { slug: string; name: string; latitude: number; longitude: number; taluk: string | null }[];
};

function DistrictCard({ place, roadAvailable }: { place: DistrictResult; roadAvailable: boolean }) {
  const road = typeof place.roadDistanceMeters === "number";
  const distance = road
    ? `${(place.roadDistanceMeters! / 1000).toFixed(1)} km by road · ${formatDuration(place.roadDurationSeconds ?? 0)}`
    : roadAvailable ? "Road distance unavailable"
    : place.geographicDistanceKm !== null ? `${place.geographicDistanceKm.toFixed(1)} km geographic radius (not road distance)`
    : "Road distance unavailable · choose a start";
  return <article className="place-card district-place-card">
    <div className={`place-card-image ${!place.imageUrl ? "image-placeholder" : ""}`}>
      {place.imageUrl ? <img src={place.imageUrl} alt={place.name} loading="lazy" /> : <div className="placeholder-art"><Compass size={26} /><span>Photo not yet available</span></div>}
      <span className="card-badge">{place.isHidden ? <><Sparkles size={12} /> Offbeat</> : place.category}</span>
    </div>
    <div className="place-card-body">
      <span className="place-card-location"><MapPin size={13} /> {place.town || place.taluk || place.district}, {place.district}</span>
      <h3>{place.name}</h3><p>{place.description}</p>
      <div className="card-meta-row"><span className="verification-chip">{place.verificationLabel || verificationLabels[place.verificationLevel]}</span>{place.coordinatePrecision === "locality" && <span className="small muted">Town reference pin</span>}</div>
      <p className="small muted" style={{ margin: "0 0 10px" }}>{place.subcategory} · {distance}</p>
      {place.districtNote && <p className="form-help">{place.districtNote}</p>}
      <Link href={`/places/${place.slug}`} className="text-link">View details <ArrowRight size={14} /></Link>
    </div>
  </article>;
}

export function DistrictDiscovery({ districtSlug, stateSlug, districtName, googleConfigured, initial, stats,
  boundaryNeighbors, categories, taluks, center, routeOptions }: Props) {
  const [results, setResults] = useState<DistrictResult[]>(initial.results);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [taluk, setTaluk] = useState("");
  const [verification, setVerification] = useState("");
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [sort, setSort] = useState("featured");
  const [radius, setRadius] = useState(25);
  const [roads, setRoads] = useState(false);
  const [roadRoutingAvailable, setRoadRoutingAvailable] = useState(false);
  const [startMode, setStartMode] = useState("all");
  const [gps, setGps] = useState<Point | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [endSlug, setEndSlug] = useState(routeOptions[0]?.slug ?? "shanti-sagara");
  const [mode, setMode] = useState<"DRIVE" | "WALK" | "BICYCLE">("DRIVE");
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const [addedStops, setAddedStops] = useState<string[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const firstRender = useRef(true);
  const loadGuard = useRef(false);

  const startPoint = useMemo<Point | null>(() => {
    if (startMode === "all") return null;
    if (startMode === "district") return center;
    if (startMode === "bengaluru") return { latitude: 12.9716, longitude: 77.5946 };
    if (startMode === "gps") return gps;
    const option = routeOptions.find((p) => p.slug === startMode);
    return option ? { latitude: option.latitude, longitude: option.longitude } : null;
  }, [startMode, gps, center, routeOptions]);
  const startName = startMode === "all" ? `${districtName} district centre` : startMode === "district" ? `${districtName} district centre` :
    startMode === "bengaluru" ? "Bengaluru city centre" : startMode === "gps" ? "My current location" :
    routeOptions.find((p) => p.slug === startMode)?.name ?? "Selected start";
  const filterKey = JSON.stringify({ search, category, taluk, verification, hiddenOnly, sort, radius, roads,
    startPoint: startPoint ? [startPoint.latitude, startPoint.longitude] : null });

  const buildParams = (nextPage: number) => {
    const params = new URLSearchParams({ district: districtSlug, state: stateSlug, page: String(nextPage),
      pageSize: String(initial.pageSize), sort });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (taluk) params.set("taluk", taluk);
    if (verification) params.set("verification", verification);
    if (hiddenOnly) params.set("hidden", "true");
    if (startPoint) {
      params.set("lat", String(startPoint.latitude)); params.set("lng", String(startPoint.longitude));
      params.set("radius", String(radius)); if (roads && googleConfigured) params.set("roads", "true");
    }
    return params;
  };
  const fetchPage = async (nextPage: number, append: boolean) => {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/destinations?${buildParams(nextPage)}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load district places.");
      if (controllerRef.current !== controller) return;
      setResults((old) => {
        if (!append) return data.results ?? [];
        const merged = new Map(old.map((item) => [item.id, item]));
        (data.results as DistrictResult[] ?? []).forEach((item) => merged.set(item.id, item));
        return [...merged.values()];
      });
      setTotal(data.total ?? 0); setPage(data.page ?? nextPage); setHasMore(Boolean(data.hasMore));
      setRoadRoutingAvailable(Boolean(data.roadRoutingAvailable));
      setLocationNotice(data.note ?? null);
    } catch (cause) {
      if ((cause as Error).name !== "AbortError" && controllerRef.current === controller) setError(cause instanceof Error ? cause.message : "Could not load district places.");
    } finally { if (controllerRef.current === controller) { setLoading(false); setLoadingMore(false); } }
  };
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = setTimeout(() => void fetchPage(1, false), 250);
    return () => { clearTimeout(timer); controllerRef.current?.abort(); };
  // The filter signature intentionally controls requests; one AbortController prevents duplicates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const useGps = () => {
    if (!navigator.geolocation) { setLocationNotice("Geolocation is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setStartMode("gps"); setLocationNotice("Location permission granted for this search. It is not stored or tracked.");
    }, () => setLocationNotice("Location permission was denied or your position was unavailable."), { enableHighAccuracy: false, timeout: 12000 });
  };

  const findRoute = async (event?: FormEvent) => {
    event?.preventDefault();
    if (loadGuard.current) return;
    loadGuard.current = true; setRouteBusy(true); setError(null); setRouteData(null);
    const start = startPoint ?? center;
    try {
      const response = await fetch("/api/discovery/route", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtSlug, start: { ...start, name: startName }, endSlug, stopSlugs: addedStops, mode, radius }) });
      const data = await response.json() as RouteData & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not calculate route recommendations.");
      setRouteData(data); setVisited([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not calculate route recommendations."); }
    finally { loadGuard.current = false; setRouteBusy(false); }
  };
  const endPoint = routeOptions.find((p) => p.slug === endSlug) ?? routeOptions[0];
  const suggestions = routeData?.suggestions ?? [];
  const nextPlace = suggestions.find((p) => !visited.includes(p.slug) && !addedStops.includes(p.slug)) ?? null;
  const routeLine = routeData?.route?.encodedPolyline ? decodePolyline(routeData.route.encodedPolyline) : [];
  const markers: MapMarker[] = results.map((place) => ({ id: place.id, name: place.name, latitude: place.latitude,
    longitude: place.longitude, slug: place.slug, kind: place.isHidden ? "hidden" : "place" }));
  const groupedTaluks = [...new Set(results.map((p) => p.taluk).filter((v): v is string => !!v))]
    .map((name) => ({ name, places: results.filter((p) => p.taluk === name) })).sort((a, b) => b.places.length - a.places.length);
  const navigation = endPoint ? directionsUrl({ latitude: endPoint.latitude, longitude: endPoint.longitude },
    startPoint ?? center, addedStops.map((slug) => routeOptions.find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    mode === "WALK" ? "walking" : mode === "BICYCLE" ? "bicycling" : "driving") : "#";

  return <div className="district-discovery">
    <section className="white-card district-overview"><div className="section-heading" style={{ marginBottom: 18 }}><div><p className="eyebrow">District overview</p><h2>{districtName}, in depth.</h2><p className="section-description">Source-backed records across the whole district — not just its main city. Coverage is partial and continuously reviewed.</p></div><Link className="section-all" href="/admin">Admin coverage checklist <ArrowUpRight size={16} /></Link></div>
      <div className="stat-grid">{[
        ["Destinations", stats.total], ["Offbeat places", stats.hidden], ["Officially verified", stats.officiallyVerified],
        ["Location verified", stats.locationVerified], ["Community submitted", stats.communitySubmitted],
        ["Pending verification", stats.pendingVerification], ["Taluks covered", stats.taluks.filter((t) => t.count > 0).length],
        ["Categories covered", stats.categories.filter((c) => c.count > 0).length],
      ].map(([label, count]) => <div className="stat-card" key={String(label)}><strong>{String(count)}</strong><span>{label}</span></div>)}</div>
      <div className="notice notice-warning">This is a working source-backed catalog, not a claim that every tourist place in {districtName} has been discovered. {stats.missingPhotos} records have no photograph and {stats.localityPins} use town/village reference pins rather than exact entrances.</div>
      {stats.boundary && <p className="form-help">District boundary: <a href={stats.boundary.sourceUrl} target="_blank" rel="noopener noreferrer">{stats.boundary.sourceLabel ?? "OpenStreetMap / Nominatim"}</a> · simplified outer ring; map pins are checked against the stored boundary where available.</p>}
    </section>

    <div className="district-toolbar"><div className="filter-bar"><div className="field"><label className="sr-only" htmlFor="district-search">Search district places</label><input id="district-search" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a place, village, taluk or category…" /></div><div className="field"><label className="sr-only" htmlFor="district-category">Category</label><select id="district-category" className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name} ({stats.categories.find((x) => x.slug === c.slug)?.count ?? 0})</option>)}</select></div><div className="field"><label className="sr-only" htmlFor="district-taluk">Taluk</label><select id="district-taluk" className="form-control" value={taluk} onChange={(e) => setTaluk(e.target.value)}><option value="">All taluks</option>{taluks.map((t) => <option key={t} value={t}>{t}</option>)}</select></div></div>
      <div className="filter-bar"><div className="field"><label className="sr-only" htmlFor="district-verification">Verification</label><select id="district-verification" className="form-control" value={verification} onChange={(e) => setVerification(e.target.value)}><option value="">All verification levels</option>{Object.entries(verificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label className="sr-only" htmlFor="district-sort">Sort</label><select id="district-sort" className="form-control" value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Featured first</option><option value="name">Name A–Z</option><option value="hidden">Offbeat first</option><option value="verification">Verification</option><option value="distance" disabled={!startPoint}>Geographic distance (choose a start)</option></select></div><button className={`btn ${hiddenOnly ? "btn-primary" : "btn-outline"}`} onClick={() => setHiddenOnly(!hiddenOnly)}><Sparkles size={15} /> Hidden only</button></div>
      <div className="filter-bar"><div className="field"><label className="sr-only" htmlFor="district-start">Journey start</label><select id="district-start" className="form-control" value={startMode} onChange={(e) => { if (e.target.value === "gps" && !gps) { void useGps(); return; } setStartMode(e.target.value); }}><option value="all">All district places (no radius)</option><option value="district">{districtName} district centre</option><option value="bengaluru">Bengaluru</option><option value="gps" disabled={!gps}>My current location{gps ? " (active)" : ""}</option>{routeOptions.map((p) => <option key={p.slug} value={p.slug}>{p.name}{p.taluk ? ` · ${p.taluk}` : ""}</option>)}</select></div><button className="btn btn-outline" onClick={useGps}><LocateFixed size={15} /> Use my GPS</button><div className="radius-row">{[5, 10, 25, 50, 100].map((km) => <button key={km} className={`radius-button ${radius === km ? "active" : ""}`} onClick={() => setRadius(km)} aria-pressed={radius === km}>{km} km</button>)}</div>{googleConfigured && <label className="toggle-row" style={{ marginLeft: 8 }}><input type="checkbox" checked={roads} onChange={(e) => setRoads(e.target.checked)} disabled={!startPoint} /> Live road distances</label>}</div>
    </div>
    {locationNotice && <p className="notice" style={{ marginBottom: 17 }}>{locationNotice}</p>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div id="district-places" style={{ scrollMarginTop: "100px" }} /><div className="result-topbar"><h3>{loading ? "Updating results…" : `${total} matching ${total === 1 ? "place" : "places"}`}</h3><span className="small muted">{startPoint ? `Within ${radius} km geographic search radius of ${startName}` : "Showing all district records"}</span></div>
    {results.length ? <><div className="places-grid">{results.map((place) => <DistrictCard key={place.id} place={place} roadAvailable={roadRoutingAvailable || roads} />)}</div><div className="form-actions" style={{ justifyContent: "center", marginTop: 28 }}>{hasMore ? <button className="btn btn-primary" disabled={loading || loadingMore} onClick={() => void fetchPage(page + 1, true)}>{loadingMore ? <><LoaderCircle size={16} className="animate-spin" /> Loading…</> : <>Load more places <ChevronRight size={16} /></>}</button> : <span className="small muted">All matching district places are loaded.</span>}</div></> : !loading && <EmptyState title="No matching published places" description="Try a different category, taluk, search term or wider radius. We do not invent places to fill a district." />}

    <section style={{ marginTop: 55 }}><SectionHeading kicker="Map view" title="See the whole district." description="Only loaded destination markers are shown. Load more places to expand the map; map pins may be site-level or town-level references." /><InteractiveMap center={startPoint ?? center} markers={markers} route={routeLine} height={490} zoom={9} /></section>

    <section style={{ marginTop: 55 }}><SectionHeading kicker="Taluk-wise exploration" title="Beyond the district headquarters." description="Grouped using the loaded page of results. Use the taluk filter above for a database-wide list." /><div className="two-col"><div className="white-card"><h3>Taluks in these results</h3>{groupedTaluks.length ? groupedTaluks.map((group) => <div className="route-stop" key={group.name}><span className="stop-number">{group.places.length}</span><span>{group.name}</span><Link href="#district-places" className="text-link">See cards <ArrowRight size={13} /></Link></div>) : <p>No taluk labels on loaded records.</p>}<p className="form-help">Missing taluk coverage: {stats.missingTaluks.join(", ") || "No configured taluk is empty"}</p></div><div className="white-card"><h3>Category coverage</h3><div className="filter-pills">{stats.categories.map((c) => <button key={c.slug} className={`filter-pill ${category === c.slug ? "active" : ""}`} onClick={() => setCategory(c.slug)}>{c.name} · {c.count}</button>)}</div><p className="form-help">Categories with no published records: {stats.missingCategories.join(", ") || "None"}</p><p className="form-help">Unavailable photographs: {stats.missingPhotos} · Locality reference pins: {stats.localityPins}. These are openly marked gaps, not confirmed visitor information.</p><Link className="text-link" href="/hidden-places">Open the Hidden Places engine <ArrowUpRight size={14} /></Link></div></div></section>

    <section style={{ marginTop: 55 }}><SectionHeading kicker="Route-based discovery" title="Keep finding places along the way." description="Choose a start and endpoint. Live road routes use Google Routes; corridor proximity is geometric and never presented as driving distance." />
      <div className="white-card"><form onSubmit={(e) => void findRoute(e)}><div className="form-row three"><div className="form-field"><label>Starting point</label><select className="form-control" value={startMode} onChange={(e) => { if (e.target.value === "gps" && !gps) { void useGps(); return; } setStartMode(e.target.value); }}><option value="all">District centre (default)</option><option value="district">{districtName} district centre</option><option value="bengaluru">Bengaluru</option><option value="gps" disabled={!gps}>My current location{gps ? " (active)" : ""}</option>{routeOptions.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></div><div className="form-field"><label>Ending destination</label><select className="form-control" value={endSlug} onChange={(e) => setEndSlug(e.target.value)}>{routeOptions.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></div><div className="form-field"><label>Travel mode</label><select className="form-control" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="DRIVE">Driving</option><option value="WALK">Walking</option><option value="BICYCLE">Cycling</option></select></div></div><div className="form-actions"><button className="btn btn-primary" disabled={routeBusy}>{routeBusy ? <><LoaderCircle size={15} className="animate-spin" /> Calculating…</> : <><Route size={15} /> Discover along route</>}</button><a className="btn btn-outline" href={navigation} target="_blank" rel="noopener noreferrer">Open in Google Maps <ArrowUpRight size={14} /></a><span className="small muted">Radius {radius} km · {addedStops.length} added stops</span></div></form>
      {routeData && !routeData.configured && <div className="notice notice-warning" style={{ marginTop: 16 }}>{routeData.message ?? "Live route recommendations are not configured. No road distances or travel times have been estimated."}</div>}
      {routeData?.route && <div className="route-summary"><div><strong>{(routeData.route.distanceMeters / 1000).toFixed(1)} km</strong><span>Google road route</span></div><div><strong>{formatDuration(routeData.route.durationSeconds)}</strong><span>Estimated travel time</span></div><div><strong>{suggestions.length}</strong><span>District places near corridor</span></div></div>}
      {routeData?.note && <p className="form-help">{routeData.note}</p>}
      {nextPlace && <div className="notice" style={{ marginTop: 16 }}><strong>Next recommended place:</strong> {nextPlace.name} · {nextPlace.district} · {nextPlace.taluk || "Taluk not recorded"}<br /><span className="small">{typeof nextPlace.roadDistanceMeters === "number" ? `${(nextPlace.roadDistanceMeters / 1000).toFixed(1)} km by road · ${formatDuration(nextPlace.roadDurationSeconds ?? 0)}` : "Road distance unavailable"}. {nextPlace.corridorKm.toFixed(1)} km geometric corridor proximity, not driving distance.</span><div className="form-actions"><button className="btn btn-outline" onClick={() => setAddedStops((old) => old.includes(nextPlace.slug) ? old : [...old, nextPlace.slug])}><Plus size={14} /> Add stop</button><button className="btn btn-outline" onClick={() => setVisited((old) => [...old, nextPlace.slug])}><Check size={14} /> Mark visited / skip</button></div></div>}
      {suggestions.length > 0 && <><h3 style={{ marginTop: 24 }}>Places along or just off the route</h3><div className="nearby-results">{suggestions.map((place) => <div className="nearby-card" key={place.id}><div className="nearby-card-body"><Link href={`/places/${place.slug}`}>{place.name}</Link><p>{place.category} · {place.taluk || place.district} · {place.verificationLabel}</p><p>{typeof place.roadDistanceMeters === "number" ? `${(place.roadDistanceMeters / 1000).toFixed(1)} km by road · ${formatDuration(place.roadDurationSeconds ?? 0)}` : "Road distance unavailable"} · {place.corridorKm.toFixed(1)} km geometric corridor proximity</p><div className="nearby-card-actions"><button onClick={() => setAddedStops((old) => old.includes(place.slug) ? old : [...old, place.slug])}>{addedStops.includes(place.slug) ? "✓ Added" : "+ Add stop"}</button><button onClick={() => setVisited((old) => old.includes(place.slug) ? old : [...old, place.slug])}>{visited.includes(place.slug) ? "Skipped" : "Skip"}</button></div></div></div>)}</div><div className="form-actions"><Link href={`/route-planner?stops=${[endSlug, ...addedStops].join(",")}`} className="btn btn-primary">Plan selected stops <ArrowRight size={15} /></Link>{addedStops.length > 0 && <button className="btn btn-outline" onClick={() => { setAddedStops([]); setRouteData(null); }}><X size={14} /> Clear stops</button>}</div></>}
      {routeData?.configured && suggestions.length === 0 && <div className="notice" style={{ marginTop: 14 }}>No published district places were found near this route corridor. Try a wider radius or a different endpoint. We do not substitute straight-line guesses for real routes.</div>}
      </div></section>

    <section style={{ marginTop: 55 }}><SectionHeading kicker="District boundary" title="Nearby, but in another district." description="These records are close to the stored boundary and keep their actual district name. Distances to the boundary are geometric, not road distances." />{boundaryNeighbors.length ? <div className="places-grid">{boundaryNeighbors.map((place) => <div className="market-card" key={place.id}><span className="pill">{place.district} district</span><h3 style={{ marginTop: 12 }}>{place.name}</h3><p>{place.category} · {place.town || place.taluk || place.district}</p><p className="small muted">About {place.boundaryDistanceKm.toFixed(1)} km from a boundary reference point · {place.verificationLabel}</p>{place.districtNote && <p className="form-help">{place.districtNote}</p>}<Link className="text-link" href={`/places/${place.slug}`}>View details <ArrowRight size={14} /></Link></div>)}</div> : <div className="notice">No nearby published records from adjacent districts were found. This is a data gap, not proof that none exist.</div>}</section>
  </div>;
}
