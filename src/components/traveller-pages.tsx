"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, Heart, MapPin, MessageCircle, Pencil, Plus, Send, Share2, Sparkles, Trash2 } from "lucide-react";
import { ActionNotice, PhotoUpload, postAction } from "@/components/action-utils";
import { LogoutButton, PasswordManager } from "@/components/auth-experience";
import { EmptyState, PlaceCard } from "@/components/ui";
import type { CatalogPlace } from "@/lib/catalog";

type User = { id: string; name: string; email: string; role: string; location: string | null; avatarUrl: string | null };

type PlanStop = { id: string; slug: string; name: string; district: string; category: string; sourceUrl: string | null };
type PlannedDay = { day: number; title: string; note: string; stops: PlanStop[] };
type Plan = { provider: string; warning: string | null; main: { name: string; slug: string }; days: PlannedDay[]; disclaimer: string; request: { startLocation: string; travelDate?: string; days: number; travellers: number; budget?: number; transport: string; interests: string[] } };
const interests = ["Heritage", "Nature", "Waterfalls", "Food", "Photography", "Offbeat places", "Relaxation", "Trekking"];

export function TripPlannerPage({ places, loggedIn }: { places: CatalogPlace[]; loggedIn: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [selectedInterests, setInterests] = useState<string[]>(["Nature", "Offbeat places"]);
  const [shareId, setShareId] = useState<string | null>(null);
  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null); setPlan(null); setShareId(null);
    const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      startLocation: form.get("startLocation"), destinationSlug: form.get("destinationSlug"), travelDate: form.get("travelDate") || undefined,
      days: Number(form.get("days")), travellers: Number(form.get("travellers")), budget: form.get("budget") ? Number(form.get("budget")) : undefined,
      transport: form.get("transport"), interests: selectedInterests.slice(0, 6),
    }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not create an outline.");
      setPlan(result); setError(false); if (result.warning) setMessage(result.warning);
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Could not create an outline."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!plan) return;
    if (!loggedIn) { setError(true); setMessage("Log in to save and share this itinerary."); return; }
    setSaving(true);
    try { const result = await postAction({ action: "create-trip", title: `${plan.request.startLocation} to ${plan.main.name}`,
      startLocation: plan.request.startLocation, travelDate: plan.request.travelDate, days: plan.request.days,
      travellers: plan.request.travellers, budget: plan.request.budget, transport: plan.request.transport,
      interests: plan.request.interests.join(", "),
      itinerary: plan.days.map((day) => ({ day: day.day, title: day.title, activities: [...day.stops.map((s) => s.name), day.note] })),
      stops: plan.days.flatMap((day) => day.stops.map((stop) => ({ destinationId: stop.id, day: day.day }))),
    }); setShareId(String(result.shareId)); setError(false); setMessage("Itinerary saved to My Trips. You can edit it there too.");
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Could not save itinerary."); }
    finally { setSaving(false); }
  };
  const editDay = (index: number, field: "title" | "note", value: string) => setPlan((old) => old ? { ...old, days: old.days.map((day, i) => i === index ? { ...day, [field]: value } : day) } : old);
  return <div className="content-sidebar"><div className="white-card"><h3>Tell us about your trip</h3><p>Build a grounded outline using only published TripNearby destinations. Live routing and prices are not assumed.</p><form onSubmit={generate}><div className="form-row"><div className="form-field"><label>Starting location *</label><input name="startLocation" className="form-control" defaultValue="Bengaluru" required minLength={2} /></div><div className="form-field"><label>Main destination *</label><select name="destinationSlug" className="form-control" defaultValue="shanti-sagara">{places.map((p) => <option key={p.id} value={p.slug}>{p.name} · {p.district}</option>)}</select></div></div><div className="form-row three"><div className="form-field"><label>Travel date</label><input name="travelDate" type="date" className="form-control" /></div><div className="form-field"><label>Days</label><input name="days" type="number" min="1" max="10" defaultValue="2" className="form-control" required /></div><div className="form-field"><label>Travellers</label><input name="travellers" type="number" min="1" max="20" defaultValue="2" className="form-control" required /></div></div><div className="form-row"><div className="form-field"><label>Budget in ₹ (optional, your own limit)</label><input name="budget" type="number" min="0" className="form-control" placeholder="Not an estimated trip cost" /></div><div className="form-field"><label>Preferred transport</label><select name="transport" className="form-control"><option value="car">Car</option><option value="bike">Bike</option><option value="public transport">Public transport</option><option value="walking">Walking</option></select></div></div><div className="form-field"><label>What interests you?</label><div className="filter-pills" style={{ margin: "3px 0 8px" }}>{interests.map((interest) => <button key={interest} type="button" className={`filter-pill ${selectedInterests.includes(interest) ? "active" : ""}`} onClick={() => setInterests((old) => old.includes(interest) ? old.filter((i) => i !== interest) : old.length < 6 ? [...old, interest] : old)}>{interest}</button>)}</div></div><button className="btn btn-primary" disabled={busy}>{busy ? "Building your itinerary…" : "Create itinerary"} <Sparkles size={16} /></button><ActionNotice text={message} error={error} /></form></div>
    <div>{plan ? <><div className="white-card" style={{ marginBottom: 18 }}><span className="pill">{plan.provider === "openai" ? "AI-assisted · source-grounded" : "Catalog-based outline · AI not configured"}</span><h3 style={{ marginTop: 15 }}>{plan.request.startLocation} → {plan.main.name}</h3><p>{plan.request.days} days · {plan.request.travellers} travellers · {plan.request.transport}{plan.request.budget != null ? ` · Your stated budget ₹${plan.request.budget.toLocaleString("en-IN")}` : ""}</p><div className="notice notice-warning">{plan.disclaimer}</div></div>{plan.days.map((day, index) => <div className="white-card" key={day.day} style={{ marginBottom: 13 }}><p className="eyebrow">Day {day.day}</p><input aria-label={`Day ${day.day} title`} className="form-control" style={{ fontFamily: "Georgia, serif", fontSize: 23, marginBottom: 13 }} value={day.title} maxLength={120} onChange={(e) => editDay(index, "title", e.target.value)} />{day.stops.length ? day.stops.map((stop) => <div key={stop.id} className="route-stop"><span className="stop-number">{day.day}</span><span><Link href={`/places/${stop.slug}`}>{stop.name}</Link> <small className="muted">· {stop.district}</small></span>{stop.sourceUrl && <a href={stop.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">Source ↗</a>}</div>) : <p>No additional catalog stops in this search area. Enjoy a slower day or explore another district.</p>}<label className="form-field" style={{ marginTop: 13 }}><span className="small muted">Your notes / suggested pacing</span><textarea className="form-control" maxLength={500} value={day.note} onChange={(e) => editDay(index, "note", e.target.value)} /></label></div>)}<div className="form-actions"><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save this trip"} <Bookmark size={15} /></button><Link href={`/route-planner?stops=${plan.days.flatMap((day) => day.stops.map((s) => s.slug)).slice(0, 7).join(",")}`} className="btn btn-outline">Check road route <ArrowUpRight size={15} /></Link>{shareId && <Link href={`/shared/${shareId}`} className="btn btn-outline">View shareable trip <Share2 size={15} /></Link>}</div></> : <div className="empty-state"><span className="empty-icon"><Sparkles size={25} /></span><h3>A little planning. A lot of possibility.</h3><p>Your day-by-day outline will appear here. We only suggest places that exist in our published catalog.</p></div>}</div>
  </div>;
}

type CommunityPost = { id: string; body: string; imageUrl: string | null; createdAt: Date; author: string; destination: string | null; destinationSlug: string | null; likes: number };
export function CommunityPage({ posts, loggedIn, places }: { posts: CommunityPost[]; loggedIn: boolean; places: CatalogPlace[] }) {
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commenting, setCommenting] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "community-post", body: form.get("body"), destinationId: form.get("destinationId") || undefined, imageUrl: photo || null });
      setMessage(String(result.message)); setError(false); event.currentTarget.reset(); setPhoto("");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not post."); setError(true); }
  };
  const like = async (post: CommunityPost) => { try { const result = await postAction({ action: "like-post", postId: post.id });
    setLikeCounts((old) => ({ ...old, [post.id]: (old[post.id] ?? post.likes) + (result.liked ? 1 : -1) }));
  } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not like post."); setError(true); } };
  const comment = async (event: FormEvent<HTMLFormElement>, postId: string) => { event.preventDefault(); const form = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "comment-post", postId, body: form.get("body") }); setMessage(String(result.message)); setError(false); setCommenting(null);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not comment."); setError(true); }
  };
  return <div className="content-sidebar"><div><ActionNotice text={message} error={error} />{posts.length ? posts.map((post) => <article className="post-card" key={post.id}><div className="post-header"><div className="post-avatar">{post.author.slice(0, 1).toUpperCase()}</div><div><strong>{post.author}</strong><small>{new Date(post.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{post.destination && ` · ${post.destination}`}</small></div></div><p>{post.body}</p>{post.imageUrl && <img className="post-photo" src={post.imageUrl} alt="Traveller-submitted photograph" />}{post.destinationSlug && <Link href={`/places/${post.destinationSlug}`} className="text-link">View destination <ArrowRight size={14} /></Link>}<div className="post-actions" style={{ marginTop: 15 }}><button onClick={() => loggedIn ? void like(post) : (setMessage("Log in to like posts."), setError(true))}><Heart size={15} /> {likeCounts[post.id] ?? post.likes} likes</button><button onClick={() => setCommenting(commenting === post.id ? null : post.id)}><MessageCircle size={15} /> Comment</button><button onClick={async () => { const reason = window.prompt("What information should we review?"); if (reason?.trim()) { try { await postAction({ action: "report", postId: post.id, reason }); setMessage("Report sent for review."); setError(false); } catch { setMessage("Please log in to report this post."); setError(true); } } }}>Report</button></div>{commenting === post.id && (loggedIn ? <form onSubmit={(e) => void comment(e, post.id)} style={{ marginTop: 15 }}><textarea name="body" className="form-control" minLength={2} required placeholder="Add a kind, helpful comment…" /><button className="btn btn-primary" style={{ marginTop: 8 }}>Submit comment for review</button></form> : <p className="small muted">Log in to comment.</p>)}</article>) : <EmptyState title="The first story is waiting to be told" description="No community posts have been approved yet. Share a genuine travel experience to start the conversation." />}</div><aside className="sidebar-card sticky"><h3>Share your experience</h3><p>Real travel stories help others explore thoughtfully. Posts and comments are moderated before appearing publicly.</p>{!loggedIn ? <Link href={`/auth?mode=login&next=${encodeURIComponent("/community")}`} className="btn btn-primary">Log in to post <ArrowRight size={15} /></Link> : <form onSubmit={submit}><div className="form-field"><label>Your story *</label><textarea className="form-control" name="body" required minLength={20} placeholder="Where did you go? What should another traveller know?" /></div><div className="form-field"><label>Related destination (optional)</label><select name="destinationId" className="form-control"><option value="">Not tied to one place</option>{places.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div><PhotoUpload value={photo} onChange={setPhoto} /><button className="btn btn-primary">Submit for review <Send size={14} /></button></form>}</aside></div>;
}

type MyTrip = typeof import("@/db/schema").trips.$inferSelect & { stops: (typeof import("@/db/schema").tripStops.$inferSelect)[] };
export function TripsPage({ trips: initial, placeSlugs }: { trips: MyTrip[]; placeSlugs: Record<string, string> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [itinerary, setItinerary] = useState<NonNullable<MyTrip["itinerary"]>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const edit = (trip: MyTrip) => { setEditing(trip.id); setTitle(trip.title); setItinerary(trip.itinerary ?? []); };
  const save = async (tripId: string) => { try { await postAction({ action: "update-trip", tripId, title, itinerary }); setEditing(null); setMessage("Trip updated."); setError(false); router.refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not update trip."); setError(true); } };
  const remove = async (tripId: string) => { if (!window.confirm("Delete this trip and all its stops?")) return; try { await postAction({ action: "delete-trip", tripId }); router.refresh(); } catch { setError(true); setMessage("Could not delete trip."); } };
  const removeStop = async (tripId: string, stopId: string) => { try { await postAction({ action: "remove-stop", tripId, stopId }); router.refresh(); } catch { setError(true); setMessage("Could not remove stop."); } };
  return <><div className="section-heading"><div><p className="eyebrow">Your journeys</p><h2>Plans worth keeping.</h2></div><Link className="btn btn-primary" href="/planner">Plan a new trip <Plus size={16} /></Link></div><ActionNotice text={message} error={error} />{initial.length ? initial.map((trip) => <div className="white-card" style={{ marginBottom: 18 }} key={trip.id}><div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}><div><span className="pill"><CalendarDays size={13} /> {trip.days} {trip.days === 1 ? "day" : "days"}</span><h3 style={{ marginTop: 12 }}>{trip.title}</h3><p>{trip.startLocation ? `Starting from ${trip.startLocation} · ` : ""}{trip.stops.length} {trip.stops.length === 1 ? "stop" : "stops"}{trip.travelDate ? ` · ${trip.travelDate}` : ""}</p></div><div className="detail-action-row"><button className="btn btn-outline" onClick={() => edit(trip)}><Pencil size={14} /> Edit</button><button className="btn btn-outline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/shared/${trip.shareId}`); setError(false); setMessage("Share link copied."); } catch { setError(true); setMessage("Copy failed. Open the shared trip link instead."); } }}><Share2 size={14} /> Copy link</button><button className="btn btn-danger" onClick={() => void remove(trip.id)}><Trash2 size={14} /></button></div></div>
      {trip.stops.length > 0 && <div className="route-stops">{trip.stops.map((stop) => <div className="route-stop" key={stop.id}><span className="stop-number">{stop.day}</span><span>{stop.destinationId && placeSlugs[stop.destinationId] ? <Link href={`/places/${placeSlugs[stop.destinationId]}`}>{stop.name}</Link> : stop.name}</span><button aria-label={`Remove ${stop.name}`} onClick={() => void removeStop(trip.id, stop.id)}><Trash2 size={14} /></button></div>)}</div>}
      {editing === trip.id ? <div style={{ marginTop: 15 }}><div className="form-field"><label>Trip title</label><input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} /></div>{itinerary.map((day, index) => <div className="form-field" key={index}><label>Day {day.day} · {day.title} (one activity per line)</label><textarea className="form-control" value={day.activities.join("\n")} onChange={(e) => setItinerary((old) => old.map((d, i) => i === index ? { ...d, activities: e.target.value.split("\n").slice(0, 12) } : d))} /></div>)}<button className="btn btn-primary" onClick={() => void save(trip.id)}>Save changes</button></div> : trip.itinerary?.length ? <div style={{ marginTop: 15 }}>{trip.itinerary.map((day) => <p key={day.day} className="small muted"><strong>Day {day.day}: {day.title}</strong> — {day.activities.join(" · ")}</p>)}</div> : null}
      <Link className="text-link" href={`/shared/${trip.shareId}`}>Open shareable trip <ArrowUpRight size={15} /></Link></div>) : <EmptyState title="No trips saved yet" description="Start with a real place, build a route or create a day-by-day outline. Your saved journeys will live here." href="/planner" action="Plan a trip" />}</>;
}
function initialPlaceSlug(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export function SavedPage({ places }: { places: CatalogPlace[] }) {
  const router = useRouter(); const [message, setMessage] = useState<string | null>(null);
  return <><div className="section-heading"><div><p className="eyebrow">Your collection</p><h2>Places to come back to.</h2></div><Link href="/explore" className="btn btn-outline">Find more places <ArrowRight size={15} /></Link></div><ActionNotice text={message} />{places.length ? <div className="places-grid">{places.map((place) => <div key={place.id}><PlaceCard place={place} /><button className="btn btn-outline" style={{ marginTop: 8, width: "100%" }} onClick={async () => { try { await postAction({ action: "save-place", destinationId: place.id }); router.refresh(); } catch { setMessage("Could not remove saved place."); } }}><Bookmark size={14} /> Remove from saved</button></div>)}</div> : <EmptyState title="Nothing saved just yet" description="When a place catches your eye, save it from its destination page for later." href="/explore" action="Explore places" />}</>;
}

export function ProfilePage({ user }: { user: User }) {
  const router = useRouter(); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const f = new FormData(event.currentTarget);
    try { await postAction({ action: "profile", name: f.get("name"), location: f.get("location") }); setMessage("Profile updated."); setError(false); router.refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not update profile."); setError(true); } };
  return <div className="content-sidebar"><div className="white-card"><span className="pill">Traveller account</span><h3 style={{ marginTop: 16 }}>Welcome, {user.name}.</h3><p>Your account details are private. Only your name appears with approved community posts and reviews.</p><form onSubmit={submit}><div className="form-field"><label>Name</label><input className="form-control" name="name" defaultValue={user.name} required /></div><div className="form-field"><label>Email</label><input className="form-control" value={user.email} disabled /></div><div className="form-field"><label>Home location (optional)</label><input className="form-control" name="location" defaultValue={user.location ?? ""} placeholder="e.g. Bengaluru" /></div><button className="btn btn-primary">Save profile</button><ActionNotice text={message} error={error} /></form><PasswordManager /></div><aside className="sidebar-card"><h3>Your TripNearby</h3><div className="route-stops">{[["Saved places", "/saved"], ["My trips", "/trips"], ["Dealer dashboard", "/dealer"], ["Community", "/community"], ...(user.role === "admin" ? [["Admin dashboard", "/admin"]] : [])].map(([label, href]) => <Link className="route-stop" key={href} href={href}>{label}<ArrowRight size={15} style={{ marginLeft: "auto" }} /></Link>)}</div><LogoutButton /></aside></div>;
}

export function ContactPage() {
  const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "contact", name: form.get("name"), email: form.get("email"), message: form.get("message") }); setMessage(String(result.message)); setError(false); event.currentTarget.reset(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not send message."); setError(true); }
    finally { setBusy(false); } };
  return <div className="content-sidebar"><div className="white-card"><h3>Send us a message</h3><p>Found incorrect information, have a partnership idea, or want to say hello? We&apos;d love to hear from you.</p><form onSubmit={submit}><div className="form-row"><div className="form-field"><label>Your name *</label><input className="form-control" name="name" required minLength={2} /></div><div className="form-field"><label>Email *</label><input className="form-control" name="email" type="email" required /></div></div><div className="form-field"><label>Message *</label><textarea className="form-control" name="message" minLength={10} required /></div><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send message"} <Send size={15} /></button><ActionNotice text={message} error={error} /></form></div><aside className="sidebar-card"><h3>A note about listings</h3><p>Want to suggest a place? Use our hidden place submission form. Running a local business? Register a free listing for review.</p><Link className="text-link" href="/hidden-places">Suggest a place <ArrowRight size={15} /></Link><br /><Link className="text-link" href="/business-register">List a business <ArrowRight size={15} /></Link></aside></div>;
}
