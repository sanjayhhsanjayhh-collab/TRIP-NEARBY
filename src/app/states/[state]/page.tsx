import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import { getDestinations, getRegions } from "@/lib/catalog";
import { PageIntro, PlaceCard, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const slug = (await params).state;
  const [regions, places] = await Promise.all([getRegions(), getDestinations({ state: slug })]);
  const state = regions.states.find((s) => s.slug === slug);
  if (!state) notFound();
  const districts = regions.districts.filter((d) => d.stateId === state.id);
  return <main><PageIntro eyebrow={`${state.countryCode === "IN" ? "India" : state.countryCode} → ${state.name}`} title={`Discover ${state.name}.`} description="Choose a district and see the source-backed places waiting there." /><div className="container-wide page-content"><div className="breadcrumb"><Link href="/states">States</Link><ChevronRight /><span>{state.name}</span></div><SectionHeading kicker="Find your way" title="Explore by district." description={`${districts.length} districts available in this state. Each destination has a traceable source.`} /><div className="region-cards">{districts.map((district) => <Link href={`/states/${state.slug}/${district.slug}`} key={district.id} className="region-card"><MapPin size={23} className="region-icon" /><div><h3>{district.name}</h3><p>{district.placeCount} published {district.placeCount === 1 ? "place" : "places"} →</p></div></Link>)}</div>{places.length > 0 && <section style={{ marginTop: 65 }}><SectionHeading kicker="A place to begin" title="Popular starting points." href={`/explore?state=${state.slug}`} linkText="Explore all" /><div className="places-grid">{places.filter((p) => p.featured).slice(0, 3).map((p) => <PlaceCard key={p.id} place={p} />)}</div></section>}</div></main>;
}
