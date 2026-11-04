"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Search, Shapes } from "lucide-react";

export function SearchBox({ places, categories }: { places: { name: string; slug: string; district: string }[]; categories: { name: string; slug: string }[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [focused, setFocused] = useState(false);
  const normal = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
  const suggestions = query.trim().length >= 2 ? places.filter((place) => normal(place.name).includes(normal(query)) ||
    (place.slug === "shanti-sagara" && ["shantisagarakere", "sulekere", "shanthisagara"].some((alias) => alias.includes(normal(query)) || normal(query).includes(alias)))).slice(0, 5) : [];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const matching = suggestions.find((place) => normal(place.name) === normal(query) ||
      (place.slug === "shanti-sagara" && ["shantisagarakere", "sulekere", "shanthisagara"].includes(normal(query))));
    if (matching && !category) router.push(`/places/${matching.slug}`);
    else router.push(`/explore?${new URLSearchParams({ ...(query.trim() ? { search: query.trim() } : {}), ...(category ? { category } : {}) })}`);
    setFocused(false);
  };
  return <form onSubmit={submit} className="hero-search" role="search" autoComplete="off">
    <div className="hero-search-field search-combobox"><Search size={20} /><div><label htmlFor="hero-place-search">Where to?</label>
      <input id="hero-place-search" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} placeholder="Search a place or district" aria-autocomplete="list" />
      {focused && suggestions.length > 0 && <div className="search-suggestions" role="listbox">{suggestions.map((place) => <button key={place.slug} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => router.push(`/places/${place.slug}`)}><MapPin size={15} /><span><strong>{place.name}</strong><small>{place.district}, Karnataka</small></span><ArrowRight size={14} /></button>)}</div>}
    </div></div>
    <span className="hero-search-divider" />
    <div className="hero-search-field"><Shapes size={19} /><div><label htmlFor="hero-category">I&apos;m interested in</label><select id="hero-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All experiences</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div></div>
    <button type="submit" className="btn btn-primary">Explore places <ArrowRight size={16} /></button>
  </form>;
}
