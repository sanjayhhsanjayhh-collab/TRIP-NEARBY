import { and, asc, desc, eq, gte, ilike, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { businessListings, communityPosts, destinationCategories, destinationImages, destinations, districts, localGuides, postLikes, reviews, states, tripStops, trips, users } from "@/db/schema";
import { haversineKm } from "@/lib/geo";

const placeFields = {
  id: destinations.id, slug: destinations.slug, name: destinations.name, description: destinations.description,
  latitude: destinations.latitude, longitude: destinations.longitude, imageUrl: destinations.imageUrl,
  imageCredit: destinations.imageCredit, imageSourceUrl: destinations.imageSourceUrl,
  sourceUrl: destinations.sourceUrl, sourceLabel: destinations.sourceLabel, bestTime: destinations.bestTime,
  visitorInfo: destinations.visitorInfo, safetyInfo: destinations.safetyInfo,
  openingHours: destinations.openingHours, entryFee: destinations.entryFee,
  isHidden: destinations.isHidden, featured: destinations.featured, createdAt: destinations.createdAt,
  taluk: destinations.taluk, town: destinations.town, subcategory: destinations.subcategory,
  verificationLevel: destinations.verificationLevel, coordinatePrecision: destinations.coordinatePrecision,
  accessibilityInfo: destinations.accessibilityInfo, coordinateSourceUrl: destinations.coordinateSourceUrl,
  sourceType: destinations.sourceType, districtNote: destinations.districtNote,
  district: districts.name, districtSlug: districts.slug, state: states.name, stateSlug: states.slug,
  category: destinationCategories.name, categorySlug: destinationCategories.slug,
};

const placeQuery = () => db.select(placeFields).from(destinations)
  .innerJoin(districts, eq(destinations.districtId, districts.id))
  .innerJoin(states, eq(destinations.stateId, states.id))
  .innerJoin(destinationCategories, eq(destinations.categoryId, destinationCategories.id));

export async function getDestinations(filters: { search?: string; category?: string; district?: string; state?: string; hidden?: boolean; featured?: boolean; limit?: number } = {}) {
  const conditions = [eq(destinations.status, "published")];
  if (filters.search?.trim()) {
    const query = `%${filters.search.trim().slice(0, 100).replace(/[%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(destinations.name, query), ilike(districts.name, query), ilike(destinations.description, query))!);
  }
  if (filters.category) conditions.push(eq(destinationCategories.slug, filters.category));
  if (filters.district) conditions.push(eq(districts.slug, filters.district));
  if (filters.state) conditions.push(eq(states.slug, filters.state));
  if (filters.hidden !== undefined) conditions.push(eq(destinations.isHidden, filters.hidden));
  if (filters.featured) conditions.push(eq(destinations.featured, true));
  return placeQuery().where(and(...conditions)).orderBy(desc(destinations.featured), asc(destinations.name)).limit(filters.limit ?? 200);
}

export type CatalogPlace = Awaited<ReturnType<typeof getDestinations>>[number];

export async function getDestination(slug: string) {
  const [place] = await placeQuery().where(and(eq(destinations.status, "published"), eq(destinations.slug, slug))).limit(1);
  return place ?? null;
}

export async function getNearbyDestinations(latitude: number, longitude: number, radiusKm: number, excludeId?: string) {
  const latitudeSpan = radiusKm / 110.574;
  const longitudeSpan = radiusKm / (111.32 * Math.max(0.15, Math.cos(latitude * Math.PI / 180)));
  const conditions = [
    eq(destinations.status, "published"), gte(destinations.latitude, latitude - latitudeSpan),
    lte(destinations.latitude, latitude + latitudeSpan), gte(destinations.longitude, longitude - longitudeSpan),
    lte(destinations.longitude, longitude + longitudeSpan),
  ];
  if (excludeId) conditions.push(ne(destinations.id, excludeId));
  const candidates = await placeQuery().where(and(...conditions)).limit(250);
  return candidates.map((place) => ({ ...place, proximityKm: haversineKm(latitude, longitude, place.latitude, place.longitude) }))
    .filter((place) => place.proximityKm <= radiusKm && place.proximityKm > 0.05)
    .sort((a, b) => a.proximityKm - b.proximityKm);
}

export async function getRegions() {
  const stateRows = await db.select().from(states).orderBy(asc(states.name));
  const districtRows = await db.select({ id: districts.id, name: districts.name, slug: districts.slug, stateId: districts.stateId,
    placeCount: sql<number>`cast(count(${destinations.id}) filter (where ${destinations.status} = 'published') as integer)`,
  }).from(districts).leftJoin(destinations, eq(destinations.districtId, districts.id)).groupBy(districts.id).orderBy(asc(districts.name));
  return { states: stateRows, districts: districtRows };
}

export async function getCategories() {
  return db.select().from(destinationCategories).orderBy(asc(destinationCategories.name));
}

export async function getDestinationGallery(destinationId: string) {
  return db.select().from(destinationImages).where(eq(destinationImages.destinationId, destinationId));
}

export async function getDestinationReviews(destinationId: string) {
  return db.select({ id: reviews.id, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt, author: users.name })
    .from(reviews).innerJoin(users, eq(reviews.userId, users.id))
    .where(and(eq(reviews.destinationId, destinationId), eq(reviews.status, "approved"))).orderBy(desc(reviews.createdAt)).limit(30);
}

export async function getBusinessListings(category?: string) {
  return db.select({ id: businessListings.id, name: businessListings.name, category: businessListings.category,
    description: businessListings.description, address: businessListings.address, latitude: businessListings.latitude,
    longitude: businessListings.longitude, phone: businessListings.phone, whatsapp: businessListings.whatsapp,
    website: businessListings.website, hours: businessListings.hours, imageUrl: businessListings.imageUrl,
    verified: businessListings.verified, featured: businessListings.featured,
  }).from(businessListings).where(and(eq(businessListings.status, "approved"), category ? eq(businessListings.category, category) : undefined))
    .orderBy(desc(businessListings.featured), asc(businessListings.name)).limit(200);
}

export type PublicBusiness = Awaited<ReturnType<typeof getBusinessListings>>[number];

export async function getApprovedGuides() {
  return db.select({ id: localGuides.id, name: localGuides.name, location: localGuides.location,
    languages: localGuides.languages, experience: localGuides.experience, specialisation: localGuides.specialisation,
    serviceChargeRupees: localGuides.serviceChargeRupees, availability: localGuides.availability,
    photoUrl: localGuides.photoUrl, verified: localGuides.verified,
  }).from(localGuides).where(eq(localGuides.status, "approved")).orderBy(asc(localGuides.name)).limit(100);
}

export async function getCommunityPosts() {
  return db.select({ id: communityPosts.id, body: communityPosts.body, imageUrl: communityPosts.imageUrl,
    createdAt: communityPosts.createdAt, author: users.name, destination: destinations.name, destinationSlug: destinations.slug,
    likes: sql<number>`cast((select count(*) from ${postLikes} where ${postLikes.postId} = ${communityPosts.id}) as integer)`,
  }).from(communityPosts).innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(destinations, eq(communityPosts.destinationId, destinations.id))
    .where(eq(communityPosts.status, "approved")).orderBy(desc(communityPosts.createdAt)).limit(50);
}

export async function getMyTrips(userId: string) {
  const myTrips = await db.select().from(trips).where(eq(trips.userId, userId)).orderBy(desc(trips.createdAt));
  return Promise.all(myTrips.map(async (trip) => ({ ...trip, stops: await db.select().from(tripStops).where(eq(tripStops.tripId, trip.id)).orderBy(asc(tripStops.day), asc(tripStops.sortOrder)) })));
}
