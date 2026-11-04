import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { states, districts, destinationCategories, destinations, destinationImages, hiddenPlaces } from "./schema";

const pexels = (photo: number) => `https://images.pexels.com/photos/${photo}/pexels-photo-${photo}.jpeg?auto=compress&cs=tinysrgb&w=1400`;
const photoPage = (photo: number) => `https://www.pexels.com/photo/${photo}/`;

type Place = {
  slug: string; name: string; district: string; category: string; latitude: number; longitude: number;
  description: string; sourceUrl: string; sourceLabel: string; image?: number; credit?: string;
  imageUrl?: string; imageSourceUrl?: string; bestTime?: string; visitorInfo?: string; safetyInfo?: string;
  hidden?: boolean; featured?: boolean;
};

const places: Place[] = [
  {
    slug: "hampi", name: "Hampi", district: "Vijayanagara", category: "Heritage", latitude: 15.335, longitude: 76.46,
    description: "Explore the monumental ruins and boulder-strewn landscape of the former Vijayanagara capital, a UNESCO World Heritage Site.",
    sourceUrl: "https://whc.unesco.org/en/list/241/", sourceLabel: "UNESCO World Heritage Centre", image: 38297408, credit: "Rajath Ravi / Pexels",
    visitorInfo: "The heritage area is extensive. Plan time for walking between monuments and check individual monument access locally.",
    safetyInfo: "Carry drinking water and sun protection; stay on marked routes around fragile ruins.", featured: true,
  },
  {
    slug: "mysore-palace", name: "Mysore Palace", district: "Mysuru", category: "Heritage", latitude: 12.3052, longitude: 76.6552,
    description: "A landmark royal residence in Mysuru, known for its richly detailed architecture and the city's enduring cultural heritage.",
    sourceUrl: "https://karnatakatourism.org/en/destinations/mysuru/", sourceLabel: "Karnataka Tourism", image: 34962788, credit: "Sachin Shettigar / Pexels",
    visitorInfo: "Check the official palace website for current entry rules, hours and ticket prices before visiting.", featured: true,
  },
  {
    slug: "jog-falls", name: "Jog Falls", district: "Shivamogga", category: "Waterfalls", latitude: 14.2295, longitude: 74.8125,
    description: "The Sharavathi River plunges over a dramatic escarpment at one of Karnataka's most celebrated waterfall viewpoints.",
    sourceUrl: "https://karnatakatourism.org/en/blogs/places-to-visit-in-karnataka-during-monsoon-2/", sourceLabel: "Karnataka Tourism", image: 2789026, credit: "Shekhar Bhat / Pexels",
    bestTime: "Water flow is typically strongest in monsoon; check conditions before travel.",
    safetyInfo: "Keep behind viewpoint barriers; paths can be slippery during rain.", featured: true,
  },
  {
    slug: "shanti-sagara", name: "Shanti Sagara", district: "Davanagere", category: "Lakes", latitude: 14.13, longitude: 75.90472,
    description: "Also called Sulekere, Shanti Sagara is a historic reservoir near Channagiri. Its open waters offer a quieter pause in the Davanagere region.",
    sourceUrl: "https://www.karnatakatourism.org/tour-item/davanagere/", sourceLabel: "Karnataka Tourism", imageUrl: "/images/shanti-sagara.jpg",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Shanthisagara1.jpg", credit: "Prasannatb / Wikimedia Commons (CC0)",
    bestTime: "October to February is generally cooler in Davanagere (Karnataka Tourism).",
    visitorInfo: "The map pin indicates the lake, not a guaranteed entrance or parking location. Confirm local access on arrival.",
    safetyInfo: "Avoid entering the water and take care on unguarded banks.", featured: true,
  },
  {
    slug: "abbey-falls", name: "Abbey Falls", district: "Kodagu", category: "Waterfalls", latitude: 12.4593, longitude: 75.7209,
    description: "A waterfall set among the coffee-growing hills near Madikeri, with a viewing area surrounded by lush vegetation.",
    sourceUrl: "https://karnatakatourism.org/en/blogs/places-to-visit-in-karnataka-during-monsoon-2/", sourceLabel: "Karnataka Tourism", image: 36523844, credit: "Ankittt Bhattacharjee / Pexels",
    safetyInfo: "Do not cross barriers or enter the water. Trails can be slippery in wet weather.", featured: true,
  },
  {
    slug: "badami-cave-temples", name: "Badami Cave Temples", district: "Bagalkot", category: "Heritage", latitude: 15.9149, longitude: 75.676,
    description: "Rock-cut cave temples carved into the red sandstone cliffs of Badami, part of North Karnataka's Chalukyan heritage circuit.",
    sourceUrl: "https://karnatakatourism.org/en/blogs/places-to-visit-in-karnataka-during-monsoon-2/", sourceLabel: "Karnataka Tourism", image: 18331993, credit: "Abhinandan J. Patil / Pexels",
    safetyInfo: "Climb carefully on stone steps and carry water in hot weather.", featured: true,
  },
  {
    slug: "chitradurga-fort", name: "Chitradurga Fort", district: "Chitradurga", category: "Forts", latitude: 14.226, longitude: 76.4,
    description: "A historic hill fort winding through Chitradurga's rocky landscape, with gateways, fortifications and sweeping views.",
    sourceUrl: "https://karnatakatourism.org/tour-item/?type%5B%5D=forts", sourceLabel: "Karnataka Tourism", image: 12264811, credit: "Pause the Moment / Pexels",
    visitorInfo: "Allow time to explore on foot. Check current entry rules locally.", safetyInfo: "Wear suitable shoes and avoid exposed edges.",
  },
  {
    slug: "nandi-hills", name: "Nandi Hills", district: "Chikkaballapur", category: "Hills", latitude: 13.37, longitude: 77.683,
    description: "A hilltop escape near Bengaluru with broad views across the surrounding landscape.",
    sourceUrl: "https://karnatakatourism.org/en/destinations/bengaluru/", sourceLabel: "Karnataka Tourism", image: 34429831, credit: "Aditya Oberai / Pexels",
    visitorInfo: "Check local access rules, vehicle restrictions and opening times before setting out.", featured: true,
  },
  {
    slug: "st-marys-island", name: "St. Mary's Island", district: "Udupi", category: "Beaches", latitude: 13.377, longitude: 74.675,
    description: "An island off Malpe known for remarkable basalt formations. Access depends on local boat services and sea conditions.",
    sourceUrl: "https://dwiep.ncscm.res.in/Island/IslandDetails/INKA066", sourceLabel: "National Centre for Sustainable Coastal Management", image: 38785876, credit: "Nikhil Nuance nation / Pexels",
    visitorInfo: "Reached by boat from Malpe; verify sailings and weather locally. The map pin is on the island, not the boarding point.",
    safetyInfo: "Follow boat operator guidance and avoid rough seas.",
  },
  {
    slug: "kudle-beach", name: "Kudle Beach", district: "Uttara Kannada", category: "Beaches", latitude: 14.544, longitude: 74.316,
    description: "A curved sandy beach near Gokarna, framed by rocky headlands and the Arabian Sea.",
    sourceUrl: "https://karnatakatourism.org/en/destinations/gokarna/", sourceLabel: "Karnataka Tourism", image: 6769121, credit: "Syed Qaarif Andrabi / Pexels",
    safetyInfo: "Observe local sea conditions and do not swim without confirmed safe conditions.",
  },
  {
    slug: "lalbagh-botanical-garden", name: "Lalbagh Botanical Garden", district: "Bengaluru", category: "Nature", latitude: 12.9507, longitude: 77.5848,
    description: "Bengaluru's historic botanical garden, home to the Glass House, plant collections and seasonal flower shows.",
    sourceUrl: "https://karnatakatourism.org/en/destinations/bengaluru/", sourceLabel: "Karnataka Tourism",
    visitorInfo: "Check current visitor hours, gate access and ticket details through official channels.",
  },
  {
    slug: "kunduvada-kere", name: "Kunduvada Kere", district: "Davanagere", category: "Lakes", latitude: 14.456, longitude: 75.89,
    description: "A lake on the outskirts of Davanagere noted by Karnataka Tourism as a place for evening walks and sunset views.",
    sourceUrl: "https://www.karnatakatourism.org/tour-item/davanagere/", sourceLabel: "Karnataka Tourism",
    visitorInfo: "The map pin marks the lake area; verify public access and local conditions.",
  },
  {
    slug: "amrutesvara-temple", name: "Amrutesvara Temple", district: "Chikkamagaluru", category: "Temples", latitude: 13.741, longitude: 75.854,
    description: "A 12th-century Hoysala temple in Amruthapura village, known for its finely worked stone architecture.",
    sourceUrl: "https://en.wikipedia.org/wiki/Amrutesvara_Temple,_Amruthapura", sourceLabel: "Wikipedia / Wikimedia reference",
    visitorInfo: "A quieter heritage stop; confirm access and worship etiquette locally before visiting.", hidden: true,
  },
  {
    slug: "honnemaradu", name: "Honnemaradu", district: "Shivamogga", category: "Nature", latitude: 14.178146, longitude: 74.876289,
    description: "A quiet backwater destination near the Linganamakki reservoir, known for nature-focused outings and supervised water activities.",
    sourceUrl: "https://karnatakatourism.org/en/experiences/waterside-escapes-at-honnemaradu/", sourceLabel: "Karnataka Tourism",
    visitorInfo: "Arrange water activities only with authorised operators; availability is not guaranteed.",
    safetyInfo: "Do not enter the water without supervised safety equipment.", hidden: true,
  },
  {
    slug: "anegundi", name: "Anegundi", district: "Koppal", category: "Heritage", latitude: 15.35278, longitude: 76.49194,
    description: "A historic village across the Tungabhadra from Hampi, with old streets, temples and a slower pace of exploration.",
    sourceUrl: "https://old.karnatakatourism.org/tour-item/vijayanagara/", sourceLabel: "Karnataka Tourism",
    visitorInfo: "Check river crossing and road options locally; the map pin marks the village centre.", hidden: true,
  },
];

const gallery: Record<string, { photo: number; credit: string }[]> = {
  hampi: [{ photo: 18320349, credit: "Abhinandan J. Patil / Pexels" }, { photo: 33722556, credit: "Shel Dan / Pexels" }],
  "mysore-palace": [{ photo: 5480518, credit: "Pranavsinh suratia / Pexels" }],
  "jog-falls": [{ photo: 9943650, credit: "Chaos / Pexels" }],
  "badami-cave-temples": [{ photo: 32563589, credit: "Roman Saienko / Pexels" }],
};

async function seed() {
  await db.insert(states).values({ name: "Karnataka", slug: "karnataka", countryCode: "IN" }).onConflictDoNothing();
  const [state] = await db.select().from(states).where(eq(states.slug, "karnataka"));
  if (!state) throw new Error("Could not seed Karnataka");

  const districtNames = ["Bagalkot", "Bengaluru", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Davanagere", "Kodagu", "Koppal", "Mysuru", "Shivamogga", "Udupi", "Uttara Kannada", "Vijayanagara"];
  const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  for (const name of districtNames) await db.insert(districts).values({ stateId: state.id, name, slug: slug(name) }).onConflictDoNothing();
  for (const name of ["Heritage", "Lakes", "Waterfalls", "Forts", "Temples", "Beaches", "Hills", "Nature"]) {
    await db.insert(destinationCategories).values({ name, slug: slug(name) }).onConflictDoNothing();
  }
  const districtRows = await db.select().from(districts);
  const categoryRows = await db.select().from(destinationCategories);
  for (const item of places) {
    const district = districtRows.find((d) => d.name === item.district);
    const category = categoryRows.find((c) => c.name === item.category);
    if (!district || !category) throw new Error(`Missing district/category for ${item.name}`);
    await db.insert(destinations).values({
      slug: item.slug, name: item.name, description: item.description, stateId: state.id, districtId: district.id, categoryId: category.id,
      latitude: item.latitude, longitude: item.longitude, imageUrl: item.image ? pexels(item.image) : item.imageUrl,
      imageCredit: item.credit, imageSourceUrl: item.image ? photoPage(item.image) : item.imageSourceUrl,
      sourceUrl: item.sourceUrl, sourceLabel: item.sourceLabel, bestTime: item.bestTime, visitorInfo: item.visitorInfo,
      safetyInfo: item.safetyInfo, status: "published", isHidden: item.hidden ?? false, featured: item.featured ?? false,
    }).onConflictDoNothing();
    const [destination] = await db.select().from(destinations).where(eq(destinations.slug, item.slug));
    if (item.hidden && destination) {
      const [existing] = await db.select({ id: hiddenPlaces.id }).from(hiddenPlaces).where(eq(hiddenPlaces.destinationId, destination.id)).limit(1);
      if (!existing) await db.insert(hiddenPlaces).values({ name: item.name, description: item.description, category: item.category, district: item.district,
        latitude: item.latitude, longitude: item.longitude, sourceUrl: item.sourceUrl, status: "approved", destinationId: destination.id });
    }
    if (destination && gallery[item.slug]) {
      const existing = await db.select({ id: destinationImages.id }).from(destinationImages).where(eq(destinationImages.destinationId, destination.id));
      if (!existing.length) await db.insert(destinationImages).values(gallery[item.slug].map((image) => ({
        destinationId: destination.id, url: pexels(image.photo), alt: `${item.name} photograph`, credit: image.credit, sourceUrl: photoPage(image.photo),
      })));
    }
  }
  console.log(`Seeded ${places.length} sourced destinations in ${districtNames.length} districts; no business listings or reviews were fabricated.`);
}

seed().then(() => pool.end()).catch(async (error) => { console.error(error); await pool.end(); process.exitCode = 1; });
