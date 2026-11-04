import { boolean, date, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(), name: varchar("name", { length: 120 }).notNull(), email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(), role: varchar("role", { length: 20 }).notNull().default("traveller"),
  avatarUrl: text("avatar_url"), location: varchar("location", { length: 160 }),
  sessionVersion: integer("session_version").notNull().default(0),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }), createdAt: created(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const states = pgTable("states", {
  id: id(), countryCode: varchar("country_code", { length: 2 }).notNull().default("IN"),
  name: varchar("name", { length: 100 }).notNull(), slug: varchar("slug", { length: 120 }).notNull(),
}, (t) => [uniqueIndex("states_slug_idx").on(t.slug)]);

export const districts = pgTable("districts", {
  id: id(), stateId: uuid("state_id").notNull().references(() => states.id),
  name: varchar("name", { length: 100 }).notNull(), slug: varchar("slug", { length: 120 }).notNull(),
}, (t) => [uniqueIndex("districts_state_slug_idx").on(t.stateId, t.slug)]);

export const destinationCategories = pgTable("destination_categories", {
  id: id(), name: varchar("name", { length: 100 }).notNull(), slug: varchar("slug", { length: 100 }).notNull(),
}, (t) => [uniqueIndex("destination_categories_slug_idx").on(t.slug)]);

export const destinations = pgTable("destinations", {
  id: id(), slug: varchar("slug", { length: 180 }).notNull(), name: varchar("name", { length: 180 }).notNull(),
  description: text("description").notNull(), stateId: uuid("state_id").notNull().references(() => states.id),
  districtId: uuid("district_id").notNull().references(() => districts.id),
  categoryId: uuid("category_id").notNull().references(() => destinationCategories.id),
  latitude: doublePrecision("latitude").notNull(), longitude: doublePrecision("longitude").notNull(),
  imageUrl: text("image_url"), imageCredit: varchar("image_credit", { length: 180 }), imageSourceUrl: text("image_source_url"),
  sourceUrl: text("source_url"), sourceLabel: varchar("source_label", { length: 140 }),
  bestTime: varchar("best_time", { length: 160 }), visitorInfo: text("visitor_info"), safetyInfo: text("safety_info"),
  accessibilityInfo: text("accessibility_info"),
  openingHours: varchar("opening_hours", { length: 160 }), entryFee: varchar("entry_fee", { length: 120 }),
  taluk: varchar("taluk", { length: 120 }), town: varchar("town", { length: 160 }),
  subcategory: varchar("subcategory", { length: 120 }),
  verificationLevel: varchar("verification_level", { length: 30 }).notNull().default("location_verified"),
  coordinatePrecision: varchar("coordinate_precision", { length: 30 }).notNull().default("site"),
  coordinateSourceUrl: text("coordinate_source_url"), sourceType: varchar("source_type", { length: 40 }),
  districtNote: text("district_note"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  isHidden: boolean("is_hidden").notNull().default(false), featured: boolean("featured").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id), createdAt: created(),
}, (t) => [uniqueIndex("destinations_slug_idx").on(t.slug), index("destinations_geo_idx").on(t.latitude, t.longitude), index("destinations_district_idx").on(t.districtId), index("destinations_status_idx").on(t.status),
  index("destinations_district_status_idx").on(t.districtId, t.status, t.categoryId),
  index("destinations_district_taluk_idx").on(t.districtId, t.taluk),
  index("destinations_verification_idx").on(t.verificationLevel, t.status),
  index("destinations_status_geo_idx").on(t.status, t.latitude, t.longitude)]);

export const destinationImages = pgTable("destination_images", {
  id: id(), destinationId: uuid("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
  url: text("url").notNull(), alt: text("alt"), credit: text("credit"), sourceUrl: text("source_url"), createdAt: created(),
}, (t) => [index("destination_images_destination_idx").on(t.destinationId)]);

export const hiddenPlaces = pgTable("hidden_places", {
  id: id(), name: varchar("name", { length: 180 }).notNull(), description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(), district: varchar("district", { length: 120 }),
  taluk: varchar("taluk", { length: 120 }), town: varchar("town", { length: 160 }),
  coordinatePrecision: varchar("coordinate_precision", { length: 30 }).notNull().default("user_submitted"),
  verificationLevel: varchar("verification_level", { length: 30 }).notNull().default("pending_verification"),
  imageUrl: text("image_url"), directions: text("directions"), sourceUrl: text("source_url"),
  submittedBy: uuid("submitted_by").references(() => users.id), status: varchar("status", { length: 20 }).notNull().default("pending"),
  destinationId: uuid("destination_id").references(() => destinations.id), adminNote: text("admin_note"), createdAt: created(),
}, (t) => [index("hidden_places_status_idx").on(t.status), index("hidden_places_geo_idx").on(t.latitude, t.longitude)]);

export const nearbyPlaces = pgTable("nearby_places", {
  id: id(), destinationId: uuid("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
  nearbyDestinationId: uuid("nearby_destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
}, (t) => [uniqueIndex("nearby_places_pair_idx").on(t.destinationId, t.nearbyDestinationId)]);

export const trips = pgTable("trips", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(), startLocation: varchar("start_location", { length: 180 }),
  travelDate: date("travel_date"), days: integer("days").notNull().default(1), travellers: integer("travellers").notNull().default(1),
  budget: integer("budget"), transport: varchar("transport", { length: 40 }), interests: text("interests"),
  itinerary: jsonb("itinerary").$type<{ day: number; title: string; activities: string[] }[]>(),
  shareId: uuid("share_id").defaultRandom(), createdAt: created(),
}, (t) => [index("trips_user_idx").on(t.userId), uniqueIndex("trips_share_idx").on(t.shareId)]);

export const tripStops = pgTable("trip_stops", {
  id: id(), tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  destinationId: uuid("destination_id").references(() => destinations.id), name: varchar("name", { length: 180 }).notNull(),
  latitude: doublePrecision("latitude"), longitude: doublePrecision("longitude"), day: integer("day").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0), notes: text("notes"),
}, (t) => [index("trip_stops_trip_idx").on(t.tripId)]);

export const routes = pgTable("routes", {
  id: id(), userId: uuid("user_id").references(() => users.id), tripId: uuid("trip_id").references(() => trips.id),
  destinationId: uuid("destination_id").references(() => destinations.id),
  originName: varchar("origin_name", { length: 160 }), origin: jsonb("origin"), destination: jsonb("destination"),
  travelMode: varchar("travel_mode", { length: 20 }), provider: varchar("provider", { length: 40 }),
  distanceMeters: integer("distance_meters"), durationSeconds: integer("duration_seconds"), createdAt: created(),
}, (t) => [index("routes_user_idx").on(t.userId), index("routes_destination_idx").on(t.destinationId)]);

export const businessListings = pgTable("business_listings", {
  id: id(), ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: varchar("name", { length: 180 }).notNull(), category: varchar("category", { length: 80 }).notNull(),
  description: text("description"), address: text("address").notNull(), latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(), phone: varchar("phone", { length: 24 }),
  whatsapp: varchar("whatsapp", { length: 24 }), website: text("website"), hours: varchar("hours", { length: 160 }),
  imageUrl: text("image_url"), status: varchar("status", { length: 20 }).notNull().default("pending"),
  verified: boolean("verified").notNull().default(false), featured: boolean("featured").notNull().default(false), createdAt: created(),
}, (t) => [index("business_listings_category_idx").on(t.category), index("business_listings_geo_idx").on(t.latitude, t.longitude), index("business_listings_owner_idx").on(t.ownerId)]);

export const rentalDealers = pgTable("rental_dealers", {
  id: id(), listingId: uuid("listing_id").notNull().references(() => businessListings.id, { onDelete: "cascade" }),
  rentalType: varchar("rental_type", { length: 60 }).notNull(),
}, (t) => [uniqueIndex("rental_dealers_listing_idx").on(t.listingId)]);

export const rentalProducts = pgTable("rental_products", {
  id: id(), listingId: uuid("listing_id").notNull().references(() => businessListings.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 140 }).notNull(), description: text("description"), imageUrl: text("image_url"),
  priceRupees: integer("price_rupees"), priceUnit: varchar("price_unit", { length: 30 }),
  available: boolean("available").notNull().default(false), createdAt: created(),
}, (t) => [index("rental_products_listing_idx").on(t.listingId)]);

export const hotels = pgTable("hotels", {
  id: id(), listingId: uuid("listing_id").notNull().references(() => businessListings.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull().default("hotel"), facilities: text("facilities"),
  indicativePriceRupees: integer("indicative_price_rupees"),
}, (t) => [uniqueIndex("hotels_listing_idx").on(t.listingId)]);

export const homestays = pgTable("homestays", {
  id: id(), listingId: uuid("listing_id").notNull().references(() => businessListings.id, { onDelete: "cascade" }),
  facilities: text("facilities"),
}, (t) => [uniqueIndex("homestays_listing_idx").on(t.listingId)]);

export const restaurants = pgTable("restaurants", {
  id: id(), listingId: uuid("listing_id").notNull().references(() => businessListings.id, { onDelete: "cascade" }),
  cuisine: varchar("cuisine", { length: 120 }),
}, (t) => [uniqueIndex("restaurants_listing_idx").on(t.listingId)]);

export const localGuides = pgTable("local_guides", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 120 }).notNull(), location: varchar("location", { length: 160 }).notNull(),
  languages: varchar("languages", { length: 180 }).notNull(), experience: text("experience"),
  specialisation: text("specialisation"), serviceChargeRupees: integer("service_charge_rupees"),
  availability: varchar("availability", { length: 160 }), photoUrl: text("photo_url"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), verified: boolean("verified").notNull().default(false), createdAt: created(),
}, (t) => [index("local_guides_user_idx").on(t.userId)]);

export const bookings = pgTable("bookings", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id),
  listingId: uuid("listing_id").references(() => businessListings.id), guideId: uuid("guide_id").references(() => localGuides.id),
  message: text("message").notNull(), travelDate: date("travel_date"),
  status: varchar("status", { length: 20 }).notNull().default("enquiry"), createdAt: created(),
}, (t) => [index("bookings_user_idx").on(t.userId), index("bookings_listing_idx").on(t.listingId)]);

export const reviews = pgTable("reviews", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id),
  destinationId: uuid("destination_id").references(() => destinations.id), listingId: uuid("listing_id").references(() => businessListings.id),
  guideId: uuid("guide_id").references(() => localGuides.id), rating: integer("rating").notNull(),
  body: text("body").notNull(), status: varchar("status", { length: 20 }).notNull().default("pending"), createdAt: created(),
}, (t) => [index("reviews_destination_idx").on(t.destinationId), index("reviews_status_idx").on(t.status)]);

export const savedPlaces = pgTable("saved_places", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  destinationId: uuid("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }), createdAt: created(),
}, (t) => [uniqueIndex("saved_places_user_destination_idx").on(t.userId, t.destinationId)]);

export const communityPosts = pgTable("community_posts", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id),
  destinationId: uuid("destination_id").references(() => destinations.id), body: text("body").notNull(),
  imageUrl: text("image_url"), status: varchar("status", { length: 20 }).notNull().default("pending"), createdAt: created(),
}, (t) => [index("community_posts_status_idx").on(t.status)]);

export const postLikes = pgTable("post_likes", {
  id: id(), postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [uniqueIndex("post_likes_unique_idx").on(t.postId, t.userId)]);

export const postComments = pgTable("post_comments", {
  id: id(), postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id), body: text("body").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), createdAt: created(),
}, (t) => [index("post_comments_post_idx").on(t.postId)]);

export const notifications = pgTable("notifications", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(), body: text("body").notNull(), read: boolean("read").notNull().default(false), createdAt: created(),
});

export const subscriptions = pgTable("subscriptions", {
  id: id(), listingId: uuid("listing_id").notNull().references(() => businessListings.id),
  plan: varchar("plan", { length: 30 }).notNull().default("free"), status: varchar("status", { length: 20 }).notNull().default("inactive"),
  expiresAt: timestamp("expires_at", { withTimezone: true }), createdAt: created(),
});

export const adminUsers = pgTable("admin_users", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id), createdAt: created(),
}, (t) => [uniqueIndex("admin_users_user_idx").on(t.userId)]);

export const reports = pgTable("reports", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id),
  destinationId: uuid("destination_id").references(() => destinations.id), postId: uuid("post_id").references(() => communityPosts.id),
  reason: text("reason").notNull(), status: varchar("status", { length: 20 }).notNull().default("open"), createdAt: created(),
});

export const mediaAssets = pgTable("media_assets", {
  id: id(), ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mimeType: varchar("mime_type", { length: 40 }).notNull(), data: text("data").notNull(),
  sizeBytes: integer("size_bytes").notNull(), createdAt: created(),
}, (t) => [index("media_assets_owner_idx").on(t.ownerId)]);

export const districtBoundaries = pgTable("district_boundaries", {
  id: id(), districtId: uuid("district_id").notNull().references(() => districts.id),
  minLatitude: doublePrecision("min_latitude").notNull(), maxLatitude: doublePrecision("max_latitude").notNull(),
  minLongitude: doublePrecision("min_longitude").notNull(), maxLongitude: doublePrecision("max_longitude").notNull(),
  polygon: jsonb("polygon").$type<[number, number][]>().notNull(),
  sourceUrl: text("source_url").notNull(), sourceLabel: varchar("source_label", { length: 160 }),
  osmRelationId: varchar("osm_relation_id", { length: 40 }), createdAt: created(),
}, (t) => [uniqueIndex("district_boundaries_district_idx").on(t.districtId)]);

export const taluks = pgTable("taluks", {
  id: id(), districtId: uuid("district_id").notNull().references(() => districts.id),
  name: varchar("name", { length: 120 }).notNull(), slug: varchar("slug", { length: 140 }).notNull(),
  note: text("note"), createdAt: created(),
}, (t) => [uniqueIndex("taluks_district_slug_idx").on(t.districtId, t.slug)]);

export const passwordResets = pgTable("password_resets", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), createdAt: created(),
}, (t) => [index("password_resets_user_idx").on(t.userId), uniqueIndex("password_resets_code_idx").on(t.codeHash)]);

export const contactMessages = pgTable("contact_messages", {
  id: id(), name: varchar("name", { length: 120 }).notNull(), email: varchar("email", { length: 255 }).notNull(),
  message: text("message").notNull(), createdAt: created(),
});
