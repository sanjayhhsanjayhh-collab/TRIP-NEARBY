import { and, asc, desc, eq, gte, ilike, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { destinationCategories, destinations, districts, hiddenPlaces, states, taluks as talukTable, districtBoundaries } from "@/db/schema";
import { distanceToBoundaryKm, haversineKm, type Point } from "@/lib/geo";
import { verificationLabels } from "@/lib/labels";
export { verificationLabels };

const fields = {
  id: destinations.id, slug: destinations.slug, name: destinations.name, description: destinations.description,
  latitude: destinations.latitude, longitude: destinations.longitude, imageUrl: destinations.imageUrl,
  imageCredit: destinations.imageCredit, imageSourceUrl: destinations.imageSourceUrl,
  sourceUrl: destinations.sourceUrl, sourceLabel: destinations.sourceLabel, sourceType: destinations.sourceType,
  bestTime: destinations.bestTime, visitorInfo: destinations.visitorInfo, safetyInfo: destinations.safetyInfo,
  accessibilityInfo: destinations.accessibilityInfo, openingHours: destinations.openingHours, entryFee: destinations.entryFee,
  taluk: destinations.taluk, town: destinations.town, subcategory: destinations.subcategory,
  verificationLevel: destinations.verificationLevel, coordinatePrecision: destinations.coordinatePrecision,
  coordinateSourceUrl: destinations.coordinateSourceUrl, districtNote: destinations.districtNote,
  isHidden: destinations.isHidden, featured: destinations.featured, createdAt: destinations.createdAt,
  district: districts.name, districtSlug: districts.slug, state: states.name, stateSlug: states.slug,
  category: destinationCategories.name, categorySlug: destinationCategories.slug,
};

function baseQuery() {
  return db.select(fields).from(destinations)
    .innerJoin(districts, eq(destinations.districtId, districts.id))
    .innerJoin(states, eq(destinations.stateId, states.id))
    .innerJoin(destinationCategories, eq(destinations.categoryId, destinationCategories.id));
}

export type DistrictFilters = {
  districtSlug: string; stateSlug?: string; search?: string; category?: string; taluk?: string;
  verification?: string; hidden?: boolean; sort?: string; page?: number; pageSize?: number;
  origin?: Point; radiusKm?: number;
};
export type DistrictPlace = Awaited<ReturnType<typeof getDistrictPage>>["results"][number];

function buildConditions(filters: DistrictFilters) {
  const conditions: SQL[] = [eq(destinations.status, "published"), eq(districts.slug, filters.districtSlug)];
  if (filters.stateSlug) conditions.push(eq(states.slug, filters.stateSlug));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim().slice(0, 100).replace(/[%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(destinations.name, q), ilike(destinations.description, q), ilike(destinations.town, q),
      ilike(destinations.taluk, q), ilike(destinations.subcategory, q))!);
  }
  if (filters.category) conditions.push(eq(destinationCategories.slug, filters.category));
  if (filters.taluk) conditions.push(eq(destinations.taluk, filters.taluk));
  if (filters.verification && verificationLabels[filters.verification]) conditions.push(eq(destinations.verificationLevel, filters.verification));
  if (filters.hidden !== undefined) conditions.push(eq(destinations.isHidden, filters.hidden));
  if (filters.origin && filters.radiusKm) {
    const { latitude, longitude } = filters.origin;
    const latSpan = filters.radiusKm / 110.574;
    const lngSpan = filters.radiusKm / (111.32 * Math.max(0.15, Math.cos(latitude * Math.PI / 180)));
    conditions.push(gte(destinations.latitude, latitude - latSpan), lte(destinations.latitude, latitude + latSpan),
      gte(destinations.longitude, longitude - lngSpan), lte(destinations.longitude, longitude + lngSpan));
  }
  return and(...conditions);
}

export async function getDistrictPage(filters: DistrictFilters) {
  const page = Math.max(1, Math.min(1000, Math.floor(filters.page ?? 1)));
  const pageSize = Math.max(1, Math.min(60, Math.floor(filters.pageSize ?? 12)));
  const where = buildConditions(filters);
  const [countRow] = await db.select({ value: sql<number>`cast(count(*) as integer)` }).from(destinations)
    .innerJoin(districts, eq(destinations.districtId, districts.id))
    .innerJoin(states, eq(destinations.stateId, states.id))
    .innerJoin(destinationCategories, eq(destinations.categoryId, destinationCategories.id)).where(where);
  const total = countRow?.value ?? 0;
  const order: SQL[] = [];
  if (filters.sort === "distance" && filters.origin) {
    order.push(sql`(power(${destinations.latitude} - ${filters.origin.latitude}, 2) + power(${destinations.longitude} - ${filters.origin.longitude}, 2)) asc`);
  } else if (filters.sort === "hidden") order.push(desc(destinations.isHidden), asc(destinations.name));
  else if (filters.sort === "verification") order.push(sql`case ${destinations.verificationLevel} when 'officially_verified' then 0 when 'location_verified' then 1 else 2 end asc`, asc(destinations.name));
  else order.push(desc(destinations.featured), asc(destinations.name));
  const rows = await baseQuery().where(where).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize);
  const results = rows.map((row) => ({ ...row,
    verificationLabel: verificationLabels[row.verificationLevel] ?? "Unverified",
    geographicDistanceKm: filters.origin ? haversineKm(filters.origin.latitude, filters.origin.longitude, row.latitude, row.longitude) : null,
  }));
  return { results, total, page, pageSize, hasMore: page * pageSize < total, pages: Math.ceil(total / pageSize) };
}

export async function getDistrictBoundary(districtSlug: string) {
  const [row] = await db.select({ id: districtBoundaries.id, districtId: districtBoundaries.districtId,
    minLatitude: districtBoundaries.minLatitude, maxLatitude: districtBoundaries.maxLatitude,
    minLongitude: districtBoundaries.minLongitude, maxLongitude: districtBoundaries.maxLongitude,
    polygon: districtBoundaries.polygon, sourceUrl: districtBoundaries.sourceUrl, sourceLabel: districtBoundaries.sourceLabel,
  }).from(districtBoundaries).innerJoin(districts, eq(districtBoundaries.districtId, districts.id))
    .where(eq(districts.slug, districtSlug)).limit(1);
  return row ?? null;
}

export async function getDistrictCenters() {
  const rows = await db.select({ slug: districts.slug, name: districts.name,
    minLatitude: districtBoundaries.minLatitude, maxLatitude: districtBoundaries.maxLatitude,
    minLongitude: districtBoundaries.minLongitude, maxLongitude: districtBoundaries.maxLongitude,
    sourceLabel: districtBoundaries.sourceLabel }).from(districtBoundaries)
    .innerJoin(districts, eq(districtBoundaries.districtId, districts.id)).orderBy(asc(districts.name));
  return rows.map((row) => ({ slug: row.slug, name: row.name,
    center: { latitude: (row.minLatitude + row.maxLatitude) / 2, longitude: (row.minLongitude + row.maxLongitude) / 2 },
    sourceLabel: row.sourceLabel }));
}

export async function getBoundaryNeighbors(districtSlug: string, limit = 12) {
  const boundary = await getDistrictBoundary(districtSlug);
  const [district] = await db.select({ id: districts.id }).from(districts).where(eq(districts.slug, districtSlug));
  if (!boundary || !district) return [];
  const rows = await baseQuery().where(and(eq(destinations.status, "published"), ne(destinations.districtId, district.id),
    gte(destinations.latitude, boundary.minLatitude - 0.1), lte(destinations.latitude, boundary.maxLatitude + 0.1),
    gte(destinations.longitude, boundary.minLongitude - 0.1), lte(destinations.longitude, boundary.maxLongitude + 0.1))).limit(200);
  return rows.map((row) => ({ ...row, verificationLabel: verificationLabels[row.verificationLevel] ?? "Unverified",
    boundaryDistanceKm: distanceToBoundaryKm(row, boundary.polygon), geographicDistanceKm: null as number | null }))
    .filter((row) => row.boundaryDistanceKm <= 15).sort((a, b) => a.boundaryDistanceKm - b.boundaryDistanceKm).slice(0, limit);
}

export async function getDistrictStats(districtSlug: string) {
  const [boundary, talukRows, categoryRows, placeRows, submissions] = await Promise.all([
    getDistrictBoundary(districtSlug),
    db.select({ id: talukTable.id, name: talukTable.name, slug: talukTable.slug, note: talukTable.note }).from(talukTable)
      .innerJoin(districts, eq(talukTable.districtId, districts.id)).where(eq(districts.slug, districtSlug)),
    db.select({ name: destinationCategories.name, slug: destinationCategories.slug }).from(destinationCategories),
    baseQuery().where(and(eq(destinations.status, "published"), eq(districts.slug, districtSlug))).limit(1000),
    db.select({ id: hiddenPlaces.id, district: hiddenPlaces.district, status: hiddenPlaces.status,
      submittedBy: hiddenPlaces.submittedBy, verificationLevel: hiddenPlaces.verificationLevel }).from(hiddenPlaces),
  ]);
  const districtName = placeRows[0]?.district ?? talukRows[0]?.name ?? districtSlug;
  const ownSubmissions = submissions.filter((row) => row.district?.toLowerCase() === districtName.toLowerCase());
  const talukCounts = talukRows.map((t) => ({ ...t, count: placeRows.filter((p) => p.taluk === t.name).length }));
  const categoryCounts = categoryRows.map((c) => ({ ...c, count: placeRows.filter((p) => p.categorySlug === c.slug).length }));
  return {
    total: placeRows.length, hidden: placeRows.filter((p) => p.isHidden).length,
    officiallyVerified: placeRows.filter((p) => p.verificationLevel === "officially_verified").length,
    locationVerified: placeRows.filter((p) => p.verificationLevel === "location_verified").length,
    communitySubmitted: placeRows.filter((p) => p.verificationLevel === "community_submitted").length,
    pendingVerification: ownSubmissions.filter((p) => p.status === "pending").length,
    communitySubmissions: ownSubmissions.filter((p) => p.submittedBy !== null).length,
    missingPhotos: placeRows.filter((p) => !p.imageUrl).length,
    localityPins: placeRows.filter((p) => p.coordinatePrecision === "locality").length,
    taluks: talukCounts, categories: categoryCounts,
    missingTaluks: talukCounts.filter((t) => t.count === 0).map((t) => t.name),
    missingCategories: categoryCounts.filter((c) => c.count === 0).map((c) => c.name),
    boundary: boundary ? { sourceUrl: boundary.sourceUrl, sourceLabel: boundary.sourceLabel,
      bbox: [boundary.minLatitude, boundary.minLongitude, boundary.maxLatitude, boundary.maxLongitude] } : null,
  };
}

export async function getSourceCounts() {
  const [destRows, submissions] = await Promise.all([
    db.select({ sourceType: destinations.sourceType, verificationLevel: destinations.verificationLevel,
      isHidden: destinations.isHidden }).from(destinations).where(eq(destinations.status, "published")),
    db.select({ status: hiddenPlaces.status, submittedBy: hiddenPlaces.submittedBy }).from(hiddenPlaces),
  ]);
  return {
    officialGovernment: destRows.filter((row) => row.sourceType === "official_government").length,
    officialTourism: destRows.filter((row) => row.sourceType === "official_tourism").length,
    openStreetMap: destRows.filter((row) => row.sourceType === "openstreetmap").length,
    officiallyVerified: destRows.filter((row) => row.verificationLevel === "officially_verified").length,
    locationVerified: destRows.filter((row) => row.verificationLevel === "location_verified").length,
    communitySubmitted: destRows.filter((row) => row.verificationLevel === "community_submitted").length + submissions.filter((row) => row.submittedBy !== null).length,
    pendingVerification: submissions.filter((row) => row.status === "pending").length,
    publishedHidden: destRows.filter((row) => row.isHidden).length,
  };
}

export async function getCoverageData() {
  const [districtRows, talukRows, categoryRows, placeRows, submissions] = await Promise.all([
    db.select({ id: districts.id, name: districts.name, slug: districts.slug, stateId: districts.stateId }).from(districts),
    db.select({ districtId: talukTable.districtId, name: talukTable.name, note: talukTable.note }).from(talukTable),
    db.select({ name: destinationCategories.name, slug: destinationCategories.slug }).from(destinationCategories),
    db.select({ districtId: destinations.districtId, taluk: destinations.taluk, categorySlug: destinationCategories.slug,
      verificationLevel: destinations.verificationLevel, isHidden: destinations.isHidden, imageUrl: destinations.imageUrl,
      coordinatePrecision: destinations.coordinatePrecision }).from(destinations)
      .innerJoin(destinationCategories, eq(destinations.categoryId, destinationCategories.id))
      .where(eq(destinations.status, "published")),
    db.select({ district: hiddenPlaces.district, status: hiddenPlaces.status, submittedBy: hiddenPlaces.submittedBy }).from(hiddenPlaces),
  ]);
  return districtRows.map((district) => {
    const places = placeRows.filter((p) => p.districtId === district.id);
    const taluks = talukRows.filter((t) => t.districtId === district.id);
    const ownSubmissions = submissions.filter((s) => s.district?.toLowerCase() === district.name.toLowerCase());
    const coveredTaluks = [...new Set(places.map((p) => p.taluk).filter(Boolean))];
    const coveredCategories = [...new Set(places.map((p) => p.categorySlug))];
    return {
      id: district.id, name: district.name, slug: district.slug,
      verified: places.filter((p) => p.verificationLevel !== "pending_verification").length,
      total: places.length, hidden: places.filter((p) => p.isHidden).length,
      communitySubmissions: ownSubmissions.filter((s) => s.submittedBy !== null).length,
      pendingVerification: ownSubmissions.filter((s) => s.status === "pending").length,
      missingPhotos: places.filter((p) => !p.imageUrl).length,
      localityPins: places.filter((p) => p.coordinatePrecision === "locality").length,
      taluksCovered: coveredTaluks, taluksMissing: taluks.map((t) => t.name).filter((name) => !coveredTaluks.includes(name)),
      categoriesCovered: coveredCategories, categoriesMissing: categoryRows.filter((c) => !coveredCategories.includes(c.slug)).map((c) => c.name),
      checklist: taluks.map((t) => ({ name: t.name, covered: coveredTaluks.includes(t.name), note: t.note })),
      completenessClaim: false,
    };
  }).sort((a, b) => b.total - a.total);
}

export async function getDuplicateCandidates() {
  const rows = await db.select({ id: destinations.id, slug: destinations.slug, name: destinations.name,
    district: districts.name }).from(destinations).innerJoin(districts, eq(destinations.districtId, districts.id))
    .where(eq(destinations.status, "published")).limit(1000);
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.district.toLowerCase()}:${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
