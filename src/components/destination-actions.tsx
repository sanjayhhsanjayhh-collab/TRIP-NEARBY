"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Bookmark, Flag, Plus, Star } from "lucide-react";
import { ActionNotice, postAction } from "@/components/action-utils";

export function DestinationActions({ destinationId, destinationName, savedInitially, loggedIn, trips }: {
  destinationId: string; destinationName: string; savedInitially: boolean; loggedIn: boolean; trips: { id: string; title: string }[];
}) {
  const [saved, setSaved] = useState(savedInitially);
  const [showReview, setShowReview] = useState(false);
  const [showTrip, setShowTrip] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => { if (!loggedIn) { setError(true); setMessage("Please log in to save places."); return; }
    try { const result = await postAction({ action: "save-place", destinationId }); setSaved(Boolean(result.saved)); setMessage(result.saved ? "Saved to your places." : "Removed from saved places."); setError(false); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not save place."); setError(true); } };
  const addTrip = async (form: FormData) => {
    if (!loggedIn) { setMessage("Please log in to create a trip."); setError(true); return; }
    setBusy(true);
    try { const tripId = String(form.get("tripId"));
      if (tripId === "new") { await postAction({ action: "create-trip", title: `${destinationName} journey`, days: 1, stops: [{ destinationId, day: 1 }] }); setMessage("New trip created with this place."); }
      else { const result = await postAction({ action: "add-stop", tripId, destinationId }); setMessage(String(result.message ?? "Added to your trip.")); }
      setError(false); setShowTrip(false);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not add place to trip."); setError(true); }
    finally { setBusy(false); }
  };
  const review = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget);
    try { const result = await postAction({ action: "review", destinationId, rating: Number(form.get("rating")), body: form.get("body") }); setMessage(String(result.message)); setError(false); setShowReview(false); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not submit review."); setError(true); }
    finally { setBusy(false); } };
  const report = async () => { const reason = window.prompt("What information about this destination needs correction? (at least 10 characters)");
    if (!reason) return;
    try { const result = await postAction({ action: "report", destinationId, reason }); setMessage(String(result.message)); setError(false); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Please log in to report an issue."); setError(true); } };
  return <><div className="detail-action-row"><button className="btn btn-outline" onClick={() => void save()}><Bookmark size={16} fill={saved ? "#194a3b" : "none"} /> {saved ? "Saved" : "Save place"}</button><button className="btn btn-primary" onClick={() => setShowTrip(!showTrip)}><Plus size={16} /> Add to trip</button><button className="btn btn-outline" onClick={() => setShowReview(!showReview)}><Star size={16} /> Write review</button></div><ActionNotice text={message} error={error} />
    {showTrip && <div className="white-card" style={{ marginTop: 15, maxWidth: 440 }}><h3>Add to your journey</h3>{!loggedIn ? <p><Link className="text-link" href="/auth?mode=login">Log in to save trips <ArrowRight size={14} /></Link></p> : <form action={(form) => void addTrip(form)}><div className="form-field"><label>Choose a trip</label><select className="form-control" name="tripId"><option value="new">Create a new trip</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></div><button className="btn btn-primary" disabled={busy}>Add place</button></form>}</div>}
    {showReview && <div className="white-card" style={{ marginTop: 15, maxWidth: 520 }}><h3>Share an honest review</h3>{!loggedIn ? <p><Link className="text-link" href="/auth?mode=login">Log in to write a review <ArrowRight size={14} /></Link></p> : <form onSubmit={review}><div className="form-field"><label>Rating</label><select className="form-control" name="rating">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} {rating === 1 ? "star" : "stars"}</option>)}</select></div><div className="form-field"><label>Your genuine experience</label><textarea className="form-control" name="body" minLength={20} required placeholder="What did you see? What should visitors know?" /></div><button className="btn btn-primary" disabled={busy}>Submit for moderation</button></form>}</div>}
    <button className="text-link" style={{ border: 0, background: "none", marginTop: 15 }} onClick={() => void report()}><Flag size={14} /> Report incorrect information</button>
  </>;
}
