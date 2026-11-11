"use client";
// Shared review UI: the carousel, plain-language pros and heads-ups, and in-card testimonials.
// No imports from ./ui so plan cards (in ui.tsx) can use it without a circular import.
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { avatarUrl } from "@/lib/images";

const AUTO_MS = 4500;

/**
 * Horizontal snap carousel; works with swipe, trackpad and buttons. `compact` puts small controls under the slides.
 * Advances on its own every 4.5s, wrapping to the start. It holds still while hovered, focused or just touched,
 * while off-screen or in a hidden tab, and never moves for people who prefer reduced motion.
 */
export function Carousel<T>({ items, render, label, className = "", compact = false }: { items: T[]; render: (item: T, i: number) => ReactNode; label: string; className?: string; compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const hold = useRef(false);
  const lastTouch = useRef(0);
  const scrollTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, Math.min(items.length - 1, i)) * el.clientWidth, behavior: "smooth" });
  };
  // Controls may sit inside a link (plan cards): never let them navigate.
  const go = (e: MouseEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    lastTouch.current = Date.now();
    scrollTo(i);
  };

  useEffect(() => {
    if (items.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const el = root.current;
      if (!el || hold.current || document.hidden || Date.now() - lastTouch.current < AUTO_MS * 2) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      scrollTo((idxRef.current + 1) % items.length);
    }, AUTO_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);
  const dots = items.map((_, i) => (
    <button key={i} type="button" aria-label={`Go to ${i + 1}`} onClick={(e) => go(e, i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-teal" : "w-1.5 bg-ink/20"}`} />
  ));
  const overlay = "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/70 text-ink shadow-md backdrop-blur-md transition hover:bg-white disabled:opacity-0";
  const small = "flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white/70 text-xs text-ink transition hover:bg-white disabled:opacity-30";
  return (
    <div
      ref={root}
      className={`relative ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => (hold.current = true)}
      onMouseLeave={() => (hold.current = false)}
      onFocus={() => (hold.current = true)}
      onBlur={() => (hold.current = false)}
      onTouchStart={() => (lastTouch.current = Date.now())}
    >
      <div
        ref={track}
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth));
          idxRef.current = i;
          setIdx(i);
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {items.map((it, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-1" aria-label={`${i + 1} of ${items.length}`}>{render(it, i)}</div>
        ))}
      </div>
      {items.length > 1 && !compact && (
        <>
          <button type="button" aria-label="Previous" disabled={idx === 0} onClick={(e) => go(e, idx - 1)} className={`${overlay} left-2`}>←</button>
          <button type="button" aria-label="Next" disabled={idx >= items.length - 1} onClick={(e) => go(e, idx + 1)} className={`${overlay} right-2`}>→</button>
          <div className="mt-3 flex justify-center gap-1.5">{dots}</div>
        </>
      )}
      {items.length > 1 && compact && (
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <button type="button" aria-label="Previous" disabled={idx === 0} onClick={(e) => go(e, idx - 1)} className={small}>‹</button>
          <div className="flex items-center gap-1">{dots}</div>
          <button type="button" aria-label="Next" disabled={idx >= items.length - 1} onClick={(e) => go(e, idx + 1)} className={small}>›</button>
        </div>
      )}
    </div>
  );
}

// ---- Pros and heads-ups in plain language ---------------------------------------------------

const PRO: Record<string, string> = {
  value: "Great value for money", social: "Social, easy to meet people", quiet: "Quiet and peaceful", nightlife: "Good nightlife nearby",
  kid_friendly: "Good for kids", elder_friendly: "Easy for seniors", safety: "Safe area", veg_food: "Good veg food",
  romance: "Romantic setting", luxury: "Feels luxurious", adventure: "Close to adventure", culture: "Rich in culture & heritage",
  nature: "Close to nature", spiritual: "Spiritual atmosphere", crowd: "Lively and buzzing", wellness: "Good for wellness",
  food_adventure: "Great food finds", comfort: "Comfortable", convenience: "Convenient location", scenic: "Great views",
  work_friendly: "Good Wi-Fi & desk",
};

// [when the trip wants it but it's missing, when there's more of it than the trip wants]
const CON: Record<string, [string, string]> = {
  quiet: ["Can get noisy", "Very quiet, not much going on"],
  nightlife: ["Not much nightlife", "Lively nightlife, can get noisy"],
  kid_friendly: ["Not set up for kids", "Very family-oriented"],
  elder_friendly: ["Not easy for seniors", "Built for older guests"],
  safety: ["Area feels less safe at night", "Very quiet area"],
  veg_food: ["Few veg options", "Mostly veg food"],
  romance: ["Not very romantic", "Very couple-oriented"],
  luxury: ["Fairly basic", "Upscale, can feel formal"],
  value: ["Pricey for what you get", "Budget stay, few frills"],
  adventure: ["Little adventure nearby", "Adventure-heavy, not very restful"],
  culture: ["Not much culture or heritage", "Heritage-heavy"],
  nature: ["Not much nature around", "Remote, out in nature"],
  spiritual: ["Not much of a spiritual side", "Very religious atmosphere"],
  crowd: ["Not much buzz", "Gets crowded"],
  wellness: ["Little for wellness", "Wellness-focused"],
  food_adventure: ["Limited food choices", "Adventurous food scene"],
  comfort: ["Basic comforts", "Plush, may feel over the top"],
  convenience: ["A bit out of the way", "Right in the busy centre"],
  scenic: ["Not much of a view", "Views are the main draw"],
  social: ["Not very social", "Very social, less privacy"],
  work_friendly: ["Weak Wi-Fi, no desk", "Business-like"],
};

export interface Flag { aspect: string; key?: string; low?: boolean; snippet: string | null; sameParty: boolean }

export function proText(key: string | undefined, label: string) {
  return (key && PRO[key]) || label.charAt(0).toUpperCase() + label.slice(1);
}
export function conText(f: Flag) {
  const pair = f.key ? CON[f.key] : undefined;
  if (pair) return f.low === false ? pair[1] : pair[0];
  return `${f.aspect.charAt(0).toUpperCase() + f.aspect.slice(1)} is not great`;
}

/** Green pills for what's good, soft amber pills for heads-ups, and any dealbreaker it breaks. */
export function ProsCons({ good, goodKeys, flags, blocked }: { good: string[]; goodKeys?: string[]; flags?: Flag[]; blocked?: string[] }) {
  if (!good.length && !flags?.length && !blocked?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {good.map((g, i) => (
        <span key={g} className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok">✓ {proText(goodKeys?.[i], g)}</span>
      ))}
      {(flags ?? []).map((f) => (
        <span key={f.aspect} className="rounded-full bg-saffron-soft px-2.5 py-1 text-xs font-medium text-warn">{conText(f)}</span>
      ))}
      {(blocked ?? []).length > 0 && (
        <span className="rounded-full bg-saffron-soft px-2.5 py-1 text-xs font-medium text-warn">Avoided because: {blocked!.join(", ")}</span>
      )}
    </div>
  );
}

// ---- Testimonials inside a card ---------------------------------------------------------------

export interface Quote { text: string; label: string; sub?: string }

const TRAVELLED: Record<string, string> = {
  solo: "Travelled solo", couple: "Travelled as a couple", friends: "Travelled with friends",
  family_kids: "Travelled with kids", family_elders: "Travelled with parents",
};
export function travelledLabel(party: string | undefined | null) {
  return (party && TRAVELLED[party]) || "Verified guest";
}

/** Quotes for a ranked item: the review behind its strength first, then the ones behind its heads-ups. */
export function itemQuotes(it: { evidence: { snippet: string; sameParty: boolean } | null; flags?: Flag[] }, party: string): Quote[] {
  const who = (same: boolean) => (same ? travelledLabel(party) : "Verified guest");
  return [
    ...(it.evidence ? [{ text: it.evidence.snippet, label: who(it.evidence.sameParty) }] : []),
    ...(it.flags ?? []).filter((f) => f.snippet).map((f) => ({ text: f.snippet!, label: who(f.sameParty) })),
  ];
}

/** Review quotes at the bottom of a card: avatar beside the quote, big quote marks, who said it. */
export function MiniTestimonials({ quotes }: { quotes: Quote[] }) {
  const seen = new Set<string>();
  const list = quotes.filter((q) => q.text && !seen.has(q.text) && seen.add(q.text));
  if (!list.length) return null;
  return (
    <Carousel
      compact
      label="What travellers said"
      className="border-t border-line pt-2.5"
      items={list}
      render={(q) => (
        <figure className="flex gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl(q.text)} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full bg-teal-soft ring-2 ring-white" />
          <div className="min-w-0">
            <blockquote className="relative pl-4 text-sm leading-snug text-ink">
              <span aria-hidden className="absolute -top-1.5 left-0 font-display text-2xl leading-none text-saffron">“</span>
              {q.text}
            </blockquote>
            <figcaption className="mt-0.5 pl-4 text-[11px] text-muted">
              <span className="font-semibold text-ink/80">{q.label}</span>{q.sub ? ` · ${q.sub}` : ""}
            </figcaption>
          </div>
        </figure>
      )}
    />
  );
}
