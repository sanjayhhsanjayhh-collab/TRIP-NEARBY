import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, MapPin, Sparkles } from "lucide-react";
import type { CatalogPlace } from "@/lib/catalog";
import { verificationLabels } from "@/lib/labels";

export function PlaceCard({ place, size = "normal", distanceLabel }: { place: CatalogPlace; size?: "normal" | "large"; distanceLabel?: string }) {
  return <Link href={`/places/${place.slug}`} className={`place-card ${size === "large" ? "place-card-large" : ""}`}>
    <div className={`place-card-image ${!place.imageUrl ? "image-placeholder" : ""}`}>
      {place.imageUrl ? <img src={place.imageUrl} alt={place.name} loading="lazy" /> : <div className="placeholder-art"><Camera size={28} /><span>Photograph not yet available</span></div>}
      <span className="card-badge">{place.isHidden ? <><Sparkles size={12} /> Offbeat find</> : place.category}</span>
      <span className="card-arrow"><ArrowUpRight size={19} /></span>
    </div>
    <div className="place-card-body"><span className="place-card-location"><MapPin size={13} /> {place.district}, {place.state}{place.taluk ? ` · ${place.taluk}` : ""}</span><h3>{place.name}</h3><p>{place.description}</p>
      <div className="card-meta-row"><span className="verification-chip">{verificationLabels[place.verificationLevel] ?? "Unverified"}</span>{place.coordinatePrecision === "locality" && <span className="small muted">Town reference pin</span>}{distanceLabel && <span className="small muted">{distanceLabel}</span>}</div>
      <span className="text-link">Explore place <ArrowRight size={15} /></span>
    </div>
  </Link>;
}

export function SectionHeading({ kicker, title, description, href, linkText = "View all" }: { kicker?: string; title: string; description?: string; href?: string; linkText?: string }) {
  return <div className="section-heading"><div>{kicker && <p className="eyebrow">{kicker}</p>}<h2>{title}</h2>{description && <p className="section-description">{description}</p>}</div>{href && <Link className="section-all" href={href}>{linkText} <ArrowUpRight size={17} /></Link>}</div>;
}

export function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-intro"><div className="container-wide"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p>{children}</div></div>;
}

export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <div className="empty-state"><div className="empty-icon"><MapPin size={25} /></div><h3>{title}</h3><p>{description}</p>{href && <Link className="btn btn-primary" href={href}>{action ?? "Explore places"} <ArrowRight size={16} /></Link>}</div>;
}
