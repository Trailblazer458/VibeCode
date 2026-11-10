"use client";
import { useEffect, useState } from "react";
import { api, inr } from "@/lib/client";
import { Button, Card, Chip, Cover, CriteriaBar, ErrorNote, FitBadge, IntentPicker, PARTY_META, PlanCard, Section, Shell, Spinner, type Criterion, type PlanLite } from "@/components/ui";

const DESTS = [
  ["rishikesh", "Rishikesh", "🛶", 175], ["jaipur", "Jaipur", "🏰", 25], ["udaipur", "Udaipur", "🌅", 40], ["mussoorie", "Mussoorie", "🌲", 140],
  ["varanasi", "Varanasi", "🪔", 30], ["manali", "Manali", "🏔️", 205], ["corbett", "Jim Corbett", "🐅", 95], ["amritsar", "Amritsar", "🛕", 50],
  ["kasol", "Kasol", "🏕️", 115], ["agra", "Agra", "🕌", 15], ["nainital", "Nainital", "🚣", 195], ["goa", "North Goa", "🏖️", 190],
] as const;
type Tab = "where" | "intent" | "budget" | "reel";
interface Alt { id: string; name: string; price: number; fit: number; good: string[]; flag: { aspect: string; snippet: string | null; sameParty: boolean } | null; flags?: { aspect: string; snippet: string | null; sameParty: boolean }[]; evidence: { snippet: string; sameParty: boolean } | null; blocked: string[] }
interface Res { plans: PlanLite[]; criteria: Criterion[]; nPlans: number; uncertainty: number }

export default function Explore() {
  const [tab, setTab] = useState<Tab>("where");
  const [need, setNeed] = useState("explore");
  const [party, setParty] = useState("friends");
  const [dest, setDest] = useState<string | null>(null);
  const [rank, setRank] = useState<Record<string, Alt[]> | null>(null);
  const [res, setRes] = useState<Res | null>(null);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [budget, setBudget] = useState(15000);
  const [days, setDays] = useState(3);
  const [url, setUrl] = useState("");
  const [reel, setReel] = useState<{ detected: { caption: string; detected: string[]; vibe: string } } & Res | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get("tab")) setTab(sp.get("tab") as Tab);
    if (sp.get("need")) { setNeed(sp.get("need")!); setTab("intent"); }
    if (sp.get("party")) setParty(sp.get("party")!);
    if (sp.get("dest")) setDest(sp.get("dest"));
  }, []);

  useEffect(() => {
    if (tab !== "where" || !dest) return;
    setRank(null);
    api(`/api/rank?dest=${dest}&need=${need}&party=${party}`).then(setRank).catch((e) => setErr(e.message));
  }, [tab, dest, need, party]);

  const plans = async (body: Record<string, unknown>, dis = disabled) => {
    setBusy(true);
    setErr(null);
    try {
      setRes(await api("/api/plans", { ...body, disabled: dis }));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const intentBody = () => ({ need, party, budgetPP: budget, days, context: "intent" });
  useEffect(() => {
    setRes(null);
    if (tab === "intent") plans(intentBody());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, need, party, budget, days]);

  const toggle = (k: string, body: Record<string, unknown>) => {
    const d = disabled.includes(k) ? disabled.filter((x) => x !== k) : [...disabled, k];
    setDisabled(d);
    plans(body, d);
  };
  const runReel = async (u: string) => {
    setBusy(true);
    setErr(null);
    try {
      setReel(await api("/api/import", { url: u }));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Shell title="Explore">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pt-3">
        {([["where", "📍 I know where"], ["intent", "✦ By intent"], ["budget", "💸 Budget-first"], ["reel", "📲 From a Reel"]] as const).map(([k, l]) => (
          <Chip key={k} on={tab === k} onClick={() => { setTab(k); setRes(null); setDisabled([]); }}>{l}</Chip>
        ))}
      </div>
      <ErrorNote error={err} />

      {tab === "where" && (
        <>
          {!dest && (
            <Section title="Where are you going?" sub="The destination is fixed; we still plan the stay, transport, pace and checks around your intent">
              <div className="grid grid-cols-3 gap-2 px-4">
                {DESTS.map(([id, name, emoji, hue]) => (
                  <button key={id} onClick={() => setDest(id)} className="overflow-hidden rounded-xl text-left">
                    <Cover hue={hue} emoji={emoji} className="h-20 p-2"><span className="absolute bottom-1.5 left-2 text-sm font-semibold text-white drop-shadow">{name}</span></Cover>
                  </button>
                ))}
              </div>
            </Section>
          )}
          {dest && (
            <>
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="font-display text-2xl font-semibold">{DESTS.find((d) => d[0] === dest)?.[1]}</h2>
                <button className="text-xs text-teal" onClick={() => { setDest(null); setRes(null); }}>Change</button>
              </div>
              <p className="px-4 pb-2 text-xs text-muted">Switch who&apos;s going and watch the same stays re-rank. Polarity flips: nightlife adds points for friends and subtracts for families.</p>
              <IntentPicker need={need} party={party} onChange={(n, p) => { setNeed(n); setParty(p); setRes(null); }} />
              {!rank && <Spinner />}
              {rank && (
                <Section title="Stays, ranked for this intent" sub={`Reviews from ${PARTY_META[party].label.toLowerCase()} travellers count double`}>
                  <div className="space-y-2 px-4">
                    {rank.stay.map((s, i) => (
                      <Card key={s.id} className="rise p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg text-muted">#{i + 1}</span>
                          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{s.name}</div><div className="text-xs text-muted">{inr(s.price)}/night</div></div>
                          <FitBadge fit={s.fit} />
                        </div>
                        {s.good.length > 0 && <p className="mt-1 text-xs text-ok">Strong on {s.good.join(", ")}</p>}
                        {s.evidence && <p className="mt-1 text-xs italic text-muted">“{s.evidence.snippet}”{s.evidence.sameParty ? ` (${PARTY_META[party].label.toLowerCase()} traveller)` : ""}</p>}
                        {(s.flags ?? []).map((f) => <p key={f.aspect} className="mt-1 text-xs text-bad">⚠ {f.aspect}{f.snippet ? `: “${f.snippet}”` : ""}{f.sameParty ? ` (${PARTY_META[party].label.toLowerCase()} traveller)` : ""}</p>)}
                        {s.blocked.length > 0 && <p className="mt-1 text-xs text-warn">Breaks your dealbreaker: {s.blocked.join(", ")}</p>}
                      </Card>
                    ))}
                  </div>
                </Section>
              )}
              <div className="px-4 pt-5"><Button className="w-full" onClick={() => plans({ destId: dest, need, party, context: "know_where" })} disabled={busy}>Plan the whole trip here →</Button></div>
            </>
          )}
        </>
      )}

      {tab === "intent" && (
        <div className="pt-3">
          <IntentPicker need={need} party={party} onChange={(n, p) => { setNeed(n); setParty(p); }} />
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pt-2">
            {[2, 3, 4, 5].map((d) => <Chip key={d} small on={days === d} onClick={() => setDays(d)}>{d} days</Chip>)}
            {[8000, 12000, 15000, 25000, 40000].map((b) => <Chip key={b} small tone="saffron" on={budget === b} onClick={() => setBudget(b)}>≤ {inr(b)}</Chip>)}
          </div>
        </div>
      )}

      {tab === "budget" && (
        <Section title="What can I do with…" sub="True trip cost per person: transport, stay, food, activities and local travel">
          <div className="space-y-3 px-4">
            <div className="flex flex-wrap gap-1.5">{[8000, 12000, 15000, 20000, 30000].map((b) => <Chip key={b} on={budget === b} onClick={() => setBudget(b)}>{inr(b)}</Chip>)}</div>
            <div className="flex flex-wrap gap-1.5">{[2, 3, 4].map((d) => <Chip key={d} tone="saffron" on={days === d} onClick={() => setDays(d)}>{d} days</Chip>)}</div>
            <IntentPicker need={need} party={party} onChange={(n, p) => { setNeed(n); setParty(p); }} />
            <Button className="w-full" onClick={() => plans({ need, party, budgetPP: budget, days, context: "budget_first", maxPlans: 6 })} disabled={busy}>Show what fits {inr(budget)} for {days} days</Button>
          </div>
        </Section>
      )}

      {tab === "reel" && (
        <Section title="Turn a Reel into a plan" sub="Paste a link you saved. We read the place and the vibe, then plan it around you.">
          <div className="space-y-2 px-4">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-teal" />
            <div className="flex gap-2">
              <Button onClick={() => runReel(url)} disabled={busy || !url}>Import</Button>
              <Button kind="ghost" onClick={() => { const u = "https://www.instagram.com/reel/C9rishikeshRaft/"; setUrl(u); runReel(u); }}>Try a sample Reel</Button>
            </div>
            <p className="text-[11px] text-muted">Prototype: link analysis is mocked; any Reel link maps to the sample.</p>
            {reel && (
              <Card className="rise p-3">
                <p className="text-xs text-muted">Caption</p>
                <p className="text-sm italic">“{reel.detected.caption}”</p>
                <ul className="mt-2 space-y-0.5 text-xs">{reel.detected.detected.map((x) => <li key={x}>✓ {x}</li>)}</ul>
                <p className="mt-2 text-sm font-semibold text-teal">Mapped to: {reel.detected.vibe}</p>
              </Card>
            )}
          </div>
          {reel && <div className="mt-3 space-y-3 px-4">{reel.plans.map((p) => <PlanCard key={p.id} p={p} wide />)}</div>}
        </Section>
      )}

      {busy && <Spinner label="Scoring every element…" />}
      {res && tab !== "reel" && (
        <div className="mt-4 space-y-3">
          <CriteriaBar criteria={res.criteria} onToggle={(k) => toggle(k, tab === "where" ? { destId: dest, need, party, context: "know_where" } : { need, party, budgetPP: budget, days, context: tab === "budget" ? "budget_first" : "intent", maxPlans: tab === "budget" ? 6 : undefined })} />
          <p className="px-4 text-xs text-muted">{res.plans.length} plans · engine chose {res.nPlans} (uncertainty {Math.round(res.uncertainty * 100)}%)</p>
          <div className="space-y-3 px-4">{res.plans.map((p) => <PlanCard key={p.id} p={p} wide />)}</div>
          {res.plans.length === 0 && <p className="px-4 text-sm text-muted">Nothing passes every filter. Switch a criterion off to see what it hides.</p>}
        </div>
      )}
    </Shell>
  );
}
