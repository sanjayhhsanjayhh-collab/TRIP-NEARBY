import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, businessListings, communityPosts, contactMessages, destinations, hiddenPlaces, hotels, homestays, localGuides,
  postComments, postLikes, rentalDealers, rentalProducts, reports, restaurants, reviews, savedPlaces, subscriptions,
  tripStops, trips, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { guardMutation, isMediaPath, parseJson } from "@/lib/security";

const uuid = z.uuid();
const safeText = z.string().trim();
const image = z.string().max(150).optional().nullable().refine(isMediaPath, "Use an uploaded image.");
const coordinates = { latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) };
const itinerary = z.array(z.object({ day: z.number().int().min(1).max(10), title: safeText.min(1).max(120), activities: z.array(safeText.max(250)).max(12) })).max(10);
const businessCategories = ["bike-rentals", "camera-rentals", "car-rentals", "camping-equipment", "travel-shops", "trekking-shops", "vehicle-services", "essential-services", "hotels", "homestays", "resorts", "guest-houses", "campsites", "restaurants"] as const;

const schemas = {
  "save-place": z.object({ destinationId: uuid }),
  "create-trip": z.object({ title: safeText.min(2).max(180), startLocation: safeText.max(180).optional(), travelDate: z.iso.date().optional(),
    days: z.number().int().min(1).max(10).default(1), travellers: z.number().int().min(1).max(20).default(1),
    budget: z.number().int().min(0).max(10_000_000).optional(), transport: safeText.max(40).optional(), interests: safeText.max(500).optional(),
    itinerary: itinerary.optional(), stops: z.array(z.object({ destinationId: uuid, day: z.number().int().min(1).max(10) })).max(30).optional() }),
  "update-trip": z.object({ tripId: uuid, title: safeText.min(2).max(180), itinerary }),
  "delete-trip": z.object({ tripId: uuid }),
  "add-stop": z.object({ tripId: uuid, destinationId: uuid }),
  "remove-stop": z.object({ tripId: uuid, stopId: uuid }),
  "submit-hidden": z.object({ name: safeText.min(3).max(180), description: safeText.min(30).max(2500), category: safeText.min(2).max(100),
    district: safeText.max(120).optional(), taluk: safeText.max(120).optional(), town: safeText.max(160).optional(),
    coordinatePrecision: z.enum(["site", "locality"]).default("locality"),
    ...coordinates, imageUrl: image, directions: safeText.max(1000).optional(), sourceUrl: z.url().max(500).optional().or(z.literal("")) }),
  "create-business": z.object({ name: safeText.min(3).max(180), category: z.enum(businessCategories), description: safeText.min(20).max(2000),
    address: safeText.min(8).max(500), ...coordinates, phone: safeText.regex(/^\+?[0-9\s-]{10,20}$/), whatsapp: safeText.regex(/^\+?[0-9\s-]{10,20}$/).optional().or(z.literal("")),
    hours: safeText.max(160).optional(), imageUrl: image }),
  "update-business": z.object({ listingId: uuid, description: safeText.min(20).max(2000), address: safeText.min(8).max(500),
    ...coordinates, phone: safeText.regex(/^\+?[0-9\s-]{10,20}$/), hours: safeText.max(160).optional(), imageUrl: image }),
  "add-product": z.object({ listingId: uuid, name: safeText.min(2).max(140), description: safeText.max(500).optional(),
    priceRupees: z.number().int().min(0).max(1_000_000).optional(), priceUnit: safeText.max(30).optional(), available: z.boolean() }),
  "delete-product": z.object({ productId: uuid }),
  "register-guide": z.object({ name: safeText.min(2).max(120), location: safeText.min(2).max(160), languages: safeText.min(2).max(180),
    experience: safeText.min(20).max(1200), specialisation: safeText.max(500).optional(),
    serviceChargeRupees: z.number().int().min(0).max(1_000_000).optional(), availability: safeText.max(160).optional(), photoUrl: image }),
  enquiry: z.object({ listingId: uuid.optional(), guideId: uuid.optional(), message: safeText.min(10).max(1000), travelDate: z.iso.date().optional() }),
  review: z.object({ destinationId: uuid.optional(), listingId: uuid.optional(), guideId: uuid.optional(), rating: z.number().int().min(1).max(5), body: safeText.min(20).max(1500) }),
  "community-post": z.object({ body: safeText.min(20).max(2000), destinationId: uuid.optional(), imageUrl: image }),
  "like-post": z.object({ postId: uuid }),
  "comment-post": z.object({ postId: uuid, body: safeText.min(2).max(500) }),
  report: z.object({ destinationId: uuid.optional(), postId: uuid.optional(), reason: safeText.min(10).max(1000) }),
  profile: z.object({ name: safeText.min(2).max(120), location: safeText.max(160).optional() }),
  contact: z.object({ name: safeText.min(2).max(120), email: z.email().max(255), message: safeText.min(10).max(2000) }),
};

type Action = keyof typeof schemas;
const errorResponse = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const blocked = guardMutation(request, "actions", 35);
  if (blocked) return blocked;
  const body = await parseJson(request);
  if (!body || typeof body !== "object" || !("action" in body) || typeof body.action !== "string" || !(body.action in schemas)) return errorResponse("Unknown action.");
  const action = body.action as Action;
  const parsed = schemas[action].safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Please check the form fields.");
  const data = parsed.data;
  if (action === "contact") {
    const d = data as z.infer<typeof schemas.contact>;
    await db.insert(contactMessages).values({ name: d.name, email: d.email, message: d.message });
    return Response.json({ ok: true, message: "Thanks for getting in touch. Your message has been received." });
  }
  const user = await getCurrentUser();
  if (!user) return errorResponse("Please log in to continue.", 401);
  try {
    if (action === "save-place") {
      const d = data as z.infer<typeof schemas["save-place"]>;
      const [place] = await db.select({ id: destinations.id }).from(destinations).where(and(eq(destinations.id, d.destinationId), eq(destinations.status, "published")));
      if (!place) return errorResponse("Destination not found.", 404);
      const [saved] = await db.select().from(savedPlaces).where(and(eq(savedPlaces.userId, user.id), eq(savedPlaces.destinationId, d.destinationId)));
      if (saved) { await db.delete(savedPlaces).where(eq(savedPlaces.id, saved.id)); return Response.json({ saved: false }); }
      await db.insert(savedPlaces).values({ userId: user.id, destinationId: d.destinationId }).onConflictDoNothing();
      return Response.json({ saved: true });
    }
    if (action === "create-trip") {
      const d = data as z.infer<typeof schemas["create-trip"]>;
      const [trip] = await db.insert(trips).values({ userId: user.id, title: d.title, startLocation: d.startLocation,
        travelDate: d.travelDate, days: d.days, travellers: d.travellers, budget: d.budget, transport: d.transport,
        interests: d.interests, itinerary: d.itinerary }).returning();
      if (d.stops?.length) {
        const ids = [...new Set(d.stops.map((stop) => stop.destinationId))];
        const valid = await db.select({ id: destinations.id, name: destinations.name, latitude: destinations.latitude, longitude: destinations.longitude })
          .from(destinations).where(and(inArray(destinations.id, ids), eq(destinations.status, "published")));
        const allowed = new Map(valid.map((place) => [place.id, place]));
        const stopValues = d.stops.flatMap((stop, index) => {
          const place = allowed.get(stop.destinationId);
          return place ? [{ tripId: trip.id, destinationId: place.id, name: place.name, latitude: place.latitude,
            longitude: place.longitude, day: stop.day, sortOrder: index }] : [];
        });
        if (stopValues.length) await db.insert(tripStops).values(stopValues);
      }
      return Response.json({ ok: true, tripId: trip.id, shareId: trip.shareId }, { status: 201 });
    }
    if (["update-trip", "delete-trip", "add-stop", "remove-stop"].includes(action)) {
      const tripId = (data as { tripId: string }).tripId;
      const [trip] = await db.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.userId, user.id)));
      if (!trip) return errorResponse("Trip not found.", 404);
      if (action === "delete-trip") { await db.delete(trips).where(eq(trips.id, tripId)); return Response.json({ ok: true }); }
      if (action === "update-trip") {
        const d = data as z.infer<typeof schemas["update-trip"]>;
        await db.update(trips).set({ title: d.title, itinerary: d.itinerary }).where(eq(trips.id, tripId));
        return Response.json({ ok: true });
      }
      if (action === "add-stop") {
        const d = data as z.infer<typeof schemas["add-stop"]>;
        const [place] = await db.select().from(destinations).where(and(eq(destinations.id, d.destinationId), eq(destinations.status, "published")));
        if (!place) return errorResponse("Destination not found.", 404);
        const existing = await db.select({ id: tripStops.id }).from(tripStops).where(and(eq(tripStops.tripId, tripId), eq(tripStops.destinationId, place.id)));
        if (existing.length) return Response.json({ ok: true, message: "Already in your trip." });
        await db.insert(tripStops).values({ tripId, destinationId: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude, sortOrder: Date.now() % 1000000 });
        return Response.json({ ok: true });
      }
      const d = data as z.infer<typeof schemas["remove-stop"]>;
      await db.delete(tripStops).where(and(eq(tripStops.id, d.stopId), eq(tripStops.tripId, tripId)));
      return Response.json({ ok: true });
    }
    if (action === "submit-hidden") {
      const d = data as z.infer<typeof schemas["submit-hidden"]>;
      await db.insert(hiddenPlaces).values({ name: d.name, description: d.description, category: d.category, district: d.district,
        taluk: d.taluk, town: d.town, coordinatePrecision: d.coordinatePrecision,
        latitude: d.latitude, longitude: d.longitude, imageUrl: d.imageUrl, directions: d.directions,
        sourceUrl: d.sourceUrl || null, submittedBy: user.id, status: "pending", verificationLevel: "pending_verification" });
      return Response.json({ ok: true, message: "Submitted for review. It will not be published until an admin verifies it." }, { status: 201 });
    }
    if (action === "create-business") {
      const d = data as z.infer<typeof schemas["create-business"]>;
      const [listing] = await db.insert(businessListings).values({ ownerId: user.id, name: d.name, category: d.category,
        description: d.description, address: d.address, latitude: d.latitude, longitude: d.longitude,
        phone: d.phone, whatsapp: d.whatsapp || null, hours: d.hours, imageUrl: d.imageUrl, status: "pending" }).returning();
      if (["bike-rentals", "camera-rentals", "car-rentals", "camping-equipment"].includes(d.category))
        await db.insert(rentalDealers).values({ listingId: listing.id, rentalType: d.category });
      if (["hotels", "homestays", "resorts", "guest-houses", "campsites"].includes(d.category)) await db.insert(hotels).values({ listingId: listing.id, kind: d.category });
      if (d.category === "homestays") await db.insert(homestays).values({ listingId: listing.id });
      if (d.category === "restaurants") await db.insert(restaurants).values({ listingId: listing.id });
      await db.insert(subscriptions).values({ listingId: listing.id, plan: "free", status: "active" });
      return Response.json({ ok: true, listingId: listing.id, message: "Your free listing is pending review. No payment is required." }, { status: 201 });
    }
    if (action === "update-business") {
      const d = data as z.infer<typeof schemas["update-business"]>;
      const [listing] = await db.select().from(businessListings).where(and(eq(businessListings.id, d.listingId), eq(businessListings.ownerId, user.id)));
      if (!listing) return errorResponse("Listing not found.", 404);
      await db.update(businessListings).set({ description: d.description, address: d.address, latitude: d.latitude,
        longitude: d.longitude, phone: d.phone, hours: d.hours, imageUrl: d.imageUrl,
        status: "pending", verified: false }).where(eq(businessListings.id, d.listingId));
      return Response.json({ ok: true, message: "Changes saved and sent for re-review." });
    }
    if (action === "add-product") {
      const d = data as z.infer<typeof schemas["add-product"]>;
      const [listing] = await db.select({ id: businessListings.id }).from(businessListings)
        .where(and(eq(businessListings.id, d.listingId), eq(businessListings.ownerId, user.id)));
      if (!listing) return errorResponse("Listing not found.", 404);
      await db.insert(rentalProducts).values({ listingId: d.listingId, name: d.name, description: d.description,
        priceRupees: d.priceRupees, priceUnit: d.priceUnit, available: d.available });
      return Response.json({ ok: true }, { status: 201 });
    }
    if (action === "delete-product") {
      const d = data as z.infer<typeof schemas["delete-product"]>;
      const [product] = await db.select({ id: rentalProducts.id }).from(rentalProducts)
        .innerJoin(businessListings, eq(rentalProducts.listingId, businessListings.id))
        .where(and(eq(rentalProducts.id, d.productId), eq(businessListings.ownerId, user.id)));
      if (!product) return errorResponse("Product not found.", 404);
      await db.delete(rentalProducts).where(eq(rentalProducts.id, d.productId));
      return Response.json({ ok: true });
    }
    if (action === "register-guide") {
      const d = data as z.infer<typeof schemas["register-guide"]>;
      const values = { name: d.name, location: d.location, languages: d.languages, experience: d.experience,
        specialisation: d.specialisation, serviceChargeRupees: d.serviceChargeRupees, availability: d.availability,
        photoUrl: d.photoUrl, status: "pending", verified: false };
      const [existing] = await db.select().from(localGuides).where(eq(localGuides.userId, user.id));
      if (existing) await db.update(localGuides).set(values).where(eq(localGuides.id, existing.id));
      else await db.insert(localGuides).values({ userId: user.id, ...values });
      return Response.json({ ok: true, message: "Guide profile submitted for admin review." });
    }
    if (action === "enquiry") {
      const d = data as z.infer<typeof schemas.enquiry>;
      if (Number(!!d.listingId) + Number(!!d.guideId) !== 1) return errorResponse("Choose a listing or guide.");
      if (d.listingId) {
        const [listing] = await db.select().from(businessListings).where(and(eq(businessListings.id, d.listingId), eq(businessListings.status, "approved")));
        if (!listing) return errorResponse("Listing is unavailable.", 404);
      }
      if (d.guideId) {
        const [guide] = await db.select().from(localGuides).where(and(eq(localGuides.id, d.guideId), eq(localGuides.status, "approved")));
        if (!guide) return errorResponse("Guide is unavailable.", 404);
      }
      await db.insert(bookings).values({ userId: user.id, listingId: d.listingId, guideId: d.guideId,
        message: d.message, travelDate: d.travelDate, status: "enquiry" });
      return Response.json({ ok: true, message: "Enquiry sent. This is not a confirmed booking." }, { status: 201 });
    }
    if (action === "review") {
      const d = data as z.infer<typeof schemas.review>;
      if (Number(!!d.destinationId) + Number(!!d.listingId) + Number(!!d.guideId) !== 1) return errorResponse("Choose one place to review.");
      if (d.destinationId) {
        const [target] = await db.select({ id: destinations.id }).from(destinations).where(and(eq(destinations.id, d.destinationId), eq(destinations.status, "published")));
        if (!target) return errorResponse("Destination not found.", 404);
      }
      await db.insert(reviews).values({ userId: user.id, destinationId: d.destinationId, listingId: d.listingId,
        guideId: d.guideId, rating: d.rating, body: d.body, status: "pending" });
      return Response.json({ ok: true, message: "Review submitted for moderation." }, { status: 201 });
    }
    if (action === "community-post") {
      const d = data as z.infer<typeof schemas["community-post"]>;
      await db.insert(communityPosts).values({ userId: user.id, body: d.body, destinationId: d.destinationId,
        imageUrl: d.imageUrl, status: "pending" });
      return Response.json({ ok: true, message: "Post submitted for moderation." }, { status: 201 });
    }
    if (["like-post", "comment-post"].includes(action)) {
      const d = data as z.infer<typeof schemas["like-post"]>;
      const [post] = await db.select({ id: communityPosts.id }).from(communityPosts).where(and(eq(communityPosts.id, d.postId), eq(communityPosts.status, "approved")));
      if (!post) return errorResponse("Post not found.", 404);
      if (action === "comment-post") {
        await db.insert(postComments).values({ postId: d.postId, userId: user.id, body: (data as z.infer<typeof schemas["comment-post"]>).body });
        return Response.json({ ok: true, message: "Comment submitted for moderation." });
      }
      const [like] = await db.select().from(postLikes).where(and(eq(postLikes.postId, d.postId), eq(postLikes.userId, user.id)));
      if (like) await db.delete(postLikes).where(eq(postLikes.id, like.id));
      else await db.insert(postLikes).values({ postId: d.postId, userId: user.id }).onConflictDoNothing();
      return Response.json({ ok: true, liked: !like });
    }
    if (action === "report") {
      const d = data as z.infer<typeof schemas.report>;
      if (!d.destinationId && !d.postId) return errorResponse("Choose an item to report.");
      await db.insert(reports).values({ userId: user.id, destinationId: d.destinationId, postId: d.postId, reason: d.reason });
      return Response.json({ ok: true, message: "Thank you. Our team will review the report." });
    }
    if (action === "profile") {
      const d = data as z.infer<typeof schemas.profile>;
      await db.update(users).set({ name: d.name, location: d.location }).where(eq(users.id, user.id));
      return Response.json({ ok: true });
    }
    return errorResponse("Unknown action.");
  } catch (error) {
    console.error("Action failed", action, error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}
