"use client";
import { useRef, useState, type ReactNode } from "react";
import { avatarUrl, itemImage, type ItemPhoto } from "@/lib/images";
import { Cover } from "./ui";

interface PlanForWhy {
  why: string[];
  destId: string; destName: string; emoji: string; hue: number;
  stay: { id: string; name: string; type: string };
  activities: { id: string; name: string }[];
}

interface Slide { key: string; name: string; reason: string; image: ItemPhoto | null; emoji: string; hue: number; kind: string }

const STAY_EMOJI: Record<string, string> = { camp: "🏕️", hostel: "🛏️", heritage: "🏰", homestay: "🏡", resort: "🌴", hotel: "🏨" };

/** Turns the engine's "Name: reason" lines into slides; other lines (like dwell notes) are skipped. */
function slidesFor(p: PlanForWhy): Slide[] {
  const out: Slide[] = [];
  for (const line of p.why) {
    const i = line.indexOf(": ");
    if (i < 0) continue;
    const name = line.slice(0, i);
    // Keep only the core reason: drop "which matters most for…" and "(… agree)" tails.
    let reason = line.slice(i + 2).split(", which matters")[0].split(" (")[0].trim();
    reason = reason.charAt(0).toUpperCase() + reason.slice(1);
    if (name === p.destName) {
      out.push({ key: p.destId, name, reason, image: itemImage(p.destId), emoji: p.emoji, hue: p.hue, kind: "Destination" });
    } else if (name === p.stay.name) {
      out.push({ key: p.stay.id, name, reason, image: itemImage(p.stay.id), emoji: STAY_EMOJI[p.stay.type] ?? "🏨", hue: (p.hue + 40) % 360, kind: "Stay" });
    } else {
      const a = p.activities.find((x) => x.name === name);
      out.push({ key: a?.id ?? name, name, reason, image: itemImage(a?.id), emoji: "✨", hue: (p.hue + 300) % 360, kind: "Activity" });
    }
  }
  return out;
}

/** Horizontal snap carousel with arrows and dots; works with swipe, trackpad and buttons. */
function Carousel<T>({ items, render, label, className = "" }: { items: T[]; render: (item: T, i: number) => ReactNode; label: string; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(items.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const arrow = "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/70 text-ink shadow-md backdrop-blur-md transition hover:bg-white disabled:opacity-0";
  return (
    <div className={`relative ${className}`} role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={track}
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {items.map((it, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-1" aria-label={`${i + 1} of ${items.length}`}>{render(it, i)}</div>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button type="button" aria-label="Previous" disabled={idx === 0} onClick={() => go(idx - 1)} className={`${arrow} left-2`}>←</button>
          <button type="button" aria-label="Next" disabled={idx >= items.length - 1} onClick={() => go(idx + 1)} className={`${arrow} right-2`}>→</button>
          <div className="mt-3 flex justify-center gap-1.5">
            {items.map((_, i) => (
              <button key={i} type="button" aria-label={`Go to ${i + 1}`} onClick={() => go(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-teal" : "w-1.5 bg-ink/20"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WhyCarousel({ plan }: { plan: PlanForWhy }) {
  const slides = slidesFor(plan);
  if (!slides.length) return null;
  return (
    <Carousel
      label="Why this fits you"
      items={slides}
      render={(s) => (
        <figure className="overflow-hidden rounded-2xl border border-line bg-paper">
          {s.image ? (
            <div className="relative aspect-[16/10] bg-teal-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image.src} alt={s.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <span className="glass-dark absolute bottom-3 left-3 rounded-full px-3 py-1 text-sm font-semibold text-white">{s.name}</span>
              <a
                href={s.image.source}
                target="_blank"
                rel="noreferrer"
                title={`${s.image.title} by ${s.image.artist}, ${s.image.license}, via Wikimedia Commons`}
                className="absolute top-2 right-2 max-w-[60%] truncate rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm hover:bg-black/55"
              >
                Photo: {s.image.artist} · {s.image.license}
              </a>
            </div>
          ) : (
            <Cover hue={s.hue} emoji={s.emoji} className="aspect-[16/10]">
              <span className="glass-dark absolute bottom-3 left-3 rounded-full px-3 py-1 text-sm font-semibold text-white">{s.name}</span>
            </Cover>
          )}
          <figcaption className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{s.kind}</p>
            <p className="font-display text-lg leading-snug">{s.reason}</p>
          </figcaption>
        </figure>
      )}
    />
  );
}

export interface Evidence { text: string; party: string; itemName: string }

const TRAVELLED: Record<string, string> = {
  solo: "Travelled solo", couple: "Travelled as a couple", friends: "Travelled with friends",
  family_kids: "Travelled with kids", family_elders: "Travelled with parents",
};
function reviewer(e: Evidence) {
  return TRAVELLED[e.party] ?? "Verified guest";
}

export function Testimonials({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  return (
    <Carousel
      label="What other travellers said"
      className="pb-1"
      items={evidence}
      render={(e) => (
        <div className="relative px-2 pt-2 pb-4">
          {/* Stacked cards behind the active one */}
          <div className="absolute inset-x-6 bottom-0 h-8 rounded-3xl bg-white/40 shadow-sm" />
          <div className="absolute inset-x-4 bottom-2 h-8 rounded-3xl bg-white/60 shadow-sm" />
          <figure className="relative rounded-3xl border border-white/80 bg-white/85 px-6 pt-6 pb-7 text-center shadow-lg backdrop-blur-xl md:px-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl(e.text)} alt="" className="mx-auto h-16 w-16 rounded-full bg-teal-soft object-cover ring-4 ring-white" />
            <figcaption className="mt-3">
              <div className="font-semibold">{reviewer(e)}</div>
              <div className="text-xs text-muted">on {e.itemName}</div>
            </figcaption>
            <blockquote className="relative mt-4 px-4">
              <span aria-hidden className="absolute -top-5 -left-1 font-display text-6xl leading-none text-saffron/70">“</span>
              <p className="text-base leading-relaxed text-ink md:text-lg">{e.text}</p>
              <span aria-hidden className="absolute -right-1 -bottom-9 font-display text-6xl leading-none text-saffron/70">”</span>
            </blockquote>
          </figure>
        </div>
      )}
    />
  );
}
