"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Compass, MapPin, Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/auth-experience";

const navigation = [
  { label: "Explore", href: "/explore" }, { label: "Hidden gems", href: "/hidden-places" },
  { label: "Nearby", href: "/nearby?place=shanti-sagara" }, { label: "Services", href: "/services" },
  { label: "Map", href: "/map" }, { label: "Trip planner", href: "/planner" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="TripNearby home">
    <span className="brand-mark"><Compass size={23} strokeWidth={2.2} /></span>
    <span className="brand-word">trip<span>nearby</span><span className="brand-dot">.</span></span>
  </Link>;
}

export function Header({ user }: { user: { name: string; role: string } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <header className="site-header">
    <div className="header-inner container-wide">
      <Logo />
      <nav className="desktop-nav" aria-label="Main navigation">
        {navigation.map((item) => <Link key={item.label} href={item.href} className={`nav-link ${pathname === item.href.split("?")[0] ? "nav-active" : ""}`}>{item.label}</Link>)}
      </nav>
      <div className="header-actions">
        {user ? <><Link href="/profile" className="header-login">Hi, {user.name.split(" ")[0]}</Link><LogoutButton className="header-logout" label="Log out" /></> : <><Link href="/auth?mode=login" className="header-login">Log in</Link><Link href="/auth?mode=register" className="header-login header-register">Register</Link></>}
        <Link href="/route-planner" className="btn btn-primary header-cta">Plan a route <ArrowRight size={16} /></Link>
      </div>
      <button className="mobile-menu-button" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={24} /> : <Menu size={24} />}</button>
    </div>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation">
      {navigation.map((item) => <Link key={item.label} href={item.href} onClick={() => setOpen(false)}>{item.label}<ArrowRight size={17} /></Link>)}
      <Link href="/route-planner" onClick={() => setOpen(false)}>Plan a route<ArrowRight size={17} /></Link>
      <Link href={user ? "/profile" : "/auth?mode=login"} onClick={() => setOpen(false)}>{user ? "My account" : "Log in"}<ArrowRight size={17} /></Link>
      {!user && <Link href="/auth?mode=register" onClick={() => setOpen(false)}>Register<ArrowRight size={17} /></Link>}
      {user && <div className="mobile-logout"><LogoutButton className="btn btn-outline" label="Log out" /></div>}
      {user?.role === "admin" && <Link href="/admin" onClick={() => setOpen(false)}>Admin dashboard<ArrowRight size={17} /></Link>}
    </nav>}
  </header>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="container-wide footer-grid">
      <div className="footer-brand-col"><Logo light /><p>Every journey has more to discover. Find the places around the places, and make every detour count.</p><div className="footer-location"><MapPin size={15} /> Made for explorers in Karnataka, India</div></div>
      <div><h4>Discover</h4><Link href="/explore">Explore places</Link><Link href="/states">Browse districts</Link><Link href="/hidden-places">Hidden places</Link><Link href="/nearby?place=shanti-sagara">Nearby discovery</Link><Link href="/map">Interactive map</Link></div>
      <div><h4>Travel better</h4><Link href="/route-planner">Route planner</Link><Link href="/planner">Trip planner</Link><Link href="/services">Rentals & services</Link><Link href="/hotels">Stays</Link><Link href="/guides">Local guides</Link></div>
      <div><h4>TripNearby</h4><Link href="/about">About us</Link><Link href="/business-register">List your business</Link><Link href="/community">Community</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms & conditions</Link></div>
    </div>
    <div className="container-wide footer-bottom"><span>© {new Date().getFullYear()} TripNearby. Discover more. Travel nearby.</span><span>Information may change. Confirm details before travelling.</span></div>
  </footer>;
}
