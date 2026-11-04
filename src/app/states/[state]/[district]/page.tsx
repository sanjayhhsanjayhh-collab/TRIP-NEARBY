import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { DistrictDiscovery } from "@/components/district-discovery";
import { PageIntro } from "@/components/ui";
import { getCategories, getRegions } from "@/lib/catalog";
import { getBoundaryNeighbors, getDistrictCenters, getDistrictPage, getDistrictStats } from "@/lib/districts";

export const dynamic = "force-dynamic";
export default async function DistrictPage({ params }: { params: Promise<{ state: string; district: string }> }) {
  const { state: stateSlug, district: districtSlug } = await params;
  const [regions, categories, centers] = await Promise.all([getRegions(), getCategories(), getDistrictCenters()]);
  const state = regions.states.find((s) => s.slug === stateSlug);
  const district = regions.districts.find((d) => d.slug === districtSlug && d.stateId === state?.id);
  if (!state || !district) notFound();
  const [initial, stats, boundaryNeighbors, routePage] = await Promise.all([
    getDistrictPage({ districtSlug, stateSlug, page: 1, pageSize: 12 }),
    getDistrictStats(districtSlug),
    getBoundaryNeighbors(districtSlug, 9),
    getDistrictPage({ districtSlug, stateSlug, page: 1, pageSize: 60, sort: "name" }),
  ]);
  const center = centers.find((c) => c.slug === districtSlug)?.center ?? { latitude: 14.2, longitude: 75.8 };
  const routeOptions = routePage.results.map((place) => ({ slug: place.slug, name: place.name,
    latitude: place.latitude, longitude: place.longitude, taluk: place.taluk }));
  return <main>
    <PageIntro eyebrow={`${state.name} → ${district.name}`} title={`The many sides of ${district.name}.`} description={`Explore ${stats.total} published, source-backed destinations across ${district.name}'s taluks, villages and rural areas. Famous sites, offbeat finds and historic places are shown together with their verification status.`} />
    <div className="container-wide page-content">
      <div className="breadcrumb"><Link href="/states">States</Link><ChevronRight /><Link href={`/states/${stateSlug}`}>{state.name}</Link><ChevronRight /><span>{district.name}</span></div>
      <DistrictDiscovery districtSlug={districtSlug} stateSlug={stateSlug} districtName={district.name}
        googleConfigured={!!process.env.GOOGLE_MAPS_SERVER_API_KEY} initial={initial} stats={stats}
        boundaryNeighbors={boundaryNeighbors} categories={categories}
        taluks={stats.taluks.map((t) => t.name)} center={center} routeOptions={routeOptions} />
    </div>
  </main>;
}
