"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate, inr } from "@/lib/client";
import { Button, Card, Chip, Cover, ErrorNote, FitBadge, IntentPicker, NEED_META, PARTY_META, Section, Sheet, Shell, Spinner, StatusDot, type PlanLite } from "@/components/ui";

interface Alt { id: string; name: string; price: number; fit: number; tags: string[]; blocked: string[]; good: string[]; flag: { aspect: string; snippet: string | null; sameParty: boolean } | null; flags?: { aspect: string; snippet: string | null; sameParty: boolean }[]; evidence: { snippet: string; sameParty: boolean } | null; reviews: number }
type Plan = PlanLite & {
  destId: string; pax: { adults: number; kids: number; seniors: number; pets: number }; rooms: string;
  stay: { id: string; name: string; type: string; area: string; fit: number; price: number };
  transport: { id: string; name: string; mode: string; hours: number; depart: number; fit: number; price: number };
  food: { id: string; name: string; fit: number; price: number }[];
  activities: { id: string; name: string; fit: number; price: number; day: number }[];
  templateId?: string; templateAuthor?: string; assumed?: string[];
};
const ELEM_LABEL = { stay: "Stay", transport: "Getting there", food: "Food", activity: "Activities" } as const;
type Elem = keyof typeof ELEM_LABEL;

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<{ plan: Plan; alts: Record<Elem, Alt[]>; chosen: boolean; siblings: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ elem: Elem; removeId: string } | null>(null);
  const [chips, setChips] = useState<{ chips: string[]; rejected: { destName: string }[] } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [blurb, setBlurb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(false);
  const t0 = useRef(Date.now());

  const load = () => api(`/api/plan/${id}`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api("/api/explain", { planId: id }).then((r) => setBlurb(r.blurb)).catch(() => {});
    t0.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (!d) return;
    const send = () => navigator.sendBeacon?.("/api/signals", JSON.stringify({ type: "dwell", planId: id, destId: d.plan.destId, ms: Date.now() - t0.current }));
    window.addEventListener("pagehide", send);
    return () => {
      send();
      window.removeEventListener("pagehide", send);
    };
  }, [d, id]);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 5000);
  };

  if (err) return <Shell back="/feed" title="Plan"><ErrorNote error={err} /></Shell>;
  if (!d) return <Shell back="/feed" title="Plan"><Spinner /></Shell>;
  const p = d.plan;

  const doSwap = async (addId: string) => {
    if (!swap) return;
    setBusy(true);
    const r = await api(`/api/plan/${id}`, { action: "swap", element: swap.elem, removeId: swap.removeId, addId });
    setSwap(null);
    setBusy(false);
    flash(r.message);
    load();
  };
  const choose = async () => {
    setBusy(true);
    const r = await api(`/api/plan/${id}`, { action: "choose" });
    setBusy(false);
    if (r.ambiguous) setChips({ chips: r.chips, rejected: r.rejected });
    else flash(r.learned?.length ? `Saved to Trips. Learned from your choice: ${r.learned.join(", ")}` : "Saved to Trips.");
    load();
  };
  const sendReasons = async () => {
    const r = await api(`/api/plan/${id}`, { action: "reasons", chips: picked });
    setChips(null);
    setPicked([]);
    flash(r.created?.length ? `Thanks. New preferences: ${r.created.join("; ")}` : "Thanks, noted.");
  };
  const switchIntent = async (need: string, party: string) => {
    setBusy(true);
    const r = await api(`/api/plan/${id}`, { action: "switch", need, party });
    setBusy(false);
    if (r.planId) router.push(`/p/${r.planId}`);
    else flash("Nothing at this destination passes the filters for that intent.");
  };
  const saveTemplate = async (visibility: string) => {
    await api(`/api/plan/${id}`, { action: "save_template", visibility });
    setShare(false);
    flash(visibility === "public" ? "Published. Dates stay hidden until your trip is over." : "Shared with friends. Dates hidden until the trip is over.");
  };

  const altsFor = swap ? d.alts[swap.elem] : [];
  const row = (elem: Elem, item: { id: string; name: string; fit: number; price: number }, meta: string) => (
    <div key={item.id} className="flex items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="text-xs text-muted">{meta}</div>
      </div>
      <FitBadge fit={item.fit} />
      <button className="text-xs font-semibold text-teal" onClick={() => setSwap({ elem, removeId: item.id })}>Swap</button>
    </div>
  );

  return (
    <Shell back="/feed" title={p.title} right={<FitBadge fit={p.fit} />}>
      <Cover hue={p.hue} emoji={p.emoji} className="px-4 pt-5 pb-6 text-white md:mx-4 md:mt-4 md:rounded-3xl md:px-8 md:py-10">
        <p className="text-xs opacity-90">{p.window.label ?? fmtDate(p.window.start)} · {p.window.days} days · {p.pax.adults + p.pax.kids + p.pax.seniors} travellers</p>
        <h1 className="font-display text-3xl font-semibold">{p.destName}</h1>
        <p className="text-sm opacity-95">{NEED_META[p.need].emoji} {NEED_META[p.need].label} · {PARTY_META[p.party].emoji} {PARTY_META[p.party].label}</p>
        <p className="mt-3 text-2xl font-semibold">{inr(p.cost.perHead)} <span className="text-sm font-normal opacity-90">per person, all-in</span></p>
      </Cover>
      {p.templateId && <p className="mx-4 mt-3 rounded-xl bg-saffron-soft px-3 py-2 text-xs text-warn">Remixed from {p.templateAuthor}&apos;s template. Every swap you make is recorded as a preference signal.</p>}
      {toast && <p className="rise fixed top-16 left-1/2 z-40 w-[90%] max-w-[440px] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">{toast}</p>}

      <Section title="Change the intent" sub="Same destination; every element is re-scored with new weights">
        <IntentPicker need={p.need} party={p.party} onChange={switchIntent} />
        {busy && <Spinner label="Re-scoring…" />}
      </Section>

      <div className="md:grid md:grid-cols-2 md:items-start">
      <div>
      <Section title="Why this fits you">
        <Card className="mx-4 space-y-2 p-3">
          {blurb && <p className="rounded-lg bg-teal-soft p-2 text-sm">{blurb} <span className="block text-[10px] text-muted">Written by AI from the engine&apos;s reasons and real review snippets</span></p>}
          <ul className="space-y-1.5 text-sm">{p.why.map((w) => <li key={w} className="flex gap-2"><span className="text-teal">✓</span>{w}</li>)}</ul>
          {p.evidence.map((e) => (
            <blockquote key={e.text} className="border-l-2 border-saffron pl-2 text-xs italic text-muted">
              “{e.text}” <span className="not-italic">({e.party === p.party ? `a ${PARTY_META[p.party].label.toLowerCase()} traveller` : "a guest"} on {e.itemName})</span>
            </blockquote>
          ))}
        </Card>
      </Section>

      <Section title="Readiness check" sub="Intent trip-killers and your dealbreakers, checked before booking">
        <Card className="mx-4 divide-y divide-line">
          {p.readiness.map((r, i) => (
            <div key={i} className="flex gap-2.5 p-3">
              <StatusDot s={r.status} />
              <div><div className="text-sm font-medium">{r.label}</div><div className="text-xs text-muted">{r.detail}</div></div>
            </div>
          ))}
        </Card>
      </Section>

      </div>
      <div>
      <Section title="The trip">
        <div className="mx-4 space-y-3">
          <Card>{row("transport", p.transport, `${p.transport.hours}h door-to-door · departs ${Math.floor(p.transport.depart)}:${String(Math.round((p.transport.depart % 1) * 60)).padStart(2, "0")} · ${inr(p.transport.price)} pp one way`)}</Card>
          <Card>{row("stay", p.stay, `${p.stay.type} · ${p.stay.area} · ${inr(p.stay.price)}/night · ${p.rooms}`)}</Card>
          <Card>
            <div className="px-3 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Activities</div>
            {p.activities.map((a) => row("activity", a, `Day ${a.day} · ${a.price ? inr(a.price) + " pp" : "free"}`))}
          </Card>
          <Card>
            <div className="px-3 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Food</div>
            {p.food.map((f) => row("food", f, `${inr(f.price)} pp per meal`))}
          </Card>
        </div>
      </Section>

      <Section title="True trip cost" sub="Everything, not just the hotel">
        <Card className="mx-4 p-3 text-sm">
          {([["Transport (return)", p.cost.transport], ["Stay", p.cost.stay], ["Food", p.cost.food], ["Activities", p.cost.activities], ["Local travel", p.cost.local]] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5"><span className="text-muted">{k}</span><span>{inr(v)}</span></div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-semibold"><span>Total · per person</span><span>{inr(p.cost.total)} · {inr(p.cost.perHead)}</span></div>
        </Card>
      </Section>

      <div className="mx-4 mt-6 grid grid-cols-2 gap-2">
        <Button onClick={choose} disabled={busy || d.chosen}>{d.chosen ? "✓ Chosen" : "Choose this plan"}</Button>
        <Button kind="ghost" onClick={() => setShare(true)}>Share as template</Button>
        <Button kind="accent" className="col-span-2" onClick={() => flash("Prototype: this hands off to checkout with all items pre-filled.")}>Book this trip →</Button>
      </div>
      </div>
      </div>

      <Sheet open={!!swap} onClose={() => setSwap(null)} title={swap ? `Swap ${ELEM_LABEL[swap.elem].toLowerCase()}` : ""}>
        <p className="mb-3 text-xs text-muted">Ranked for {NEED_META[p.need].label} · {PARTY_META[p.party].label}. Reviews from {PARTY_META[p.party].label.toLowerCase()} travellers count double.</p>
        <div className="space-y-2">
          {altsFor.map((a) => {
            const current = swap?.removeId === a.id;
            return (
              <div key={a.id} className={`rounded-xl border p-3 ${current ? "border-teal bg-teal-soft" : "border-line"}`}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a.name}</div><div className="text-xs text-muted">{inr(a.price)} · {a.reviews} reviews mined</div></div>
                  <FitBadge fit={a.fit} />
                </div>
                {a.good.length > 0 && <p className="mt-1 text-xs text-ok">Strong on {a.good.join(", ")}</p>}
                {(a.flags ?? []).map((f) => <p key={f.aspect} className="mt-1 text-xs text-bad">⚠ {f.aspect}{f.snippet ? `: “${f.snippet}”` : ""}{f.sameParty ? " (same kind of traveller)" : ""}</p>)}
                {a.blocked.length > 0 && <p className="mt-1 text-xs text-warn">Breaks your dealbreaker: {a.blocked.join(", ")}</p>}
                {!current && <button disabled={busy} onClick={() => doSwap(a.id)} className="mt-2 text-xs font-semibold text-teal">Use this instead →</button>}
                {current && <p className="mt-1 text-xs font-semibold text-teal">In your plan</p>}
              </div>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={!!chips} onClose={() => setChips(null)} title="Quick one: why not the others?">
        <p className="mb-3 text-sm text-muted">The plans you skipped ({chips?.rejected.map((r) => r.destName).join(", ")}) differ in several ways, so we can&apos;t tell what put you off. One tap helps; skipping is fine.</p>
        <div className="flex flex-wrap gap-1.5">{chips?.chips.map((c) => <Chip key={c} on={picked.includes(c)} onClick={() => setPicked(picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c])}>{c}</Chip>)}</div>
        <div className="mt-4 flex gap-2"><Button onClick={sendReasons} disabled={!picked.length}>Save</Button><Button kind="ghost" onClick={() => setChips(null)}>Skip</Button></div>
      </Sheet>

      <Sheet open={share} onClose={() => setShare(false)} title="Share as a template">
        <p className="mb-3 text-sm text-muted">Friends can remix it. Your trip dates stay hidden until the trip is over.</p>
        <div className="grid gap-2">
          <Button kind="ghost" onClick={() => saveTemplate("friends")}>Friends only</Button>
          <Button kind="ghost" onClick={() => saveTemplate("fof")}>Friends of friends</Button>
          <Button kind="ghost" onClick={() => saveTemplate("public")}>Public</Button>
        </div>
      </Sheet>
    </Shell>
  );
}
