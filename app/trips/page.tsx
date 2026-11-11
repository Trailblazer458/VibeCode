"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate, inr } from "@/lib/client";
import { destCover } from "@/lib/images";
import { intentTitle } from "@/lib/engine/weights";
import { Card, Cover, ErrorNote, NEED_META, Section, Shell, Spinner } from "@/components/ui";

interface PlanSummary { title: string; destId: string; destName: string; need: string; party: string; emoji: string; hue: number; window: { start: string; days: number; label?: string }; pax: { adults: number; kids: number; seniors: number }; cost: { perHead: number; total: number } }
interface D {
  groups: { id: string; name: string; status: string; need: string; members: number; destName: string | null }[];
  upcoming: { id: string; ref: string; plan: PlanSummary }[];
  chosen: { id: string; plan: PlanSummary }[];
}

export default function Trips() {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api("/api/trips").then(setD).catch((e) => setErr(e.message)); }, []);
  return (
    <Shell title="Trips">
      <ErrorNote error={err} />
      {!d && !err && <Spinner />}
      {d && (
        <>
          <Section title="Upcoming trips" sub="Booked and confirmed">
            <div className="grid gap-3 px-4 md:grid-cols-2">
              {d.upcoming.map((b) => {
                const p = b.plan;
                const people = p.pax.adults + p.pax.kids + p.pax.seniors;
                return (
                  <Link key={b.id} href={`/p/${b.id}`} className="block overflow-hidden rounded-2xl border border-line bg-paper shadow-sm transition hover:shadow-md">
                    <Cover hue={p.hue} emoji={p.emoji} photo={destCover(p.destId, p.need)} className="h-24 p-3">
                      <span className="glass-dark absolute top-2.5 right-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white">✓ Booked</span>
                      <div className="absolute bottom-2 left-3 text-white drop-shadow">
                        <div className="font-display text-lg font-semibold leading-tight">{p.destName}</div>
                        <div className="text-xs opacity-90">{NEED_META[p.need]?.emoji} {intentTitle(p.need, p.party)}</div>
                      </div>
                    </Cover>
                    <div className="space-y-1 px-3 py-2.5 text-xs">
                      <div className="font-semibold text-ink">{p.window.label ?? fmtDate(p.window.start)} · {p.window.days} days · {people} {people === 1 ? "traveller" : "travellers"}</div>
                      <div className="flex items-center justify-between text-muted">
                        <span>Ref <b className="font-mono tracking-wider text-ink">{b.ref}</b></span>
                        <span>{inr(p.cost.total)} total · {inr(p.cost.perHead)} pp</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {!d.upcoming.length && <Card className="p-4 text-sm text-muted">Nothing booked yet. Open a plan and tap “Book this trip”.</Card>}
            </div>
          </Section>
          <Section title="Plans you chose" sub="Choosing teaches the engine what you prefer over the alternatives">
            <div className="grid gap-2 px-4 md:grid-cols-2">
              {d.chosen.map((c) => (
                <Link key={c.id} href={`/p/${c.id}`} className="block overflow-hidden rounded-2xl border border-line bg-paper">
                  <Cover hue={c.plan.hue} emoji={c.plan.emoji} photo={destCover(c.plan.destId, c.plan.need)} className="h-14 px-3 py-2"><span className="font-display font-semibold text-white">{c.plan.title}</span></Cover>
                  <div className="px-3 py-2 text-xs text-muted">{c.plan.window.days} days · {inr(c.plan.cost.perHead)} pp · not booked yet</div>
                </Link>
              ))}
              {!d.chosen.length && <Card className="p-4 text-sm text-muted">Open any plan and tap “Choose this plan”.</Card>}
            </div>
          </Section>
          <Section title="Group trip rooms" sub="Everyone's profile counts; nobody's dealbreaker is broken">
            <div className="grid gap-2 px-4 md:grid-cols-2">
              {d.groups.map((g) => (
                <Link key={g.id} href={`/trips/${g.id}`}>
                  <Card className="flex items-center gap-3 p-3">
                    <span className="text-2xl">{NEED_META[g.need]?.emoji ?? "👥"}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-xs text-muted">{g.members} members · {g.status === "booked" ? `Confirmed: ${g.destName}` : "Planning: vote on dates and plans"}</div>
                    </div>
                    <span className="text-teal">→</span>
                  </Card>
                </Link>
              ))}
              {!d.groups.length && <Card className="p-4 text-sm text-muted">No group trips yet.</Card>}
            </div>
          </Section>
          <p className="mx-4 mt-6 text-xs text-muted">Past trips and “Retake” live in your profile.</p>
        </>
      )}
    </Shell>
  );
}
