"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, inr } from "@/lib/client";
import { Card, Cover, ErrorNote, NEED_META, Section, Shell, Spinner } from "@/components/ui";

export default function Trips() {
  const [d, setD] = useState<{ groups: { id: string; name: string; status: string; need: string; members: number; destName: string | null }[]; chosen: { id: string; plan: { title: string; emoji: string; hue: number; window: { days: number }; cost: { perHead: number } } }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api("/api/trips").then(setD).catch((e) => setErr(e.message)); }, []);
  return (
    <Shell title="Trips">
      <ErrorNote error={err} />
      {!d && !err && <Spinner />}
      {d && (
        <>
          <Section title="Group trip rooms" sub="Everyone's profile counts; nobody's dealbreaker is broken">
            <div className="space-y-2 px-4">
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
          <Section title="Plans you chose" sub="Choosing teaches the engine what you prefer over the alternatives">
            <div className="space-y-2 px-4">
              {d.chosen.map((c) => (
                <Link key={c.id} href={`/p/${c.id}`} className="block overflow-hidden rounded-2xl border border-line bg-paper">
                  <Cover hue={c.plan.hue} emoji={c.plan.emoji} className="h-14 px-3 py-2"><span className="font-display font-semibold text-white">{c.plan.title}</span></Cover>
                  <div className="px-3 py-2 text-xs text-muted">{c.plan.window.days} days · {inr(c.plan.cost.perHead)} pp</div>
                </Link>
              ))}
              {!d.chosen.length && <Card className="p-4 text-sm text-muted">Open any plan and tap “Choose this plan”.</Card>}
            </div>
          </Section>
          <p className="mx-4 mt-6 text-xs text-muted">Past trips and “Retake” live in your profile.</p>
        </>
      )}
    </Shell>
  );
}
