"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { api, fmtDate, inr } from "@/lib/client";
import { Card, Cover, ErrorNote, NEED_META, PARTY_META, Shell, Spinner } from "@/components/ui";
import { destCover } from "@/lib/images";

interface Line { id: string; name: string; price: number }
interface BookPlan {
  id: string; destId: string; destName: string; need: string; party: string; hue: number; emoji: string; rooms: string;
  window: { start: string; days: number; label?: string };
  pax: { adults: number; kids: number; seniors: number };
  transport: Line & { mode: string; hours: number };
  stay: Line & { type: string; area: string };
  activities: (Line & { day: number })[];
  food: Line[];
  cost: { perHead: number; total: number; transport: number; stay: number; food: number; activities: number; local: number };
}

/** Lightweight canvas confetti: no library, respects reduced motion, cleans itself up. */
function burst(canvas: HTMLCanvasElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const W = (canvas.width = window.innerWidth * dpr);
  const H = (canvas.height = window.innerHeight * dpr);
  const colors = ["#0f766e", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#22c55e", "#f472b6"];
  const pieces = Array.from({ length: 180 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? 0 : W, y: H * 0.7,
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 10) * dpr,
      vy: -(12 + Math.random() * 14) * dpr,
      w: (6 + Math.random() * 6) * dpr, h: (3 + Math.random() * 4) * dpr,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[i % colors.length],
    };
  });
  const start = performance.now();
  const frame = (t: number) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vy += 0.35 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (t - start < 4000) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
}

export default function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [p, setP] = useState<BookPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const confetti = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    api(`/api/plan/${id}`).then((d) => setP(d.plan)).catch((e) => setErr(e.message));
  }, [id]);

  const book = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api(`/api/plan/${id}`, { action: "book", travellers: p ? p.pax.adults + p.pax.kids + p.pax.seniors : null });
      setRef(r.ref);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (confetti.current) burst(confetti.current);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  if (!p) return <Shell back={`/p/${id}`} title="Checkout">{err ? <ErrorNote error={err} /> : <Spinner label="Loading your trip…" />}</Shell>;

  const travellers = p.pax.adults + p.pax.kids + p.pax.seniors;
  const nights = Math.max(1, p.window.days - 1);
  const when = p.window.label ?? fmtDate(p.window.start);
  const cover = destCover(p.destId, p.need);
  const lines: [string, string, number][] = [
    ["Getting there and back", `${p.transport.name} · return`, p.cost.transport],
    ["Stay", `${p.stay.name} · ${nights} ${nights === 1 ? "night" : "nights"} · ${p.rooms}`, p.cost.stay],
    ["Activities", p.activities.map((a) => a.name).join(", ") || "None", p.cost.activities],
    ["Food", p.food.map((f) => f.name).join(", "), p.cost.food],
    ["Local travel", "Cabs and autos at the destination", p.cost.local],
  ];

  return (
    <Shell back={ref ? undefined : `/p/${id}`} title={ref ? "Booked" : "Checkout"}>
      <canvas ref={confetti} className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden />

      {ref ? (
        <div className="rise mx-auto max-w-xl px-4 py-8 text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="mt-3 font-display text-3xl font-semibold">You&apos;re going to {p.destName}!</h1>
          <p className="mt-2 text-sm text-muted">{when} · {p.window.days} days · {travellers} {travellers === 1 ? "traveller" : "travellers"}</p>
          <Card className="mt-6 p-4 text-left text-sm">
            <div className="flex items-center justify-between"><span className="text-muted">Booking reference</span><b className="font-mono tracking-wider">{ref}</b></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-muted">Trip total</span><b>{inr(p.cost.total)}</b></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-muted">Stay</span><span className="truncate pl-4">{p.stay.name}</span></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-muted">Travel</span><span className="truncate pl-4">{p.transport.name}</span></div>
          </Card>
          <p className="mt-4 text-xs text-muted">Prototype: no payment was taken. In the live product, tickets and vouchers for every item arrive here and by email.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link href={`/p/${id}`} className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-teal">View trip plan</Link>
            <Link href="/feed" className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white">Back to For You</Link>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 md:py-6">
          <Cover hue={p.hue} emoji={p.emoji} photo={cover} className="rounded-3xl px-5 py-6 text-white">
            <p className="text-xs opacity-90">{when} · {p.window.days} days · {travellers} {travellers === 1 ? "traveller" : "travellers"}</p>
            <h1 className="font-display text-3xl font-semibold">{p.destName}</h1>
            <p className="text-sm opacity-95">{NEED_META[p.need]?.emoji} {NEED_META[p.need]?.label} · {PARTY_META[p.party]?.label}</p>
          </Cover>

          <Card className="divide-y divide-line">
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">What you&apos;re booking</div>
            {lines.map(([k, detail, v]) => (
              <div key={k} className="flex items-start gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{k}</div>
                  <div className="text-xs text-muted">{detail}</div>
                </div>
                <div className="shrink-0 font-semibold">{inr(v)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3"><span className="font-semibold">Total ({travellers} {travellers === 1 ? "traveller" : "travellers"})</span><span className="font-display text-xl font-semibold">{inr(p.cost.total)}</span></div>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm text-muted"><span>Per person</span><span>{inr(p.cost.perHead)}</span></div>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Lead traveller</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-line bg-sand px-3 py-2.5 text-sm outline-teal" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" inputMode="tel" className="w-full rounded-xl border border-line bg-sand px-3 py-2.5 text-sm outline-teal" />
            <p className="text-xs text-muted">Prototype: no payment is taken and nothing is sent to a booking partner.</p>
          </Card>

          <ErrorNote error={err} />
          <button
            onClick={book}
            disabled={busy || !name.trim()}
            className="w-full rounded-2xl bg-saffron px-5 py-3.5 text-base font-semibold text-white shadow-md transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Booking…" : `Confirm and book · ${inr(p.cost.total)}`}
          </button>
          {!name.trim() && <p className="-mt-2 text-center text-xs text-muted">Add the lead traveller&apos;s name to continue.</p>}
          <div className="h-24 md:h-4" />
        </div>
      )}
    </Shell>
  );
}
