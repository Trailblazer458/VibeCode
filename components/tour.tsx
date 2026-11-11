"use client";
// First-run guided tour of For You, Explore and Plan with me. It starts when onboarding hands over to /feed?tour=1 and
// can be replayed from the You tab. Each step spotlights an element marked data-tour="…" and explains it; Next moves on,
// across pages where needed. Progress lives in this browser only (a convenience, so storage failures just end the tour).
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface Step { path: string; target?: string; title: string; body: string; optional?: boolean }

const STEPS: Step[] = [
  { path: "/feed", title: "Welcome to TripGenie 👋", body: "A quick tour of the three tabs you'll use most: For You, Explore and Plan with me. It takes under a minute, and you can skip any time." },
  { path: "/feed", target: "nav-feed", title: "For You", body: "Your home. Trips here are picked for the reasons you travel, and re-ranked as you like, save and choose plans." },
  { path: "/feed", target: "plan-with-me", title: "Plan with me", body: "Something specific in mind? Tell the assistant your mood, who's coming and for how long, and it builds plans around that." },
  { path: "/feed", target: "trip-window", optional: true, title: "Upcoming trip windows", body: "Long weekends and dates that matter to you. Tap Plan a trip to start from one, or All windows to see the rest." },
  { path: "/feed", target: "feed-row", optional: true, title: "Your kinds of trips", body: "Each row is one kind of trip you take. Tap a card for the full plan: why it fits, the stay, travel, activities and food, a Swap on every item, and the true cost. ♡ and 🔖 teach TripGenie what you like." },
  { path: "/explore", target: "nav-explore", title: "Explore", body: "For when you'd rather look around yourself. Everything you see is still ranked for who's going and why." },
  { path: "/explore", target: "explore-tabs", title: "Three ways in", body: "Where: you already know the place. By intent: start from the kind of trip. By budget: see what a set amount gets you." },
  { path: "/explore", target: "explore-dests", optional: true, title: "Pick a place", body: "Choose a destination to see its stays ranked for your group, then tap Plan the whole trip here for complete plans." },
  { path: "/plan", target: "nav-plan", title: "Plan with me", body: "A conversation instead of filters. It asks, you answer: nothing is decided for you." },
  { path: "/plan", target: "plan-slots", title: "What I've understood", body: "These fill in as you chat. Orange ones are still needed; the rest are optional, and the budget stays flexible unless you name one." },
  { path: "/plan", target: "plan-bar", title: "Say it your way", body: "Type how you feel and what you need, or tap a suggestion. When you're ready, tap Create trip plan." },
  { path: "/plan", title: "You're all set 🎉", body: "That's the tour. You can replay it any time from the You tab." },
];

const PAGE: Record<string, string> = { "/feed": "For You", "/explore": "Explore", "/plan": "Plan with me" };

const KEY = "tg_tour_v1";
const read = (): number | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v && /^\d+$/.test(v) ? Number(v) : null;
  } catch {
    return null;
  }
};
const write = (v: number | "done") => {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {}
};

/** Start (or restart) the tour from the first step. */
export function startTour() {
  write(0);
}

/** The visible element for a tour target (the phone and desktop navs both carry the same marker). */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function Tour() {
  const path = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const dir = useRef(1);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);

  // Pick up the tour on every page change; onboarding hands over with ?tour=1.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("tour") === "1") {
      write(0);
      q.delete("tour");
      window.history.replaceState(null, "", window.location.pathname + (q.toString() ? `?${q}` : ""));
    }
    setStep(read());
  }, [path]);

  const cur = step !== null ? STEPS[step] : null;
  const here = !!cur && cur.path === path;

  const go = useCallback(
    (n: number) => {
      if (n < 0) return;
      if (n >= STEPS.length) {
        write("done");
        setStep(null);
        return;
      }
      dir.current = n >= (step ?? 0) ? 1 : -1;
      write(n);
      setStep(n);
      setRect(null);
      if (STEPS[n].path !== path) router.push(STEPS[n].path);
    },
    [path, router, step],
  );
  const end = useCallback(() => {
    write("done");
    setStep(null);
  }, []);

  // Find the step's element (pages load data, so keep looking briefly), bring it into view, then follow it.
  useEffect(() => {
    if (!cur || !here) return;
    if (!cur.target) {
      setRect(null);
      setSearching(false);
      return;
    }
    let el: HTMLElement | null = null;
    let raf = 0;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    setSearching(true);
    const follow = () => {
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      }
      raf = requestAnimationFrame(follow);
    };
    const look = () => {
      el = findTarget(cur.target!);
      if (el) {
        setSearching(false);
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        follow();
      } else if (tries++ < 30) {
        timer = setTimeout(look, 150);
      } else {
        setSearching(false);
        // An optional step whose element isn't on this page (no trip window right now): skip it.
        if (cur.optional) go((step ?? 0) + dir.current);
        else setRect(null);
      }
    };
    look();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [cur, here, step, go]);

  // Measure the card so it can sit above the target when there is no room below.
  useEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [step, rect, here]);
  useEffect(() => {
    if (!here) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
      if (e.key === "ArrowRight") go((step ?? 0) + 1);
      if (e.key === "ArrowLeft") go((step ?? 0) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [here, step, go, end]);

  if (step === null || !cur) return null;

  // Wandered off mid-tour: a small pill to pick it back up.
  if (!here)
    return (
      <div className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/90 py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg md:bottom-6">
        <span>Tour paused</span>
        <button className="rounded-full bg-white px-3 py-1 font-semibold text-ink" onClick={() => router.push(cur.path)}>Resume</button>
        <button className="px-2 text-white/70" onClick={end} aria-label="End tour">✕</button>
      </div>
    );
  if (searching && !rect) return <div className="fixed inset-0 z-[60] bg-ink/40" />;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const W = Math.min(360, vw - 32);
  const pad = 6;
  let pos: React.CSSProperties;
  if (rect) {
    const left = Math.max(16, Math.min(vw - W - 16, rect.left + rect.width / 2 - W / 2));
    const below = rect.top + rect.height + pad + 12;
    const fitsBelow = below + cardH < vh - 8;
    const above = rect.top - pad - 12 - cardH;
    const top = fitsBelow ? below : above >= 8 ? above : Math.max(8, vh - cardH - 8);
    pos = { left, top, width: W };
  } else {
    pos = { left: (vw - W) / 2, top: Math.max(16, (vh - cardH) / 2), width: W };
  }
  const n = STEPS.length;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={cur.title}>
      {/* Click shield: the page stays still while the tour talks. */}
      <div className={`absolute inset-0 ${rect ? "" : "bg-ink/55"}`} />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-saffron transition-all duration-300"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgb(20 30 30 / 0.55)" }}
        />
      )}
      <div ref={card} className="rise absolute rounded-2xl border border-white/40 bg-white p-4 shadow-2xl transition-[top,left] duration-300" style={pos}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-saffron">{step + 1} of {n}</div>
        <h3 className="mt-0.5 font-display text-lg font-semibold leading-tight text-ink">{cur.title}</h3>
        <p className="mt-1.5 text-sm leading-snug text-ink/80">{cur.body}</p>
        <div className="mt-4 flex items-center gap-2">
          {step < n - 1 && <button className="text-xs text-muted hover:text-ink" onClick={end}>Skip tour</button>}
          <div className="flex-1" />
          {step > 0 && <button className="rounded-xl px-3 py-2 text-sm font-semibold text-teal hover:bg-teal-soft" onClick={() => go(step - 1)}>Back</button>}
          <button className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal/90" onClick={() => go(step + 1)}>
            {step === 0 ? "Show me →" : step === n - 1 ? "Start planning" : STEPS[step + 1].path !== cur.path ? `Next: ${PAGE[STEPS[step + 1].path]} →` : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
