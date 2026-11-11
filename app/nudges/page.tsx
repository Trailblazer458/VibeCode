"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, ErrorNote, Section, Shell, Spinner } from "@/components/ui";

const TYPE: Record<string, string> = { calendar: "📅 Calendar", personal: "💝 Personal date", social: "👥 Social", event: "🎉 Event", price: "💸 Price", behavioural: "↩ Behavioural", school: "🏫 School" };

export default function Nudges() {
  const [d, setD] = useState<{ cap: number; season: string; triggers: { key: string; type: string; title: string; body: string; strength: number; status: string; inDays: number }[]; longWeekends: { label: string; leaveDays: string[]; days: number; inDays: number }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api("/api/nudges").then(setD).catch((e) => setErr(e.message)); }, []);
  return (
    <Shell back="/profile" title="All upcoming trip windows">
      <ErrorNote error={err} />
      {!d && !err && <Spinner />}
      {d && (
        <>
          <Card className="mx-4 mt-4 p-3 text-sm">
            <b>Budget this month: {d.cap} nudges.</b> {d.season}. Rate halves if you ignore three in a row; only strong triggers are sent.
          </Card>
          <Section title="Ranked triggers" sub="Trigger decides when we speak; intent decides what we say">
            <div className="grid gap-2 px-4 md:grid-cols-2">
              {d.triggers.map((t) => (
                <Card key={t.key} className={`p-3 ${t.status === "send" ? "border-ok/40" : "opacity-75"}`}>
                  <div className="flex items-center justify-between text-[11px] text-muted"><span>{TYPE[t.type] ?? t.type}</span><span>strength {Math.round(t.strength * 100)}</span></div>
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="text-xs text-muted">{t.body}</div>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    {t.key.startsWith("inv-")
                      ? <Link href="/trips" className="text-xs font-semibold text-teal">Open trip room →</Link>
                      : <Link href={`/plan?trigger=${encodeURIComponent(t.key)}`} className="rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white">Plan a trip →</Link>}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
          <Section title="Upcoming long weekends" sub="With bridge-day suggestions">
            <div className="space-y-1 px-4 text-sm">
              {d.longWeekends.map((w) => <p key={w.label}>• {w.label} · {w.days} days{w.leaveDays.length ? ` · take ${w.leaveDays.length} leave` : ""} <span className="text-xs text-muted">(in {w.inDays} days)</span></p>)}
            </div>
          </Section>
        </>
      )}
    </Shell>
  );
}
