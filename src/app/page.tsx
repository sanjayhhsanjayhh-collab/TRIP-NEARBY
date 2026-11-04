import Link from "next/link";
import { ArrowRight, ArrowUpRight, BedDouble, Bike, Camera, Check, Compass, LocateFixed, MapPin, Navigation, Route, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SearchBox } from "@/components/search-box";
import { PlaceCard, SectionHeading } from "@/components/ui";
import { getCategories, getDestinations, getRegions } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [places, categories, regions] = await Promise.all([getDestinations(), getCategories(), getRegions()]);
  const picks = ["hampi", "mysore-palace", "jog-falls"].map((slug) => places.find((place) => place.slug === slug)).filter((place) => !!place);
  const districts = ["davanagere", "mysuru", "kodagu", "vijayanagara"].map((slug) => regions.districts.find((district) => district.slug === slug)).filter((district) => !!district);
  return <main>
    <div className="container-wide hero-wrap"><section className="hero" aria-labelledby="hero-title"><div className="hero-content">
      <div className="hero-kicker"><Sparkles size={12} /> Your next journey starts here</div>
      <h1 id="hero-title">The best journeys<br />take a <em>little detour.</em></h1>
      <p className="hero-copy">Find the extraordinary places around the places you already know. Discover Karnataka, one meaningful stop at a time.</p>
      <SearchBox places={places.map((place) => ({ name: place.name, slug: place.slug, district: place.district }))} categories={categories} />
      <div className="hero-small"><span>Try searching:</span><Link href="/places/shanti-sagara">Shanti Sagara</Link><span>·</span><Link href="/places/hampi">Hampi</Link><span>·</span><Link href="/places/jog-falls">Jog Falls</Link></div>
    </div><div className="hero-floating"><Compass size={25} /><span><strong>Wander well.</strong> The places between places are waiting.</span></div>
    <span className="hero-credit">Western Ghats, Karnataka · Photo: <a href="https://www.pexels.com/photo/lush-green-hills-in-madikeri-karnataka-35710118/" target="_blank" rel="noopener noreferrer">Ankittt Bhattacharjee / Pexels</a></span>
    </section></div>
    <div className="container-wide trust-strip"><span className="trust-intro">Made for the curious traveller.</span><div className="trust-points"><span><ShieldCheck size={16} /> Source-backed places</span><span><LocateFixed size={16} /> Discover within 5–100 km</span><span><MapPin size={16} /> Karnataka first</span></div></div>

    <section className="section-pad container-wide"><SectionHeading kicker="Start exploring" title="Good places. Great stories." description="From ancient stone cities to misty waterfalls, find your next reason to take the scenic route." href="/explore" linkText="Explore all places" />
      {picks.length ? <div className="places-grid">{picks.map((place) => <PlaceCard key={place.id} place={place} size="large" />)}</div> : <p className="notice">No destinations have been added yet. Run the catalog seed described in the setup guide.</p>}
      <div className="category-row">{categories.map((category) => <Link key={category.id} className="category-chip" href={`/explore?category=${category.slug}`}>{category.name}<ArrowUpRight size={13} /></Link>)}</div>
    </section>

    <section className="region-section section-pad-sm"><div className="container-wide"><SectionHeading kicker="Explore Karnataka" title="Every district has a story." description="Browse by district and see what's waiting just beyond the usual itinerary." href="/states/karnataka" linkText="Browse all districts" />
      <div className="region-cards">{districts.map((district) => <Link href={`/states/karnataka/${district.slug}`} className="region-card" key={district.id}><MapPin className="region-icon" size={23} /><ArrowUpRight className="region-arrow" size={17} /><div><h3>{district.name}</h3><p>{district.placeCount} source-backed {district.placeCount === 1 ? "place" : "places"}</p></div></Link>)}</div>
    </div></section>

    <section className="section-pad container-wide"><div className="discovery-panel"><div className="discovery-copy"><p className="eyebrow">The nearby discovery engine</p><h2>There&apos;s always more <em className="serif">around</em> the corner.</h2><p>Pick a destination and see what else is nearby. Explore within 5, 10, 25, 50 or 100 km, then open your next stop in Google Maps.</p><Link className="btn btn-primary" href="/nearby?place=shanti-sagara">Explore nearby places <ArrowRight size={16} /></Link></div><div className="discovery-visual" aria-hidden="true"><span className="map-dot one"><MapPin size={18} /></span><span className="map-dot two"><Sparkles size={17} /></span><span className="map-dot three"><Navigation size={17} /></span><span className="map-float"><strong>More to discover</strong>Find the stops you didn&apos;t plan for.</span></div></div></section>

    <section className="container-wide section-pad-sm" style={{ paddingTop: 0 }}><div className="dark-feature"><div className="dark-feature-copy"><p className="eyebrow eyebrow-light">The TripNearby difference</p><h2>For the places not on everyone&apos;s list.</h2><p>Quiet corners, local favourites and worthwhile detours. Every published offbeat find has a traceable source; new suggestions wait for review.</p><Link className="btn btn-light" href="/hidden-places">Discover offbeat places <ArrowRight size={16} /></Link></div><div className="dark-feature-image"><span className="feature-note">Western Ghats, Karnataka · <a href="https://www.pexels.com/photo/stunning-western-ghats-landscape-in-karnataka-38999700/" target="_blank" rel="noopener noreferrer">Photo: Raghu Manda&apos;s / Pexels</a></span></div></div></section>

    <section className="section-pad container-wide"><SectionHeading kicker="Everything for the journey" title="More than just the destination." description="Local services are part of the adventure. Browse approved businesses, or search live Google Places when the integration is configured." href="/services" linkText="See all services" />
      <div className="service-grid"><Link href="/bike-rentals" className="service-tile"><span className="service-icon"><Bike size={22} /></span><h3>Bike rentals</h3><p>Find a ride for the road ahead.</p><ArrowUpRight size={17} /></Link><Link href="/camera-rentals" className="service-tile"><span className="service-icon"><Camera size={22} /></span><h3>Camera rentals</h3><p>Capture every unexpected moment.</p><ArrowUpRight size={17} /></Link><Link href="/hotels" className="service-tile"><span className="service-icon"><BedDouble size={22} /></span><h3>Stays & homestays</h3><p>Rest up, then explore again.</p><ArrowUpRight size={17} /></Link><Link href="/guides" className="service-tile"><span className="service-icon"><Users size={22} /></span><h3>Local guides</h3><p>See a place through local eyes.</p><ArrowUpRight size={17} /></Link></div>
    </section>

    <section className="container-wide section-pad-sm" style={{ paddingTop: 0 }}><div className="planner-banner"><div className="planner-banner-copy"><p className="eyebrow">Thoughtful planning, lighter packing</p><h2>Your journey, your way.</h2><p>Build a day-by-day outline using real destinations from the TripNearby catalog. Save it, make it yours and take the next turn with confidence.</p><div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}><Link className="btn btn-primary" href="/planner">Plan my trip <ArrowRight size={16} /></Link><Link className="btn btn-outline" href="/route-planner"><Route size={16} /> Plan a route</Link></div></div><div className="planner-banner-image" role="img" aria-label="Misty green hills in Madikeri, Karnataka" /></div></section>

    <section className="container-wide section-pad-sm" style={{ paddingTop: 0 }}><div className="community-strip"><div><p className="eyebrow" style={{ marginBottom: 9 }}>People make the journey</p><h3>Share the place that stayed with you.</h3><p>Real stories from real travellers. Posts and reviews are moderated before they appear.</p></div><Link href="/community" className="btn btn-outline">Visit the community <ArrowRight size={16} /></Link></div></section>
  </main>;
}
