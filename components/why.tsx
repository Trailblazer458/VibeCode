"use client";
import { avatarUrl, itemImage, type ItemPhoto } from "@/lib/images";
import { Carousel, travelledLabel } from "./reviews";
import { Cover } from "./ui";

interface PlanForWhy {
  why: string[];
  destId: string; destName: string; emoji: string; hue: number;
  stay: { id: string; name: string; type: string };
  activities: { id: string; name: string }[];
}

interface Slide { key: string; name: string; reason: string; image: ItemPhoto | null; emoji: string; hue: number; kind: string }

const STAY_EMOJI: Record<string, string> = { camp: "🏕️", hostel: "🛏️", heritage: "🏰", homestay: "🏡", resort: "🌴", hotel: "🏨", ashram: "🕉️" };

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
              <div className="font-semibold">{travelledLabel(e.party)}</div>
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
