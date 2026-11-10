"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, ErrorNote, Section, Shell, Spinner } from "@/components/ui";

interface M { live: { users: number; plansShown: number; plansChosen: number; reasonChipAnswers: number; remixEdits: number; edits: { total: number; violation: number; discovery: number }; violationRate: number; discoveryRate: number; tiers: { tier: string; n: number }[]; types: { type: string; n: number }[] } }

export default function Metrics() {
  const [d, setD] = useState<M | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api("/api/metrics").then(setD).catch((e) => setErr(e.message)); }, []);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <Shell back="/profile" title="Metrics">
      <ErrorNote error={err} />
      {!d && !err && <Spinner />}
      {d && (
        <>
          <Section title="North star" sub="Defined for production; not measurable in a prototype">
            <Card className="mx-4 p-3 text-sm"><b>Incremental trips</b>: bookings from users with no travel search in the prior 30 days, from a TripGenie surface (nudge, For You, remix). Measured against a holdout group that sees the standard app.</Card>
          </Section>
          <Section title="Guardrails (live from this prototype's database)">
            <div className="grid grid-cols-2 gap-2 px-4">
              <Card className="p-3"><div className="text-2xl font-semibold text-bad">{pct(d.live.violationRate)}</div><div className="text-xs text-muted">Violation edit rate: user corrected a <b>known</b> dealbreaker ({d.live.edits.violation}/{d.live.edits.total} edits). Should trend to 0.</div></Card>
              <Card className="p-3"><div className="text-2xl font-semibold text-teal">{pct(d.live.discoveryRate)}</div><div className="text-xs text-muted">Discovery edit rate: edits that revealed a <b>new</b> preference ({d.live.edits.discovery}). High early, falls as profiles mature.</div></Card>
              <Card className="p-3"><div className="text-2xl font-semibold">{d.live.plansChosen}/{d.live.plansShown}</div><div className="text-xs text-muted">Plans chosen / shown</div></Card>
              <Card className="p-3"><div className="text-2xl font-semibold">{d.live.reasonChipAnswers}</div><div className="text-xs text-muted">Reason-chip answers (asked only when a choice is ambiguous)</div></Card>
            </div>
            <p className="mx-4 mt-2 text-xs text-muted">Production guardrail also: notification opt-out rate per month and season (A/B test of nudge cadence).</p>
          </Section>
          <Section title="Signals collected" sub="Stated > revealed > passive">
            <Card className="mx-4 p-3 text-sm">
              {d.live.tiers.map((t) => <div key={t.tier} className="flex justify-between"><span className="capitalize">{t.tier}</span><span>{t.n}</span></div>)}
              <hr className="my-2 border-line" />
              {d.live.types.map((t) => <div key={t.type} className="flex justify-between text-xs text-muted"><span>{t.type}</span><span>{t.n}</span></div>)}
            </Card>
          </Section>
        </>
      )}
    </Shell>
  );
}
