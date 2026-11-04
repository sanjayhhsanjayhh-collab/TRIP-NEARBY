import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, businessListings, communityPosts, contactMessages, destinationCategories, destinationImages, destinations, districts,
  hiddenPlaces, localGuides, nearbyPlaces, postComments, reports, reviews, routes, savedPlaces, states, taluks as talukTable,
  tripStops, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getCoverageData, getDuplicateCandidates } from "@/lib/districts";
import { guardMutation, isMediaPath, parseJson } from "@/lib/security";

async function authorized() { const user = await getCurrentUser(); return user?.role === "admin"; }
const uuid = z.uuid();

export async function GET() {
  if (!(await authorized())) return Response.json({ error: "Admin access only." }, { status: 403 });
  const [pendingPlaces, pendingBusinesses, pendingGuides, pendingReviews, pendingPosts, pendingComments, openReports, allDestinations,
    allUsers, allBookings, allMessages, allStates, allDistricts, allCategories, coverage, duplicateCandidates, allTaluks] = await Promise.all([
    db.select().from(hiddenPlaces).where(eq(hiddenPlaces.status, "pending")).orderBy(desc(hiddenPlaces.createdAt)).limit(100),
    db.select().from(businessListings).where(eq(businessListings.status, "pending")).orderBy(desc(businessListings.createdAt)).limit(100),
    db.select().from(localGuides).where(eq(localGuides.status, "pending")).orderBy(desc(localGuides.createdAt)).limit(100),
    db.select().from(reviews).where(eq(reviews.status, "pending")).orderBy(desc(reviews.createdAt)).limit(100),
    db.select().from(communityPosts).where(eq(communityPosts.status, "pending")).orderBy(desc(communityPosts.createdAt)).limit(100),
    db.select().from(postComments).where(eq(postComments.status, "pending")).orderBy(desc(postComments.createdAt)).limit(100),
    db.select().from(reports).where(eq(reports.status, "open")).orderBy(desc(reports.createdAt)).limit(100),
    db.select({ id: destinations.id, name: destinations.name, slug: destinations.slug, featured: destinations.featured,
      status: destinations.status, districtId: destinations.districtId, categoryId: destinations.categoryId, sourceUrl: destinations.sourceUrl,
      description: destinations.description, latitude: destinations.latitude, longitude: destinations.longitude, imageUrl: destinations.imageUrl,
      isHidden: destinations.isHidden }).from(destinations).orderBy(desc(destinations.createdAt)).limit(300),
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(100),
    db.select({ id: bookings.id, userId: bookings.userId, listingId: bookings.listingId, guideId: bookings.guideId,
      status: bookings.status, createdAt: bookings.createdAt }).from(bookings).orderBy(desc(bookings.createdAt)).limit(100),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(100),
    db.select().from(states), db.select().from(districts), db.select().from(destinationCategories),
    getCoverageData(), getDuplicateCandidates(), db.select().from(talukTable),
  ]);
  return Response.json({ pendingPlaces, pendingBusinesses, pendingGuides, pendingReviews, pendingPosts, pendingComments,
    openReports, destinations: allDestinations, users: allUsers, bookings: allBookings, messages: allMessages,
    states: allStates, districts: allDistricts, categories: allCategories, coverage, duplicateCandidates, taluks: allTaluks });
}

const moderation = z.object({ action: z.literal("moderate"), type: z.enum(["business", "guide", "review", "post", "comment", "report", "destination", "hidden"]),
  id: uuid, decision: z.enum(["approve", "reject", "close"]), verified: z.boolean().optional(),
  sourceUrl: z.url().max(500).optional(), districtId: uuid.optional(), categoryId: uuid.optional(), note: z.string().max(500).optional() });
const region = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), action: z.literal("region"), name: z.string().trim().min(2).max(100), countryCode: z.string().length(2).default("IN") }),
  z.object({ type: z.literal("district"), action: z.literal("region"), name: z.string().trim().min(2).max(100), stateId: uuid }),
]);
const destinationInput = z.object({ action: z.literal("destination"), id: uuid.optional(), name: z.string().trim().min(3).max(180),
  description: z.string().trim().min(30).max(3000), districtId: uuid, categoryId: uuid,
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), sourceUrl: z.url().max(500),
  imageUrl: z.string().max(150).optional().nullable().refine(isMediaPath), isHidden: z.boolean().default(false), featured: z.boolean().default(false),
  status: z.enum(["published", "pending", "rejected"]).default("published"),
  taluk: z.string().trim().max(120).optional(), town: z.string().trim().max(160).optional(),
  subcategory: z.string().trim().max(120).optional(),
  verificationLevel: z.enum(["officially_verified", "location_verified", "community_submitted", "pending_verification"]).default("location_verified"),
  coordinatePrecision: z.enum(["site", "locality"]).default("site"),
  coordinateSourceUrl: z.url().max(500).optional().or(z.literal("")), accessibilityInfo: z.string().trim().max(1000).optional(),
});

const verifyInput = z.object({ action: z.literal("verify"), id: uuid,
  verificationLevel: z.enum(["officially_verified", "location_verified", "community_submitted", "pending_verification"]),
  coordinatePrecision: z.enum(["site", "locality"]).optional(), sourceUrl: z.url().max(500).optional(), note: z.string().trim().max(500).optional() });
const mergeInput = z.object({ action: z.literal("merge"), primaryId: uuid, duplicateId: uuid }).refine((d) => d.primaryId !== d.duplicateId);
const talukInput = z.object({ action: z.literal("region"), type: z.literal("taluk"), districtId: uuid,
  name: z.string().trim().min(2).max(120), note: z.string().trim().max(500).optional() });

const slugify = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

export async function POST(request: Request) {
  const blocked = guardMutation(request, "admin-write", 60);
  if (blocked) return blocked;
  if (!(await authorized())) return Response.json({ error: "Admin access only." }, { status: 403 });
  const input = await parseJson(request);
  if (!input || typeof input !== "object" || !("action" in input)) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    if (input.action === "verify") {
      const parsed = verifyInput.safeParse(input);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
      const d = parsed.data;
      await db.update(destinations).set({ verificationLevel: d.verificationLevel,
        ...(d.coordinatePrecision ? { coordinatePrecision: d.coordinatePrecision } : {}),
        ...(d.sourceUrl ? { sourceUrl: d.sourceUrl, sourceLabel: "Admin-reviewed source" } : {}),
        ...(d.note ? { districtNote: d.note } : {}) }).where(eq(destinations.id, d.id));
      return Response.json({ ok: true, message: "Verification label updated." });
    }
    if (input.action === "merge") {
      const parsed = mergeInput.safeParse(input);
      if (!parsed.success) return Response.json({ error: "Choose two different destination records." }, { status: 400 });
      const { primaryId, duplicateId } = parsed.data;
      const primary = await db.select({ id: destinations.id }).from(destinations).where(eq(destinations.id, primaryId));
      const duplicate = await db.select({ id: destinations.id }).from(destinations).where(eq(destinations.id, duplicateId));
      if (!primary.length || !duplicate.length) return Response.json({ error: "One of the destination records no longer exists." }, { status: 404 });
      await db.transaction(async (tx) => {
        // Remove duplicates before reassignment where a unique relationship exists.
        await tx.execute(sql`delete from saved_places where destination_id = ${duplicateId}::uuid and user_id in (select user_id from saved_places where destination_id = ${primaryId}::uuid)`);
        await tx.delete(nearbyPlaces).where(eq(nearbyPlaces.destinationId, duplicateId));
        await tx.delete(nearbyPlaces).where(eq(nearbyPlaces.nearbyDestinationId, duplicateId));
        await tx.update(savedPlaces).set({ destinationId: primaryId }).where(eq(savedPlaces.destinationId, duplicateId));
        await tx.update(destinationImages).set({ destinationId: primaryId }).where(eq(destinationImages.destinationId, duplicateId));
        await tx.update(reviews).set({ destinationId: primaryId }).where(eq(reviews.destinationId, duplicateId));
        await tx.update(tripStops).set({ destinationId: primaryId }).where(eq(tripStops.destinationId, duplicateId));
        await tx.update(communityPosts).set({ destinationId: primaryId }).where(eq(communityPosts.destinationId, duplicateId));
        await tx.update(reports).set({ destinationId: primaryId }).where(eq(reports.destinationId, duplicateId));
        await tx.update(hiddenPlaces).set({ destinationId: primaryId }).where(eq(hiddenPlaces.destinationId, duplicateId));
        await tx.update(routes).set({ destinationId: primaryId }).where(eq(routes.destinationId, duplicateId));
        await tx.delete(destinations).where(eq(destinations.id, duplicateId));
      });
      return Response.json({ ok: true, message: "Duplicate record merged into the primary destination." });
    }
    if (input.action === "moderate") {
      const parsed = moderation.safeParse(input);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
      const { type, id, decision } = parsed.data;
      if (type === "hidden" && decision === "approve") {
        if (!parsed.data.sourceUrl || !parsed.data.districtId || !parsed.data.categoryId) return Response.json({ error: "Verify the source and select a district and category before publishing." }, { status: 400 });
        const [place] = await db.select().from(hiddenPlaces).where(and(eq(hiddenPlaces.id, id), eq(hiddenPlaces.status, "pending")));
        const [district] = await db.select().from(districts).where(eq(districts.id, parsed.data.districtId));
        const [category] = await db.select().from(destinationCategories).where(eq(destinationCategories.id, parsed.data.categoryId));
        if (!place || !district || !category) return Response.json({ error: "Submission or region not found." }, { status: 404 });
        await db.transaction(async (tx) => {
          const [newPlace] = await tx.insert(destinations).values({ name: place.name,
            slug: `${slugify(place.name) || "place"}-${place.id.slice(0, 6)}`, description: place.description,
            stateId: district.stateId, districtId: district.id, categoryId: category.id, latitude: place.latitude, longitude: place.longitude,
            imageUrl: place.imageUrl, sourceUrl: parsed.data.sourceUrl, sourceLabel: "Community submission / admin-reviewed source",
            taluk: place.taluk, town: place.town, subcategory: place.category,
            verificationLevel: "community_submitted", coordinatePrecision: place.coordinatePrecision === "site" ? "site" : "locality",
            sourceType: "community", isHidden: true, status: "published", createdBy: place.submittedBy }).returning({ id: destinations.id });
          await tx.update(hiddenPlaces).set({ status: "approved", destinationId: newPlace.id,
            sourceUrl: parsed.data.sourceUrl, adminNote: parsed.data.note,
            verificationLevel: "community_submitted" }).where(eq(hiddenPlaces.id, id));
        });
      } else if (type === "hidden") await db.update(hiddenPlaces).set({ status: "rejected", adminNote: parsed.data.note }).where(eq(hiddenPlaces.id, id));
      else if (type === "business") await db.update(businessListings).set({ status: decision === "approve" ? "approved" : "rejected",
        verified: decision === "approve" && parsed.data.verified === true }).where(eq(businessListings.id, id));
      else if (type === "guide") await db.update(localGuides).set({ status: decision === "approve" ? "approved" : "rejected",
        verified: decision === "approve" && parsed.data.verified === true }).where(eq(localGuides.id, id));
      else if (type === "review") await db.update(reviews).set({ status: decision === "approve" ? "approved" : "rejected" }).where(eq(reviews.id, id));
      else if (type === "post") await db.update(communityPosts).set({ status: decision === "approve" ? "approved" : "rejected" }).where(eq(communityPosts.id, id));
      else if (type === "comment") await db.update(postComments).set({ status: decision === "approve" ? "approved" : "rejected" }).where(eq(postComments.id, id));
      else if (type === "report") await db.update(reports).set({ status: "closed" }).where(eq(reports.id, id));
      else if (type === "destination") await db.update(destinations).set({ status: decision === "approve" ? "published" : "rejected" }).where(eq(destinations.id, id));
      return Response.json({ ok: true });
    }
    if (input.action === "region" && (input as { type?: string }).type === "taluk") {
      const parsed = talukInput.safeParse(input);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
      await db.insert(talukTable).values({ districtId: parsed.data.districtId, name: parsed.data.name,
        slug: slugify(parsed.data.name), note: parsed.data.note }).onConflictDoNothing();
      return Response.json({ ok: true }, { status: 201 });
    }
    if (input.action === "region") {
      const parsed = region.safeParse(input);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
      const d = parsed.data;
      if (d.type === "state") await db.insert(states).values({ name: d.name, countryCode: d.countryCode.toUpperCase(), slug: slugify(d.name) });
      else await db.insert(districts).values({ name: d.name, stateId: d.stateId, slug: slugify(d.name) });
      return Response.json({ ok: true }, { status: 201 });
    }
    if (input.action === "destination") {
      const parsed = destinationInput.safeParse(input);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
      const d = parsed.data;
      const [district] = await db.select().from(districts).where(eq(districts.id, d.districtId));
      if (!district) return Response.json({ error: "District not found." }, { status: 404 });
      const values = { name: d.name, description: d.description, stateId: district.stateId,
        districtId: d.districtId, categoryId: d.categoryId, latitude: d.latitude, longitude: d.longitude,
        sourceUrl: d.sourceUrl, sourceLabel: "Admin-reviewed source", imageUrl: d.imageUrl,
        taluk: d.taluk, town: d.town, subcategory: d.subcategory,
        verificationLevel: d.verificationLevel, coordinatePrecision: d.coordinatePrecision,
        coordinateSourceUrl: d.coordinateSourceUrl || null, accessibilityInfo: d.accessibilityInfo,
        isHidden: d.isHidden, featured: d.featured, status: d.status };
      if (d.id) await db.update(destinations).set(values).where(eq(destinations.id, d.id));
      else await db.insert(destinations).values({ ...values, slug: `${slugify(d.name) || "destination"}-${crypto.randomUUID().slice(0, 6)}` });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown admin action." }, { status: 400 });
  } catch (error) {
    console.error("Admin action failed", error);
    return Response.json({ error: "Could not save. Check for duplicates and try again." }, { status: 500 });
  }
}
