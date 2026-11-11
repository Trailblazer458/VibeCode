"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { inr } from "@/lib/client";
import { destCover, type ItemPhoto } from "@/lib/images";
import { LikeSave, LikeToast } from "./likes";
import { MiniTestimonials, travelledLabel } from "./reviews";

/** "Kasol: strong on adventure, which matters most for a thrill trip with friends" -> "Strong on adventure". */
function shortWhy(line: string) {
  const i = line.indexOf(": ");
  const r = (i < 0 ? line : line.slice(i + 2)).split(", which matters")[0].split(" (")[0].trim();
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export const NEED_META: Record<string, { label: string; emoji: string }> = {
  rest: { label: "Rest", emoji: "🌿" }, reconnect: { label: "Reconnect", emoji: "🤝" }, explore: { label: "Explore", emoji: "🧭" },
  thrill: { label: "Thrill", emoji: "⚡" }, celebrate: { label: "Celebrate", emoji: "🥂" }, reflect: { label: "Reflect", emoji: "🪔" },
  indulge: { label: "Indulge", emoji: "💎" }, escape: { label: "Escape", emoji: "🌄" }, learn: { label: "Learn & create", emoji: "📷" },
};
export const PARTY_META: Record<string, { label: string; emoji: string }> = {
  solo: { label: "Solo", emoji: "🧍" }, couple: { label: "Couple", emoji: "💑" }, friends: { label: "Friends", emoji: "👯" },
  family_kids: { label: "Family + kids", emoji: "👨‍👩‍👧" }, family_elders: { label: "With parents", emoji: "👵" },
};
const MODE_EMOJI: Record<string, string> = { flight: "✈️", train: "🚆", bus: "🚌", self_drive: "🚗" };

/** Centred content column. From the md breakpoint up, pages also sit right of the 15rem (w-60) sidebar. */
export const CONTENT = "mx-auto w-full max-w-6xl";
/** Plan cards: stacked on phones, a grid on wider screens. */
export const PLAN_GRID = "grid gap-3 px-4 md:grid-cols-2 xl:grid-cols-3";

export function Shell({ children, title, back, right }: { children: ReactNode; title?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:pl-60">
      {(title || back) && (
        <header className="sticky top-0 z-20 border-b border-line bg-sand/95 backdrop-blur">
          <div className={`${CONTENT} flex items-center gap-2 px-4 py-3 md:px-8`}>
            {back && (
              <Link href={back} className="-ml-1 rounded-full px-2 py-1 text-lg text-teal" aria-label="Back">←</Link>
            )}
            <div className="min-w-0 flex-1 truncate font-display text-lg font-semibold md:text-xl">{title}</div>
            {right}
          </div>
        </header>
      )}
      <main className={`${CONTENT} flex-1 pb-24 md:px-4 md:pb-12`}>{children}</main>
      <Nav />
      <LikeToast />
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/feed", label: "For You", icon: "✦" },
  { href: "/explore", label: "Explore", icon: "⌕" },
  { href: "/plan", label: "Plan with me", icon: "✎" },
  { href: "/trips", label: "Trips", icon: "◎" },
  { href: "/profile", label: "You", icon: "◉" },
];

function Nav() {
  const path = usePathname();
  const isOn = (href: string) => path === href || (href !== "/feed" && path.startsWith(href));
  return (
    <>
      {/* Phone: bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${isOn(i.href) ? "text-teal font-semibold" : "text-muted"}`}>
                <span className="text-base leading-none">{i.icon}</span>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Tablet and desktop: left sidebar */}
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-paper px-4 py-6 md:flex">
        <Link href="/" className="px-3 font-display text-2xl font-semibold text-teal">TripGenie</Link>
        <ul className="mt-8 space-y-1">
          {NAV_ITEMS.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isOn(i.href) ? "bg-teal-soft font-semibold text-teal" : "text-ink hover:bg-sand"}`}>
                <span className="w-5 text-center text-base leading-none">{i.icon}</span>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-auto px-3 text-[11px] leading-snug text-muted">Prototype · trips from Delhi NCR · synthetic catalog and reviews</p>
      </nav>
    </>
  );
}

/**
 * A link card whose border glows where the pointer is (a spotlight that follows the cursor), with a faint glow inside.
 * At rest, and on touch screens, the border keeps a soft teal-to-saffron tint so it still stands out. Same size as a
 * normal card: the glow is a 1.5px gradient border, not extra padding.
 */
export function GlowLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--gx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };
  return (
    <Link href={href} onMouseMove={onMove} className={`glow-link group relative block rounded-2xl p-[1.5px] ${className}`}>
      <span aria-hidden className="glow-link-ring pointer-events-none absolute inset-0 rounded-2xl" />
      <span className="relative block overflow-hidden rounded-[15px] bg-paper">
        <span aria-hidden className="glow-link-inner pointer-events-none absolute inset-0" />
        <span className="relative block">{children}</span>
      </span>
    </Link>
  );
}

export function Chip({ on, children, onClick, tone = "teal", small }: { on?: boolean; children: ReactNode; onClick?: () => void; tone?: "teal" | "saffron"; small?: boolean }) {
  const onCls = tone === "teal" ? "bg-teal text-white border-teal" : "bg-saffron text-white border-saffron";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} transition ${on ? onCls : "border-line bg-paper text-ink hover:border-teal"}`}
    >
      {children}
    </button>
  );
}

export function Button({ children, onClick, kind = "primary", disabled, className = "", type = "button" }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "accent" | "danger"; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const k = {
    primary: "bg-teal text-white hover:bg-[#0b4a47]",
    accent: "bg-saffron text-white hover:bg-[#c97321]",
    ghost: "border border-line bg-paper text-ink hover:border-teal",
    danger: "border border-bad/40 bg-paper text-bad",
  }[kind];
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${k} ${className}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-paper ${className}`}>{children}</div>;
}

export function Section({ title, sub, children, action }: { title: ReactNode; sub?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-end justify-between gap-2 px-4">
        <div>
          <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Colour cover with the destination emoji, or a photo darkened at the edges so white text on it stays readable. */
export function Cover({ hue, emoji, photo, children, className = "" }: { hue: number; emoji: string; photo?: ItemPhoto | null; children?: ReactNode; className?: string }) {
  const style: Record<string, string | number> = { ["--h"]: hue };
  if (photo) {
    style.backgroundImage = `linear-gradient(180deg, rgb(0 0 0 / 0.28) 0%, rgb(0 0 0 / 0.05) 38%, rgb(0 0 0 / 0.62) 100%), url("${photo.src}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  return (
    <div
      className={`cover relative overflow-hidden ${className}`}
      style={style}
      role={photo ? "img" : undefined}
      aria-label={photo ? `${photo.title}, photo by ${photo.artist} (${photo.license})` : undefined}
      title={photo ? `Photo: ${photo.artist}, ${photo.license}, via Wikimedia Commons` : undefined}
    >
      {!photo && <span className="pointer-events-none absolute -right-2 -bottom-4 text-[84px] opacity-30 select-none">{emoji}</span>}
      {children}
    </div>
  );
}

export function FitBadge({ fit }: { fit: number }) {
  const c = fit >= 75 ? "bg-ok" : fit >= 55 ? "bg-teal" : fit >= 40 ? "bg-warn" : "bg-bad";
  return <span className={`rounded-full ${c} px-2 py-0.5 text-[11px] font-bold text-white`}>{fit}% fit</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      {label ?? "Loading"}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mx-4 my-3 rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>;
}

export interface PlanLite {
  id: string; signature?: string; title: string; destId?: string; destName: string; emoji: string; hue: number; fit: number; need: string; party: string;
  window: { start: string; days: number; label?: string };
  cost: { perHead: number; total: number; transport: number; stay: number; food: number; activities: number; local: number };
  transport: { name: string; mode: string; hours: number }; stay: { name: string; type: string };
  why: string[]; readiness: { key: string; label: string; status: string; detail: string }[]; exploration?: boolean;
  evidence: { text: string; party: string; itemName: string }[]; attrs: Record<string, number | string>;
}

export function PlanCard({ p, wide, extra }: { p: PlanLite; wide?: boolean; extra?: ReactNode }) {
  return (
    <Link href={`/p/${p.id}`} className={`rise flex shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-sm transition hover:shadow-md ${wide ? "w-full" : "w-[78%] sm:w-80 md:w-full"}`}>
      <Cover hue={p.hue} emoji={p.emoji} photo={destCover(p.destId, p.need)} className="h-28 p-3">
        <div className="flex items-start justify-between">
          <FitBadge fit={p.fit} />
          {p.exploration && <span className="glass-dark rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">Something new for you</span>}
        </div>
        <div className="absolute bottom-2 left-3 text-white drop-shadow">
          <div className="font-display text-xl font-semibold leading-tight">{p.destName}</div>
          <div className="text-xs opacity-90">{NEED_META[p.need]?.emoji} {NEED_META[p.need]?.label} · {PARTY_META[p.party]?.label}</div>
        </div>
        <div className="absolute right-3 bottom-2"><LikeSave planId={p.id} signature={p.signature} /></div>
      </Cover>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="font-semibold text-ink">{inr(p.cost.perHead)} pp</span>
          <span>{p.window.days} days</span>
          <span>{MODE_EMOJI[p.transport.mode]} {p.transport.hours}h</span>
          <span className="truncate">🏨 {p.stay.name}</span>
        </div>
        {p.why[0] && <p className="line-clamp-2 text-sm leading-snug">{shortWhy(p.why[0])}</p>}
        {extra}
        {p.evidence.length > 0 && (
          <div className="mt-auto">
            <MiniTestimonials quotes={p.evidence.map((e) => ({ text: e.text, label: travelledLabel(e.party), sub: e.itemName }))} />
          </div>
        )}
      </div>
    </Link>
  );
}

export interface Criterion { key: string; label: string; kind: "hard" | "soft"; source: string; hidden: number; enabled: boolean; constraintId?: string; ownerIsYou?: boolean }

export function CriteriaBar({ criteria, onToggle, assumed, title = "Criteria considered" }: { criteria: Criterion[]; onToggle?: (key: string) => void; assumed?: string[]; title?: string }) {
  if (!criteria?.length) return null;
  const SRC: Record<string, string> = { you: "you", group: "group", assumed: "assumed", intent: "trip type", trip: "dates" };
  return (
    <div className="mx-4 rounded-2xl border border-line bg-paper p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
        <span className="text-[11px] text-muted">Tap to add or remove filters</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {criteria.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onToggle?.(c.key)}
            className={`rounded-lg border px-2 py-1 text-left text-xs ${c.enabled ? "border-teal/30 bg-teal-soft text-ink" : "border-dashed border-line bg-sand text-muted line-through"}`}
            title={c.kind === "hard" ? "Hard filter" : "Soft preference"}
          >
            <span className="font-medium">{c.label}</span>
            <span className="ml-1 text-[10px] text-muted">· {SRC[c.source] ?? c.source}{c.kind === "soft" ? " · soft" : ""}</span>
            {c.enabled && c.hidden > 0 && <span className="ml-1 rounded bg-saffron-soft px-1 text-[10px] font-semibold text-warn">hides {c.hidden}</span>}
          </button>
        ))}
      </div>
      {assumed && assumed.length > 0 && (
        <p className="mt-2 text-[11px] text-warn">Assumed from your profile: {assumed.join(" · ")}. Change it in chat or the chips above.</p>
      )}
    </div>
  );
}

export function StatusDot({ s }: { s: string }) {
  return <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${s === "ok" ? "bg-ok" : s === "warn" ? "bg-warn" : "bg-bad"}`} />;
}

export function IntentPicker({ need, party, onChange, needs }: { need: string; party: string; onChange: (n: string, p: string) => void; needs?: string[] }) {
  return (
    <div className="space-y-2">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
        {(needs ?? Object.keys(NEED_META)).map((n) => (
          <Chip key={n} small on={n === need} onClick={() => onChange(n, party)}>{NEED_META[n].emoji} {NEED_META[n].label}</Chip>
        ))}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
        {Object.keys(PARTY_META).map((p) => (
          <Chip key={p} small tone="saffron" on={p === party} onClick={() => onChange(need, p)}>{PARTY_META[p].emoji} {PARTY_META[p].label}</Chip>
        ))}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div className="rise glass max-h-[85dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border border-white/70 bg-white/80 p-4 pb-8 md:max-w-xl md:rounded-3xl md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden" />
        {title && <h3 className="mb-3 font-display text-lg font-semibold">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
