# TripNearby

**Every Journey Has More to Discover.** A Next.js 16 + React 19 + PostgreSQL/Drizzle travel-discovery MVP, initially focused on Karnataka, India.

## What works

- Country → state → district → destination browsing, search, categories, sourced photographs, place details, saved places and moderated reviews.
- Nearby discovery with 5/10/25/50/100 km **geographic candidate filters**. With Google Routes configured, results include actual road distance and duration. Without it, road metrics are explicitly unavailable, never replaced by straight-line distances.
- Source-backed offbeat places, submissions with photo upload, and admin verification before publication. Punyasthala is **not** seeded: its location/listing was not established from reliable sources.
- Interactive maps (Google Maps JavaScript with a browser key; attributed OpenStreetMap/Leaflet fallback). Google Maps navigation links work without a key. Multi-stop Routes API routing and corridor-based sourced suggestions work with a server key.
- Approved business listings, local guides, dealer products, enquiries, optional live Google Places searches, admin moderation, and free-plan status. Live Google Places data is transient and is not represented as a verified TripNearby business. No fake dealers, rates, reviews, availability, or payment flow.
- Grounded day-by-day itinerary outlines, optional OpenAI Responses API, editable notes, saved/shareable trips, community posts/likes/comments/reports, profile, login and contact.
- Browser GPS and optional live companion require explicit permission; tracking stops when disabled or the page closes. Notifications are opt-in and frequency-limited.

## Local setup

1. Install Node 22+, npm and PostgreSQL. Create a database and set `DATABASE_URL`.
2. `npm install`
3. `cp .env.example .env` and generate a unique secret: `openssl rand -base64 48`. Replace `SESSION_SECRET` in `.env`.
4. Apply the schema: `npx drizzle-kit push --config=drizzle.config.ts`
5. Seed the **sourced** Karnataka catalog: `node --env-file=.env --import tsx src/db/seed.ts` (idempotent; 15 real place references, 13 districts, no business/review fixtures).
6. `npm run dev` and visit `http://localhost:3000`. `/api/health` checks database connectivity.

The included `drizzle.config.json` retains the sandbox's local database connection. Use the portable `drizzle.config.ts` command above for your own environment. Schema source is `src/db/schema.ts` (users, states, districts, destinations/categories/images, hidden places, routes/trips/stops, businesses/rentals/products/stays/guides/restaurants, bookings, reviews, saved places, community, reports, media, notifications, subscriptions, admin users).

## Optional integrations

Set `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` for the Google Maps JavaScript map. This key is visible in the browser by design; **restrict it to your domain's HTTP referrers and the Maps JavaScript API**. Set private `GOOGLE_MAPS_SERVER_API_KEY` for Routes API and Places API (New); restrict its API permissions and enable billing. The server calculates road routes via `computeRoutes`, road distances via `computeRouteMatrix`, and searches live Places with required field masks. Google Places single-circle searches are limited to 50 km, even when TripNearby's own listing radius is 100 km. Do not cache or republish Google Places data as your own verified listings; comply with Google attribution and licensing terms. Geocoding isn't required for the MVP's coordinate-based route selection.

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` to enhance itinerary text via the Responses API. Without it, the endpoint returns a clearly labelled catalog-based outline. Both modes only select published catalog stops; neither invents prices, travel times or availability. Road route calculation requires Google Routes separately.

## Administration and trust

Accounts are created as travellers. There is **no public admin registration**. After creating your own account, promote it using trusted database access:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
INSERT INTO admin_users (user_id) SELECT id FROM users WHERE email = 'your-email@example.com' ON CONFLICT (user_id) DO NOTHING;
```

Visit `/admin`. Admin mutations re-check the role server-side. Hidden-place approval requires a verified source URL, district and category; the moderator must independently check coordinates. Business approval does not automatically grant a verified badge. Reviews, posts and comments are moderated. Paid subscriptions are intentionally disabled until real payments, invoicing and refunds exist.

Uploads accept JPEG/PNG/WebP signatures up to 2 MB. They are stored in PostgreSQL for this MVP. Move media to private object storage with moderation/access policies before operating at scale. Sessions use signed HTTP-only cookies; mutation routes validate inputs and check origin with basic in-memory throttling. Before a public launch, add distributed rate limiting, email verification/password recovery, abuse controls, observability, data retention tooling and professional security/legal review.

## Deployment

Deploy Next.js to Vercel or a Node-compatible host with a **managed PostgreSQL** instance. Configure environment variables in the host, enable HTTPS, use separate restricted browser/server Google keys, apply the schema with `npx drizzle-kit push --config=drizzle.config.ts` in a controlled release step, then run the seed once. Never run schema pushes from public requests. The app's PostgreSQL connection must be reachable from the deployment; add pooling for serverless load.

This sandbox uses Drizzle/PostgreSQL and first-party signed sessions because Supabase credentials were not supplied. It does **not** claim to use Supabase Auth, Storage or RLS. If migrating to Supabase, move media to Supabase Storage, adopt Supabase Auth, and enable/test RLS policies before granting any browser access to database tables. Currently all database access is server-side and role/ownership checks are enforced in route handlers.

## Source integrity

Seed records include a traceable `source_url` (Karnataka Tourism, UNESCO, NCSCM or Wikimedia/Wikipedia references) and photo attribution. Photo-specific links are stored separately. Unverified opening hours and entry fees are left blank. Reference pins may not mark entrances. Confirm access, pricing, weather and safety with the operator or official source before travel. The catalog can be extended by moderators without fabricating destinations.
