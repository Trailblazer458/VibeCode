"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Card, ErrorNote, GlowLink, PLAN_GRID, PlanCard, Section, Shell, Spinner, type PlanLite } from "@/components/ui";

interface Feed {
  needsOnboarding?: boolean;
  profile: { name: string; persona: string };
  window: { label: string; days: number; leaveDays: string[]; inDays: number };
  trigger: { key: string; title: string; body: string } | null;
  rows: { need: string; party: string; label: string; sub: string; plans: PlanLite[] }[];
  different: { label: string; plan: PlanLite | null; need: string; party: string };
  boosted: string[];
}

export default function FeedPage() {
  const router = useRouter();
  const [d, setD] = useState<Feed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Feed>("/api/feed").then((f) => (f.needsOnboarding ? router.push("/onboarding") : setD(f))).catch((e) => setErr(e.message));
  }, [router]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <Shell>
      <div className="px-4 pt-6">
        <p className="text-sm text-muted">{greet}{d ? `, ${d.profile.name}` : ""}</p>
        <h1 className="font-display text-3xl font-semibold leading-tight">Trips that fit you</h1>
        {d?.profile.persona && <p className="mt-0.5 text-xs text-muted">{d.profile.persona} · tuned from your choices, edits and trips</p>}
        <GlowLink href="/plan" className="mt-4">
          <span className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl">✎</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-teal">Plan with me</span>
              <span className="block text-xs text-muted">“Want to take my parents somewhere calm, 3 days, under 20k”</span>
            </span>
            <span className="text-teal transition group-hover:translate-x-0.5">→</span>
          </span>
        </GlowLink>
      </div>
      <ErrorNote error={err} />
      {!d && !err && <Spinner label="Scoring trip options for your top intents…" />}
      {d && (
        <>
          {d.trigger && (
            <div className="mx-4 mt-4 flex flex-col gap-3 rounded-2xl md:flex-row md:items-center border border-line border-l-4 border-l-teal bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl">
              <div className="min-w-0 md:flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal">Upcoming trip window</div>
                <div className="mt-0.5 text-base font-semibold leading-snug text-ink">{d.trigger.title}</div>
                <div className="mt-0.5 text-sm leading-snug text-ink/75">{d.trigger.body} Plans below are built for {d.window.label}.</div>
              </div>
              <div className="flex shrink-0 flex-row-reverse items-center justify-end gap-3 md:flex-row">
                <Link href="/nudges" className="text-xs font-semibold text-teal hover:underline">All windows</Link>
                <Link href={`/plan?trigger=${encodeURIComponent(d.trigger.key)}`} className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal/90">Plan a trip →</Link>
              </div>
            </div>
          )}
          {d.boosted.length > 0 && <p className="mx-4 mt-3 rounded-xl bg-teal-soft px-3 py-2 text-xs text-teal">↻ Re-ranked this session: you spent time on {d.boosted.join(", ")}.</p>}
          {d.rows.map((r) => (
            <Section key={r.label} title={r.label} sub={r.sub} action={<Link href={`/explore?need=${r.need}&party=${r.party}`} className="text-xs font-semibold text-teal">More →</Link>}>
              <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3">
                {r.plans.map((p) => <PlanCard key={p.id} p={p} />)}
                {r.plans.length === 0 && <Card className="w-full p-4 text-sm text-muted">No plan fits every filter for these dates. Try Explore with a different budget.</Card>}
              </div>
            </Section>
          ))}
          {d.different.plan && (
            <Section title="✶ Something different" sub={`Outside your usual top three: ${d.different.label}. This is how your profile grows.`}>
              <div className={PLAN_GRID}><PlanCard p={d.different.plan} wide /></div>
            </Section>
          )}
          <Section title="From friends & curated" sub="Remix a real trip; your edits teach the engine what you like">
            <Link href="/community" className="mx-4 block rounded-2xl border border-line bg-paper p-4 text-sm">
              Rohan&apos;s <b>Kasol 4-day backpack loop</b>, Neha&apos;s upcoming Mussoorie reset, and curated plans like <b>Varanasi with parents, done gently</b> →
            </Link>
          </Section>
          <div className="mx-4 mt-6 grid grid-cols-2 gap-2 text-sm">
            <Link href="/explore?tab=reel" className="rounded-2xl border border-line bg-paper p-3">📲 <b>Saw it on Instagram?</b><br /><span className="text-xs text-muted">Turn a Reel into a plan</span></Link>
            <Link href="/explore?tab=budget" className="rounded-2xl border border-line bg-paper p-3">💸 <b>₹15k, 3 days?</b><br /><span className="text-xs text-muted">Budget-first ideas</span></Link>
          </div>
        </>
      )}
    </Shell>
  );
}
