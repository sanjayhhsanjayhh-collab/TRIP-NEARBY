"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, ArrowUpRight, Bike, Camera, CheckCircle2, Clock3, Compass, Fuel, LocateFixed, MapPin, MessageCircle, Navigation, Plus, Search, ShieldCheck, Store, Tent, Trash2, X } from "lucide-react";
import { ActionNotice, PhotoUpload, postAction } from "@/components/action-utils";
import { EmptyState, SectionHeading } from "@/components/ui";
import { directionsUrl, haversineKm, type Point } from "@/lib/geo";
import type { PublicBusiness } from "@/lib/catalog";

export const serviceCategories = [
  { slug: "bike-rentals", label: "Bike rentals", detail: "Scooters, motorcycles and more", icon: Bike },
  { slug: "camera-rentals", label: "Camera rentals", detail: "Cameras, lenses and equipment", icon: Camera },
  { slug: "car-rentals", label: "Car rentals", detail: "Self-drive cars and SUVs", icon: Compass },
  { slug: "camping-equipment", label: "Camping equipment", detail: "Tents and outdoor essentials", icon: Tent },
  { slug: "travel-shops", label: "Travel shops", detail: "Bags and travel accessories", icon: Store },
  { slug: "trekking-shops", label: "Trekking shops", detail: "Footwear and trail gear", icon: Compass },
  { slug: "vehicle-services", label: "Vehicle services", detail: "Garages and mechanics", icon: Store },
  { slug: "essential-services", label: "Essentials", detail: "Fuel, pharmacies and ATMs", icon: Fuel },
  { slug: "hotels", label: "Hotels & homestays", detail: "Places to rest along the way", icon: Store },
  { slug: "restaurants", label: "Restaurants", detail: "Discover somewhere to eat", icon: Store },
];

type Product = { id: string; listingId: string; name: string; description: string | null; priceRupees: number | null; priceUnit: string | null; available: boolean };
type LivePlace = { id: string; name: string; address: string; latitude?: number; longitude?: number; mapsUrl?: string; type: string };

function EnquiryForm({ listingId, guideId, onClose }: { listingId?: string; guideId?: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "enquiry", listingId, guideId, message: form.get("message"), travelDate: form.get("travelDate") || undefined });
      setMessage(String(result.message)); setError(false); event.currentTarget.reset();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not send enquiry."); setError(true); }
    finally { setBusy(false); }
  };
  return <div className="white-card" style={{ marginTop: 13, background: "#f7faf7" }}><div style={{ display: "flex", justifyContent: "space-between" }}><h3 style={{ fontSize: 20 }}>Send an enquiry</h3><button type="button" aria-label="Close enquiry" onClick={onClose}><X size={16} /></button></div><p className="small muted">This sends a request, not a confirmed booking. The provider will need to confirm details directly.</p><form onSubmit={submit}><div className="form-field"><label>Preferred date (optional)</label><input className="form-control" name="travelDate" type="date" /></div><div className="form-field"><label>Your message *</label><textarea className="form-control" name="message" required minLength={10} placeholder="Tell them when you plan to visit and what you're looking for." /></div><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send enquiry"} <ArrowRight size={14} /></button><ActionNotice text={message} error={error} /></form></div>;
}

export function MarketplacePage({ initialCategory, listings, products, loggedIn, places }: { initialCategory: string; listings: PublicBusiness[]; products: Product[]; loggedIn: boolean; places: { slug: string; name: string; latitude: number; longitude: number }[] }) {
  const [category, setCategory] = useState(initialCategory === "services" ? "bike-rentals" : initialCategory);
  const [location, setLocation] = useState("bengaluru");
  const [gps, setGps] = useState<Point | null>(null);
  const [radius, setRadius] = useState(25);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState<LivePlace[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [enquiring, setEnquiring] = useState<string | null>(null);
  const point = location === "gps" && gps ? gps : location === "bengaluru" ? { latitude: 12.9716, longitude: 77.5946 } : places.find((p) => p.slug === location) ?? { latitude: 12.9716, longitude: 77.5946 };
  const filtered = listings.filter((listing) => (category === "hotels" ? ["hotels", "homestays", "resorts", "guest-houses", "campsites"].includes(listing.category) : listing.category === category)
    && (!search || `${listing.name} ${listing.address} ${listing.description || ""}`.toLowerCase().includes(search.toLowerCase()))
    && haversineKm(point.latitude, point.longitude, listing.latitude, listing.longitude) <= radius);
  const searchLive = async () => {
    setLiveLoading(true); setLiveNote(null); setLive(null);
    try { const params = new URLSearchParams({ category, lat: String(point.latitude), lng: String(point.longitude), radius: String(radius) });
      const response = await fetch(`/api/places-live?${params}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Live search unavailable.");
      setLive(data.results ?? []); setLiveNote(data.message || (data.configured ? "Live Google Places results. These are not TripNearby-verified businesses. Check details with the provider." : "Live search is not configured."));
    } catch (cause) { setLiveNote(cause instanceof Error ? cause.message : "Live search failed."); }
    finally { setLiveLoading(false); }
  };
  return <>{initialCategory === "services" && <div className="service-grid" style={{ marginBottom: 32 }}>{serviceCategories.map((item) => <button type="button" key={item.slug} className="service-tile" style={{ textAlign: "left", borderColor: category === item.slug ? "#699d76" : undefined }} onClick={() => { setCategory(item.slug); setLive(null); setLiveNote(null); }}><span className="service-icon"><item.icon size={21} /></span><h3>{item.label}</h3><p>{item.detail}</p></button>)}</div>}
    <div className="content-sidebar"><div><div className="section-heading" style={{ marginBottom: 18 }}><div><p className="eyebrow">Approved local listings</p><h2>{serviceCategories.find((item) => item.slug === category)?.label ?? "Local services"}</h2><p className="section-description">Listings are shown only after review. Search distance is a geographic radius, not road distance.</p></div></div>
      <div className="filter-bar"><div className="field"><label className="sr-only" htmlFor="service-search">Search businesses</label><input id="service-search" className="form-control" placeholder="Search approved listings…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="small muted">{filtered.length} approved {filtered.length === 1 ? "listing" : "listings"}</span></div>
      {filtered.length ? filtered.map((listing) => <div className="market-card" key={listing.id}><div className="market-card-top">{listing.imageUrl ? <img className="market-thumb" src={listing.imageUrl} alt={listing.name} /> : <div className="market-thumb" style={{ display: "grid", placeItems: "center" }}><Store size={23} color="#64936e" /></div>}<div><div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}><h3>{listing.name}</h3>{listing.verified && <span className="pill"><ShieldCheck size={12} /> Verified details</span>}</div><p>{listing.address}</p><span className="small muted">{listing.category.replaceAll("-", " ")} · Geographic search radius</span></div></div>{listing.description && <p>{listing.description}</p>}{listing.hours && <div className="market-meta"><Clock3 size={13} /> Dealer-provided hours: {listing.hours}</div>}
        {products.filter((p) => p.listingId === listing.id).map((product) => <div className="notice" style={{ marginTop: 7 }} key={product.id}><strong>{product.name}</strong> {product.priceRupees != null && `· ₹${product.priceRupees}${product.priceUnit ? ` / ${product.priceUnit}` : ""}`} · {product.available ? "Dealer-marked available" : "Ask about availability"}<br /><small>Dealer-provided information; confirm price and availability directly.</small></div>)}
        <div className="market-actions"><a className="btn btn-outline" target="_blank" rel="noopener noreferrer" href={directionsUrl(listing)}><Navigation size={14} /> Directions</a>{listing.phone && <a href={`tel:${listing.phone.replace(/[^+\d]/g, "")}`} className="btn btn-outline">Call business</a>}{listing.whatsapp && <a href={`https://wa.me/${listing.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">WhatsApp</a>}{loggedIn ? <button className="btn btn-primary" onClick={() => setEnquiring(enquiring === listing.id ? null : listing.id)}>Enquire <ArrowRight size={14} /></button> : <Link className="btn btn-primary" href="/auth?mode=login">Log in to enquire</Link>}</div>
        {enquiring === listing.id && <EnquiryForm listingId={listing.id} onClose={() => setEnquiring(null)} />}</div>) : <EmptyState title="No approved listings here yet" description="We don't create imaginary dealers or rates. Try another location or category, search live Google Places if configured, or invite a real business to join." href="/business-register" action="List a business" />}
      <div style={{ marginTop: 28 }}><SectionHeading kicker="Optional live search" title="Search beyond our listings." description="Live results are provided by Google Places and are not TripNearby-verified. No prices, reviews or availability are assumed." />
        <button className="btn btn-outline" onClick={searchLive} disabled={liveLoading}><Search size={15} /> {liveLoading ? "Searching Google Places…" : "Search live Google Places"}</button>{liveNote && <p className="notice" style={{ marginTop: 13 }}>{liveNote}</p>}{live !== null && <><p className="small muted" style={{ margin: "16px 0" }}>Results from Google Maps · {live.length} found · Check details with the provider</p>{live.map((item) => <div className="market-card" key={item.id}><h3>{item.name}</h3><p>{item.type} · {item.address}</p>{item.mapsUrl && <a className="text-link" href={item.mapsUrl} target="_blank" rel="noopener noreferrer">View on Google Maps <ArrowUpRight size={15} /></a>}</div>)}{!live.length && <p className="small muted">No live results for this search. Try a wider radius or a different location.</p>}</>}</div>
    </div><aside className="market-filters sticky"><h3>Find services near</h3><div className="form-field"><label htmlFor="market-location">Location</label><select id="market-location" className="form-control" value={location} onChange={(e) => { setLocation(e.target.value); setLive(null); }}><option value="bengaluru">Bengaluru</option>{gps && <option value="gps">My location</option>}{places.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></div><button className="btn btn-outline" style={{ width: "100%" }} onClick={() => { if (!navigator.geolocation) { setLiveNote("Geolocation isn't available."); return; } navigator.geolocation.getCurrentPosition((pos) => { setGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocation("gps"); setLive(null); }, () => setLiveNote("Location permission denied or unavailable.")); }}><LocateFixed size={15} /> Use my GPS</button><div className="form-field" style={{ marginTop: 18 }}><label>Search radius</label><div className="radius-row">{[5, 10, 25, 50, 100].map((km) => <button key={km} type="button" className={`radius-button ${radius === km ? "active" : ""}`} onClick={() => { setRadius(km); setLive(null); }}>{km} km</button>)}</div></div><p className="form-help">Google Places live lookup covers up to 50 km per search. Approved listings can use the full 100 km radius.</p><hr style={{ border: 0, borderTop: "1px solid #e5eee5", margin: "19px 0" }} /><h3 style={{ fontSize: 20 }}>Have a local business?</h3><p>Join with a free listing. Listings are reviewed before they go live. No payment is collected.</p><Link className="btn btn-primary" href="/business-register">List your business <ArrowRight size={15} /></Link></aside></div>
  </>;
}

export function BusinessRegistration({ loggedIn }: { loggedIn: boolean }) {
  const [coords, setCoords] = useState<Point | null>(null);
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "create-business", name: form.get("name"), category: form.get("category"), description: form.get("description"),
      address: form.get("address"), latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")), phone: form.get("phone"),
      whatsapp: form.get("whatsapp"), hours: form.get("hours"), imageUrl: photo || null });
      setMessage(String(result.message)); setError(false); event.currentTarget.reset(); setPhoto("");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not register business."); setError(true); }
    finally { setBusy(false); }
  };
  if (!loggedIn) return <div className="empty-state"><h3>Log in to list your business</h3><p>A free account lets you manage your listing and receive genuine enquiries.</p><Link className="btn btn-primary" href={`/auth?mode=login&next=${encodeURIComponent("/business-register")}`}>Log in or register <ArrowRight size={16} /></Link></div>;
  return <div className="content-sidebar"><div className="white-card"><h3>Tell us about your business</h3><p>Submit real information only. Your listing is not public until it has been reviewed.</p><form onSubmit={submit}><div className="form-row"><div className="form-field"><label>Business name *</label><input className="form-control" name="name" required minLength={3} /></div><div className="form-field"><label>Category *</label><select className="form-control" name="category" required>{serviceCategories.filter((c) => c.slug !== "essential-services").map((item) => <option value={item.slug} key={item.slug}>{item.label}</option>)}<option value="homestays">Homestay</option><option value="resorts">Resort</option><option value="guest-houses">Guest house</option><option value="campsites">Campsite</option></select></div></div>
    <div className="form-field"><label>What do you offer? *</label><textarea className="form-control" name="description" required minLength={20} placeholder="Describe your actual services, products and what visitors should know." /></div><div className="form-field"><label>Full address *</label><input className="form-control" name="address" required minLength={8} /></div>
    <div className="form-row"><div className="form-field"><label>Latitude *</label><input className="form-control" name="latitude" type="number" min="-90" max="90" step="any" required defaultValue={coords?.latitude} key={`blat-${coords?.latitude}`} /></div><div className="form-field"><label>Longitude *</label><input className="form-control" name="longitude" type="number" min="-180" max="180" step="any" required defaultValue={coords?.longitude} key={`blng-${coords?.longitude}`} /></div></div><button type="button" className="btn btn-outline" style={{ marginBottom: 15 }} onClick={() => navigator.geolocation?.getCurrentPosition((p) => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => { setError(true); setMessage("Location permission denied or unavailable."); })}><LocateFixed size={15} /> Use my shop location</button>
    <div className="form-row"><div className="form-field"><label>Contact number *</label><input className="form-control" name="phone" type="tel" required placeholder="+91 98765 43210" /></div><div className="form-field"><label>WhatsApp number (optional)</label><input className="form-control" name="whatsapp" type="tel" /></div></div><div className="form-field"><label>Opening hours (optional, dealer-provided)</label><input className="form-control" name="hours" placeholder="Only if accurate and up to date" /></div><PhotoUpload value={photo} onChange={setPhoto} label="Shop photograph" /><div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit free listing"} <ArrowRight size={16} /></button><Link href="/dealer" className="btn btn-outline">Go to dealer dashboard</Link></div><ActionNotice text={message} error={error} /></form></div>
    <aside className="sidebar-card"><span className="pill"><ShieldCheck size={13} /> Free listing</span><h3 style={{ marginTop: 17 }}>A better way to be found.</h3><p>Reach travellers looking for local services. Manage your profile, products and incoming enquiries from your dashboard.</p><div className="notice">Featured subscriptions and payments are not active. No charges will be made until a real payment flow is available.</div><p>Verification badges are awarded only after separate checks. Approval alone does not guarantee a verified badge.</p></aside></div>;
}

type Guide = { id: string; name: string; location: string; languages: string; experience: string | null; specialisation: string | null; serviceChargeRupees: number | null; availability: string | null; photoUrl: string | null; verified: boolean };
export function GuidesPage({ guides, loggedIn }: { guides: Guide[]; loggedIn: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [photo, setPhoto] = useState("");
  const [enquiring, setEnquiring] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const f = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "register-guide", name: f.get("name"), location: f.get("location"), languages: f.get("languages"),
      experience: f.get("experience"), specialisation: f.get("specialisation"), availability: f.get("availability"),
      serviceChargeRupees: f.get("rate") ? Number(f.get("rate")) : undefined, photoUrl: photo || null });
      setMessage(String(result.message)); setError(false); setShowForm(false);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not submit guide profile."); setError(true); }
  };
  return <><div className="section-heading"><div><p className="eyebrow">Local knowledge, real connections</p><h2>Explore with someone who knows.</h2><p className="section-description">Only admin-approved guide profiles appear here. Charges and availability are guide-provided and should be confirmed directly.</p></div><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>Become a guide <ArrowRight size={15} /></button></div><ActionNotice text={message} error={error} />
    {showForm && <div className="white-card" style={{ marginBottom: 22, maxWidth: 800 }}><h3>Register as a local guide</h3>{!loggedIn ? <p>Please <Link className="text-link" href={`/auth?mode=login&next=${encodeURIComponent("/guides")}`}>log in to register</Link>.</p> : <form onSubmit={submit}><div className="form-row"><div className="form-field"><label>Your name *</label><input className="form-control" name="name" required /></div><div className="form-field"><label>Location *</label><input className="form-control" name="location" required placeholder="Town, district" /></div></div><div className="form-field"><label>Languages you speak *</label><input className="form-control" name="languages" required placeholder="Kannada, English, Hindi…" /></div><div className="form-field"><label>Experience *</label><textarea className="form-control" name="experience" required minLength={20} placeholder="Describe your genuine guiding experience." /></div><div className="form-row"><div className="form-field"><label>Specialisation</label><input className="form-control" name="specialisation" placeholder="Heritage, trekking, food…" /></div><div className="form-field"><label>Service charge in ₹ (optional, guide-provided)</label><input className="form-control" name="rate" type="number" min="0" /></div></div><div className="form-field"><label>Availability</label><input className="form-control" name="availability" placeholder="e.g. Weekends by request" /></div><PhotoUpload value={photo} onChange={setPhoto} label="Profile photograph" /><button className="btn btn-primary">Submit for review <ArrowRight size={15} /></button></form>}</div>}
    {guides.length ? <div className="places-grid">{guides.map((guide) => <div className="market-card" key={guide.id}>{guide.photoUrl ? <img className="market-thumb" src={guide.photoUrl} alt={guide.name} /> : <span className="service-icon"><Compass size={22} /></span>}<h3>{guide.name} {guide.verified && <span className="pill"><ShieldCheck size={12} /> Verified details</span>}</h3><p><MapPin size={13} className="inline" /> {guide.location}</p><p><strong>Languages:</strong> {guide.languages}</p><p>{guide.experience}</p>{guide.specialisation && <p><strong>Specialises in:</strong> {guide.specialisation}</p>}{guide.serviceChargeRupees != null && <p>Guide-provided charge: ₹{guide.serviceChargeRupees} · confirm scope directly</p>}{guide.availability && <p>Guide-provided availability: {guide.availability}</p>}{loggedIn ? <button className="btn btn-primary" onClick={() => setEnquiring(enquiring === guide.id ? null : guide.id)}>Enquire <ArrowRight size={14} /></button> : <Link href="/auth?mode=login" className="btn btn-outline">Log in to enquire</Link>}{enquiring === guide.id && <EnquiryForm guideId={guide.id} onClose={() => setEnquiring(null)} />}</div>)}</div> : <EmptyState title="No approved guide profiles yet" description="We're inviting real local guides. Register your profile to be reviewed; we don't publish invented guide details." />}
  </>;
}

type DealerListing = typeof import("@/db/schema").businessListings.$inferSelect;
type DealerEnquiry = { id: string; listingId: string | null; message: string; status: string; travelDate: string | null; createdAt: Date; travellerName: string; travellerEmail: string };
export function DealerDashboard({ listings, products, enquiries }: { listings: DealerListing[]; products: Product[]; enquiries: DealerEnquiry[] }) {
  const [tab, setTab] = useState("listings");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();
  const updateListing = async (event: FormEvent<HTMLFormElement>, listing: DealerListing) => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "update-business", listingId: listing.id, description: f.get("description"), address: f.get("address"),
      latitude: Number(f.get("latitude")), longitude: Number(f.get("longitude")), phone: f.get("phone"), hours: f.get("hours"), imageUrl: photo || listing.imageUrl });
      setMessage(String(result.message)); setError(false); setEditing(null); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Update failed."); setError(true); }
  };
  const addProduct = async (event: FormEvent<HTMLFormElement>, listingId: string) => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    try { await postAction({ action: "add-product", listingId, name: f.get("name"), description: f.get("description"),
      priceRupees: f.get("price") ? Number(f.get("price")) : undefined, priceUnit: f.get("unit"), available: f.get("available") === "on" });
      setMessage("Product added. Dealer-provided prices and availability should be kept current."); setError(false); setAdding(null); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not add product."); setError(true); }
  };
  return <><div className="stat-grid"><div className="stat-card"><strong>{listings.length}</strong><span>Your listings</span></div><div className="stat-card"><strong>{listings.filter((l) => l.status === "approved").length}</strong><span>Approved</span></div><div className="stat-card"><strong>{enquiries.length}</strong><span>Enquiries</span></div><div className="stat-card"><strong>{products.length}</strong><span>Products</span></div></div><div className="dashboard-tabs">{["listings", "enquiries", "subscription"].map((item) => <button key={item} className={`dashboard-tab ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item === "subscription" ? "Plan & billing" : item[0].toUpperCase() + item.slice(1)}</button>)}</div><ActionNotice text={message} error={error} />
    {tab === "listings" && <><div className="section-heading"><div><h2>Your business listings</h2><p className="section-description">Manage real business details. Edits to an approved profile return it to review.</p></div><Link className="btn btn-primary" href="/business-register"><Plus size={16} /> New listing</Link></div>{!listings.length && <EmptyState title="You haven't listed a business" description="Create a free listing to start receiving real traveller enquiries after admin approval." href="/business-register" action="Create free listing" />}{listings.map((listing) => <div className="white-card" style={{ marginBottom: 14 }} key={listing.id}><div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}><div><h3>{listing.name}</h3><p>{listing.category.replaceAll("-", " ")} · {listing.address}</p></div><span className="pill">{listing.status === "approved" ? "Approved" : listing.status === "pending" ? "Awaiting review" : "Not approved"}{listing.verified ? " · Verified details" : ""}</span></div><p>{listing.description}</p><div className="form-actions"><button className="btn btn-outline" onClick={() => { setEditing(editing === listing.id ? null : listing.id); setPhoto(""); }}>Edit listing</button><button className="btn btn-outline" onClick={() => setAdding(adding === listing.id ? null : listing.id)}>Add product or service</button></div>
      {editing === listing.id && <form onSubmit={(event) => void updateListing(event, listing)} style={{ marginTop: 20 }}><div className="form-field"><label>Description</label><textarea name="description" className="form-control" defaultValue={listing.description ?? ""} required minLength={20} /></div><div className="form-field"><label>Address</label><input name="address" className="form-control" defaultValue={listing.address} required /></div><div className="form-row"><div className="form-field"><label>Latitude</label><input name="latitude" className="form-control" type="number" step="any" defaultValue={listing.latitude} required /></div><div className="form-field"><label>Longitude</label><input name="longitude" className="form-control" type="number" step="any" defaultValue={listing.longitude} required /></div></div><div className="form-row"><div className="form-field"><label>Phone</label><input name="phone" className="form-control" defaultValue={listing.phone ?? ""} required /></div><div className="form-field"><label>Hours</label><input name="hours" className="form-control" defaultValue={listing.hours ?? ""} /></div></div><PhotoUpload value={photo} onChange={setPhoto} /><button className="btn btn-primary">Save & send for review</button></form>}
      {adding === listing.id && <form onSubmit={(event) => void addProduct(event, listing.id)} style={{ marginTop: 18 }}><div className="form-row"><div className="form-field"><label>Product or service *</label><input name="name" className="form-control" required /></div><div className="form-field"><label>Price in ₹ (dealer-provided, optional)</label><input name="price" className="form-control" type="number" min="0" /></div></div><div className="form-row"><div className="form-field"><label>Price unit</label><input name="unit" className="form-control" placeholder="day / hour / item" /></div><div className="form-field"><label>Description</label><input name="description" className="form-control" /></div></div><label className="toggle-row"><input name="available" type="checkbox" /> Currently available (confirm regularly)</label><button className="btn btn-primary" style={{ marginTop: 15 }}>Add product</button></form>}
      {products.filter((p) => p.listingId === listing.id).map((p) => <div className="admin-item" key={p.id} style={{ marginTop: 12 }}><strong>{p.name}</strong><p>{p.priceRupees != null ? `₹${p.priceRupees}${p.priceUnit ? ` / ${p.priceUnit}` : ""}` : "Price on enquiry"} · {p.available ? "Marked available" : "Availability not confirmed"}</p><button className="btn btn-danger" onClick={async () => { try { await postAction({ action: "delete-product", productId: p.id }); router.refresh(); } catch { setError(true); setMessage("Could not delete product."); } }}><Trash2 size={13} /> Remove</button></div>)}</div>)}</>}
    {tab === "enquiries" && <><h2 className="serif" style={{ fontSize: 35, marginBottom: 20 }}>Traveller enquiries</h2>{enquiries.length ? enquiries.map((item) => <div className="market-card" key={item.id}><h3>{item.travellerName}</h3><p>{item.message}</p><p>Preferred date: {item.travelDate ?? "Not specified"} · Status: {item.status}</p><a className="text-link" href={`mailto:${item.travellerEmail}`}>Reply by email <ArrowUpRight size={14} /></a></div>) : <EmptyState title="No enquiries yet" description="When travellers enquire about approved listings, their messages will appear here. No bookings are implied until you confirm directly." />}</>}
    {tab === "subscription" && <div className="white-card"><h3>Your plan: Free listing</h3><p>Free listings have no subscription charge. Featured plans are not available yet because payment processing is not enabled.</p><p className="notice">No billing details are collected and no charges will be made. Listing performance analytics will be added when genuine view data is available.</p></div>}
  </>;
}

