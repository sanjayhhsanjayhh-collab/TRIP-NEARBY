import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { ArrowRight, CalendarDays, ChevronRight, Compass, MapPin } from "lucide-react";
import { db } from "@/db";
import { trips, tripStops } from "@/db/schema";
import { InteractiveMap } from "@/components/interactive-map";
import { PageIntro } from "@/components/ui";
import { directionsUrl } from "@/lib/geo";

export const dynamic = "force-dynamic";
export default async function SharedTripPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [trip] = await db.select({ id: trips.id, title: trips.title, days: trips.days, travelDate: trips.travelDate,
    startLocation: trips.startLocation, itinerary: trips.itinerary }).from(trips).where(eq(trips.shareId, id)).limit(1);
  if (!trip) notFound();
  const stops = await db.select({ id: tripStops.id, name: tripStops.name, latitude: tripStops.latitude,
    longitude: tripStops.longitude, day: tripStops.day, sortOrder: tripStops.sortOrder }).from(tripStops)
    .where(eq(tripStops.tripId, trip.id)).orderBy(asc(tripStops.day), asc(tripStops.sortOrder));
  const mapped = stops.filter((stop): stop is typeof stop & { latitude: number; longitude: number } => stop.latitude !== null && stop.longitude !== null);
  return <main><PageIntro eyebrow="A journey worth sharing" title={trip.title} description="A traveller's saved itinerary. Destinations and notes are traveller-selected; check routes, access and conditions before setting out." /><div className="container-wide page-content"><div className="breadcrumb"><Link href="/">Home</Link><ChevronRight /><span>Shared trip</span></div><div className="content-sidebar"><div><div className="white-card"><span className="pill"><CalendarDays size={13} /> {trip.days} {trip.days === 1 ? "day" : "days"}</span><h3 style={{ marginTop: 14 }}>{trip.title}</h3><p>{trip.startLocation ? `Starting in ${trip.startLocation} · ` : ""}{trip.travelDate ? `${trip.travelDate} · ` : ""}{stops.length} {stops.length === 1 ? "stop" : "stops"}</p><div className="notice notice-warning">This is a shared plan, not confirmed travel advice. Road distances, hours, availability and prices are not provided.</div></div>{trip.itinerary?.map((day) => <div className="white-card" key={day.day} style={{ marginTop: 14 }}><p className="eyebrow">Day {day.day}</p><h3>{day.title}</h3>{day.activities.map((activity, i) => <p key={i}><ArrowRight size={13} className="inline" /> {activity}</p>)}</div>)}{!trip.itinerary?.length && stops.map((stop) => <div className="route-stop" key={stop.id} style={{ marginTop: 9 }}><span className="stop-number">{stop.day}</span><span>{stop.name}</span></div>)}</div><aside className="sidebar-card sticky"><h3>The journey on a map</h3>{mapped.length ? <InteractiveMap center={mapped[0]} markers={mapped.map((stop) => ({ id: stop.id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude }))} height={300} /> : <p>Map coordinates are not available for these stops.</p>}{mapped.length > 1 && <a className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} target="_blank" rel="noopener noreferrer" href={directionsUrl(mapped[mapped.length - 1], mapped[0], mapped.slice(1, -1))}>Open route in Google Maps <ArrowRight size={14} /></a>}<Link href="/planner" className="text-link" style={{ marginTop: 18 }}>Create your own trip <ArrowRight size={14} /></Link></aside></div></div></main>;
}
