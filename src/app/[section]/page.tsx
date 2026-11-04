import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowRight, ArrowUpRight, MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { bookings, businessListings, rentalProducts, savedPlaces, users } from "@/db/schema";
import { AdminDashboard } from "@/components/admin-dashboard";
import { ExploreBrowser, HiddenBrowser, MapExplorer, NearbyExplorer, RoutePlanner } from "@/components/discovery-pages";
import { BusinessRegistration, DealerDashboard, GuidesPage, MarketplacePage } from "@/components/marketplace-pages";
import { AuthExperience } from "@/components/auth-experience";
import { CommunityPage, ContactPage, ProfilePage, SavedPage, TripPlannerPage, TripsPage } from "@/components/traveller-pages";
import { EmptyState, PageIntro } from "@/components/ui";
import { HiddenDiscoveryPanel } from "@/components/hidden-discovery";
import { getCurrentUser, responseUser } from "@/lib/auth";
import { safeNext } from "@/lib/next";
import { getApprovedGuides, getBusinessListings, getCategories, getCommunityPosts, getDestinations, getMyTrips, getRegions } from "@/lib/catalog";
import { getDistrictCenters, getSourceCounts } from "@/lib/districts";

export const dynamic = "force-dynamic";
const aliases: Record<string, string> = {
  "ai-trip-planner": "planner", "rentals-and-shops": "services", "hotels-and-homestays": "hotels", "local-guides": "guides",
  "my-trips": "trips", "saved-places": "saved", "user-profile": "profile", "business-registration": "business-register",
  "dealer-dashboard": "dealer", "admin-dashboard": "admin", "state-selection": "states", "district-selection": "districts",
};
const marketSlugs = ["bike-rentals", "camera-rentals", "car-rentals", "camping-equipment", "travel-shops", "trekking-shops", "vehicle-services", "essential-services"];
const pageText: Record<string, [string, string, string]> = {
  explore: ["The destination directory", "Explore places worth going for.", "Browse real, source-backed places across Karnataka. Filter by district, category or the kind of trip you're dreaming of."],
  states: ["Country → State", "Where will you wander?", "Start with a state, then explore its districts and the destinations within them."],
  districts: ["Karnataka's districts", "Explore district by district.", "From the coast to the highlands, each district has its own story to tell."],
  "hidden-places": ["The places between places", "Find your own kind of wonder.", "Discover quieter destinations with traceable sources, and suggest a real place for admin review."],
  nearby: ["A little further, a lot more", "See what else is nearby.", "Choose a destination or use your location. Find published attractions within 5–100 km, then check real road routes."],
  map: ["The bigger picture", "Explore Karnataka on the map.", "Follow your curiosity from one mapped destination to the next. Tap a marker to learn more."],
  "route-planner": ["The road ahead", "Make room for the detour.", "Connect real places along your journey. Calculate a live route with Google when configured, or open directions in Google Maps."],
  services: ["Local travel marketplace", "Everything the journey needs.", "Find approved local providers and optional live Google Places results. No invented dealers, prices or availability."],
  hotels: ["Stay a little longer", "Find your place to stay.", "Explore approved hotels, homestays, resorts and campsites. Check rates and availability directly with providers."],
  guides: ["The local perspective", "Go beyond the guidebook.", "Connect with approved local guides, or register your own guide profile for review."],
  restaurants: ["Taste the journey", "Good food, good stories.", "Look for approved restaurants or search live Google Places when the integration is configured."],
  planner: ["Your travel companion", "A trip as unique as you are.", "Build a day-by-day outline grounded in real places. Edit it, save it and share it with your fellow travellers."],
  community: ["The traveller community", "Every journey has a story.", "Share real experiences and discover what fellow travellers have found. Posts are moderated before publication."],
  trips: ["Your journeys", "Trips you'll remember.", "Your saved routes and itineraries, ready for another look and easy to share."],
  saved: ["Your collection", "The places that stayed with you.", "Keep the destinations you want to come back to, all in one place."],
  profile: ["Your account", "Your corner of TripNearby.", "Manage your profile, saved places, trips and local business listings."],
  login: ["Welcome back", "The journey continues here.", "Sign in to save discoveries and plan what comes next."],
  register: ["Come explore with us", "Every great trip starts somewhere.", "Join TripNearby to build your own collection of journeys."],
  "business-register": ["Grow with TripNearby", "Be part of the journey.", "Create a free local business listing. Your details will be reviewed before they go live."],
  dealer: ["Your business hub", "Manage your local listing.", "Update real business information, add products and respond to traveller enquiries."],
  admin: ["TripNearby administration", "Keep the journey trustworthy.", "Review submissions, manage the destination catalog and monitor real platform activity."],
  about: ["About TripNearby", "A little detour can change everything.", "We believe the most memorable parts of a journey are often the places you didn't plan to see."],
  contact: ["Get in touch", "We'd love to hear from you.", "Questions, corrections and ideas are always welcome."],
  privacy: ["The important details", "Your privacy matters.", "A clear look at the information TripNearby uses and the choices you control."],
  terms: ["The important details", "Terms & conditions.", "Helpful ground rules for discovering, sharing and connecting on TripNearby."],
};

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { section: raw } = await params;
  const query = await searchParams;
  const section = aliases[raw] ?? raw;
  if (section !== raw) redirect(`/${section}`);
  const text = pageText[section] ?? (marketSlugs.includes(section) ? ["Nearby rentals & shops", section.replaceAll("-", " ") + " for the journey.", "Discover approved local businesses and live results where connected."] as [string, string, string] : null);
  if (!text) notFound();
  const q = (name: string) => typeof query[name] === "string" ? query[name] as string : "";
  const user = await getCurrentUser();
  const [places, categories, regions] = await Promise.all([getDestinations(), getCategories(), getRegions()]);
  const requiresAuth = ["trips", "saved", "profile", "dealer"].includes(section);
  if (requiresAuth && !user) return <main><PageIntro eyebrow={text[0]} title={text[1]} description={text[2]} /><div className="container-wide page-content"><EmptyState title="Your journey starts with an account" description="Log in or create a free account to access this page." href={`/auth?mode=login&next=${encodeURIComponent(`/${section}`)}`} action="Log in or register" /></div></main>;
  let content: React.ReactNode = null;
  if (section === "explore") content = <ExploreBrowser places={places} categories={categories} districts={regions.districts} initialSearch={q("search")} initialCategory={q("category")} initialDistrict={q("district")} />;
  else if (section === "states") content = <div className="region-cards">{regions.states.map((state) => <Link className="region-card" key={state.id} href={`/states/${state.slug}`}><MapPin size={23} className="region-icon" /><div><h3>{state.name}</h3><p>{state.countryCode === "IN" ? "India" : state.countryCode} · Browse districts →</p></div></Link>)}</div>;
  else if (section === "districts") content = <div className="region-cards">{regions.districts.map((district) => <Link className="region-card" key={district.id} href={`/states/karnataka/${district.slug}`}><MapPin size={22} className="region-icon" /><div><h3>{district.name}</h3><p>{district.placeCount} published {district.placeCount === 1 ? "destination" : "destinations"}</p></div></Link>)}</div>;
  else if (section === "hidden-places") {
    const [counts, districtCenters] = await Promise.all([getSourceCounts(), getDistrictCenters()]);
    content = <><HiddenDiscoveryPanel counts={counts} districts={districtCenters} /><HiddenBrowser places={places.filter((place) => place.isHidden)} loggedIn={!!user} /></>;
  }
  else if (section === "nearby") content = <NearbyExplorer places={places} initialSlug={places.some((p) => p.slug === q("place")) ? q("place") : "shanti-sagara"} loggedIn={!!user} />;
  else if (section === "map") content = <MapExplorer places={places} categories={categories} />;
  else if (section === "route-planner") content = <RoutePlanner places={places} initialSlugs={q("stops").split(",").filter((slug) => places.some((p) => p.slug === slug)).slice(0, 7)} loggedIn={!!user} />;
  else if (section === "services" || section === "hotels" || section === "restaurants" || marketSlugs.includes(section)) {
    const [listings, products] = await Promise.all([getBusinessListings(), db.select({ id: rentalProducts.id, listingId: rentalProducts.listingId,
      name: rentalProducts.name, description: rentalProducts.description, priceRupees: rentalProducts.priceRupees,
      priceUnit: rentalProducts.priceUnit, available: rentalProducts.available }).from(rentalProducts)]);
    content = <MarketplacePage initialCategory={section} listings={listings} products={products} loggedIn={!!user} places={places} />;
  }
  else if (section === "guides") content = <GuidesPage guides={await getApprovedGuides()} loggedIn={!!user} />;
  else if (section === "business-register") content = <BusinessRegistration loggedIn={!!user} />;
  else if (section === "planner") content = <TripPlannerPage places={places} loggedIn={!!user} />;
  else if (section === "community") content = <CommunityPage posts={await getCommunityPosts()} places={places} loggedIn={!!user} />;
  else if (section === "login" || section === "register") { const initialMode = q("mode") === "register" || (q("mode") !== "login" && section === "register") ? "register" : "login"; content = <AuthExperience initialMode={initialMode} nextPath={safeNext(q("next"))} initialUser={user ? responseUser(user) : null} />; }
  else if (section === "trips" && user) content = <TripsPage trips={await getMyTrips(user.id)} placeSlugs={Object.fromEntries(places.map((place) => [place.id, place.slug]))} />;
  else if (section === "saved" && user) { const saved = await db.select({ destinationId: savedPlaces.destinationId }).from(savedPlaces).where(eq(savedPlaces.userId, user.id)); content = <SavedPage places={places.filter((place) => saved.some((item) => item.destinationId === place.id))} />; }
  else if (section === "profile" && user) content = <ProfilePage user={user} />;
  else if (section === "dealer" && user) {
    const listings = await db.select().from(businessListings).where(eq(businessListings.ownerId, user.id));
    const ids = listings.map((item) => item.id);
    const products = ids.length ? await db.select({ id: rentalProducts.id, listingId: rentalProducts.listingId, name: rentalProducts.name,
      description: rentalProducts.description, priceRupees: rentalProducts.priceRupees, priceUnit: rentalProducts.priceUnit,
      available: rentalProducts.available }).from(rentalProducts).where(inArray(rentalProducts.listingId, ids)) : [];
    const enquiries = ids.length ? await db.select({ id: bookings.id, listingId: bookings.listingId, message: bookings.message,
      status: bookings.status, travelDate: bookings.travelDate, createdAt: bookings.createdAt,
      travellerName: users.name, travellerEmail: users.email }).from(bookings).innerJoin(users, eq(bookings.userId, users.id)).where(inArray(bookings.listingId, ids)) : [];
    content = <DealerDashboard listings={listings} products={products} enquiries={enquiries} />;
  }
  else if (section === "admin") content = user?.role === "admin" ? <AdminDashboard /> : <div className="empty-state"><ShieldCheck size={26} style={{ margin: "0 auto 15px" }} /><h3>Admin access only</h3><p>This page is restricted to authorised TripNearby administrators.</p><Link className="btn btn-outline" href="/">Back to home <ArrowRight size={15} /></Link></div>;
  else if (section === "about") content = <div className="container-narrow"><div className="white-card"><h3>Discover more. Travel nearby.</h3><p>TripNearby started with a simple idea: the journey to a destination is full of destinations of its own. A lake outside Davanagere, a heritage site along a quiet road, a local story around the next bend.</p><p>We&apos;re building a place to discover those stops thoughtfully. Our initial catalog focuses on Karnataka with source-backed locations. Nearby search brings them together; real navigation is available through Google Maps and, when configured, Google Routes.</p><p>Travellers can suggest places, share experiences and connect with local businesses. New places and profiles stay private until reviewed. We don&apos;t invent dealers, reviews or prices to make the map look busy.</p><p><strong>Every journey has more to discover.</strong></p><Link href="/explore" className="btn btn-primary">Start exploring <ArrowRight size={15} /></Link></div></div>;
  else if (section === "contact") content = <ContactPage />;
  else if (section === "privacy") content = <div className="container-narrow white-card"><h3>Privacy policy</h3><p><strong>Information you provide.</strong> We store the name, email and password hash you use to create an account. We also store trips, saved places, submissions, messages, photographs and enquiries that you choose to send. Passwords are hashed, not stored in plain text.</p><p><strong>Location.</strong> Browser GPS is requested only when you press a location button or enable the optional live companion. Nearby coordinates are used to answer your search. Live tracking runs in your browser while enabled; it stops when you disable it or leave the page. We do not store a GPS movement history.</p><p><strong>Photos and community content.</strong> Uploaded images are stored in the application database and can be viewed via unguessable URLs. Posts and reviews are moderated before public display. Published content and your display name may be visible to others.</p><p><strong>External providers.</strong> If configured, Google Maps, Places and Routes process location-related requests under their terms. Trip planning may send your stated preferences and published catalog candidates to OpenAI only when that integration is configured. Google Places results are not saved as TripNearby business listings.</p><p><strong>Cookies.</strong> A secure, HTTP-only session cookie keeps you signed in. We do not use advertising-tracking cookies in this MVP.</p><p><strong>Your choices.</strong> You can stop location tracking and notifications at any time. To request account or content removal, use the <Link className="text-link" href="/contact">contact form</Link>. We will review the request and applicable legal obligations.</p><p>Last updated: June 2026. This MVP policy should be reviewed before a public launch.</p></div>;
  else if (section === "terms") content = <div className="container-narrow white-card"><h3>Terms & conditions</h3><p><strong>Use the platform responsibly.</strong> Submit only accurate information and photos you have permission to share. Do not post spam, misleading reviews, impersonations or unsafe directions. Submissions may be rejected or removed after review.</p><p><strong>Travel information is not a guarantee.</strong> Coordinates may indicate a general site rather than an entrance. Opening hours, accessibility, weather, transport, road conditions and availability can change. Confirm with official sources and providers before travelling. Never rely solely on a suggested route in unsafe conditions.</p><p><strong>Businesses and enquiries.</strong> Public profiles are reviewed, but approval is not an endorsement. A verified badge requires a separate check. Listed charges, products and availability are provider-provided and must be confirmed directly. An enquiry is not a booking confirmation. No paid subscriptions or payment processing are currently active.</p><p><strong>Third-party services.</strong> Google Maps and other external services have their own terms. AI-generated suggestions, where configured, are advisory and grounded in published catalog candidates, not guaranteed travel plans.</p><p><strong>Reporting.</strong> Use the report control or <Link className="text-link" href="/contact">contact us</Link> if you find incorrect or unsafe information. We may moderate content to protect the community.</p><p>Last updated: June 2026. Review these terms with legal counsel before a public launch.</p></div>;
  return <main><PageIntro eyebrow={text[0]} title={text[1]} description={text[2]} /><div className="container-wide page-content">{content}</div></main>;
}
