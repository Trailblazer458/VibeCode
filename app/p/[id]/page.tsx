"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate, inr } from "@/lib/client";
import { Button, Card, Chip, Cover, ErrorNote, FitBadge, IntentPicker, NEED_META, PARTY_META, Section, Sheet, Shell, Spinner, type PlanLite } from "@/components/ui";
import { Testimonials, WhyCarousel } from "@/components/why";
import { LikeSave } from "@/components/likes";
import { destCover } from "@/lib/images";
import { itemQuotes, MiniTestimonials, ProsCons, type Flag } from "@/components/reviews";

interface Alt { id: string; name: string; price: number; mode?: string; fit: number; tags: string[]; blocked: string[]; good: string[]; goodKeys?: string[]; flags?: Flag[]; evidence: { snippet: string; sameParty: boolean } | null; reviews: number }
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
const PRICE_UNIT: Record<Elem, string> = { stay: "/night", transport: " pp one way", food: " pp per meal", activity: " pp" };

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<{ plan: Plan; alts: Record<Elem, Alt[]>; swapCost?: Record<string, { pp: number; total: number; perHead: number }>; budgetPP?: number | null; chosen: boolean; siblings: number } | null>(null);
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
  const cover = destCover(p.destId, p.need);

  const swapTo = async (elem: Elem, removeId: string, addId: string) => {
    setBusy(true);
    const r = await api(`/api/plan/${id}`, { action: "swap", element: elem, removeId, addId });
    setSwap(null);
    setBusy(false);
    flash(r.message);
    load();
  };
  const doSwap = async (addId: string) => {
    if (swap) await swapTo(swap.elem, swap.removeId, addId);
  };
  const travellers = p.pax.adults + p.pax.kids + p.pax.seniors;
  const inPlan = new Set([p.stay.id, p.transport.id, ...p.food.map((f) => f.id), ...p.activities.map((a) => a.id)]);
  const curFit = swap ? (d.alts[swap.elem].find((x) => x.id === swap.removeId)?.fit ?? 0) : 0;
  // What a swap does to the cost: per person and for the whole group (transport is priced as a return trip), and
  // where that leaves the plan against the budget. Exact: the server rebuilds the plan with the swap applied.
  const costLine = (a: Alt) => {
    const c = swap && d.swapCost?.[`${swap.elem}:${swap.removeId}>${a.id}`];
    if (!c) return null;
    const ret = swap?.elem === "transport" ? " (return)" : "";
    const change = c.pp === 0 ? "Same price" : c.pp > 0 ? `+${inr(c.pp)} per person${ret} · +${inr(c.total)} total` : `${inr(-c.pp)} less per person${ret} · ${inr(-c.total)} less total`;
    const budget = d.budgetPP ? (c.perHead <= d.budgetPP ? ` · ${inr(d.budgetPP - c.perHead)} under budget` : ` · ${inr(c.perHead - d.budgetPP)} over budget`) : "";
    return <p className={`text-xs font-medium ${d.budgetPP && c.perHead > d.budgetPP ? "text-warn" : c.pp > 0 ? "text-ink" : "text-ok"}`}>{change}{budget}</p>;
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
  // Readiness warnings, pinned to the item they are about. Plans saved before checks carried item ids fall back to the
  // check's key; anything not tied to one item (season, crowds at the sites) shows once above the trip.
  type Check = { key: string; label: string; status: string; detail: string; items?: string[] };
  const toCheck = (p.readiness as Check[]).filter((r) => r.status !== "ok");
  const itemsOf = (r: Check) => r.items ?? (r.key === "transit" || r.key === "arrival" ? [p.transport.id] : r.key === "rooms" ? [p.stay.id] : []);
  // A check about every activity (pace, no adventure, no signature moment) shows once on the Activities card, not per row.
  const actIds = p.activities.map((a) => a.id);
  const allActs = (r: Check) => actIds.length > 1 && actIds.every((id) => itemsOf(r).includes(id));
  const flagsFor = (id: string) => toCheck.filter((r) => itemsOf(r).includes(id) && !allActs(r));
  const actFlags = toCheck.filter(allActs);
  const tripWide = toCheck.filter((r) => itemsOf(r).length === 0);
  const note = (r: Check) => <><b>⚠ {r.label.replace(/^Trip-killer: /, "")}:</b> {r.detail}</>;
  const row = (elem: Elem, item: { id: string; name: string; fit: number; price: number }, meta: string) => {
    const flags = flagsFor(item.id);
    return (
    <div key={item.id} className={`flex items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0 ${flags.length ? "border-l-4 border-l-saffron bg-saffron-soft/60" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="text-xs text-muted">{meta}</div>
        {flags.map((r) => (
          <div key={r.label} className="mt-1 text-xs leading-snug text-warn">{note(r)}</div>
        ))}
      </div>
      <FitBadge fit={item.fit} />
      <button className="text-xs font-semibold text-teal" onClick={() => setSwap({ elem, removeId: item.id })}>Swap</button>
    </div>
    );
  };

  return (
    <Shell back="/feed" title={p.title} right={<FitBadge fit={p.fit} />}>
      <Cover hue={p.hue} emoji={p.emoji} photo={cover} className="px-4 pt-5 pb-6 text-white md:mx-4 md:mt-4 md:rounded-3xl md:px-8 md:py-10">
        <p className="text-xs opacity-90">{p.window.label ?? fmtDate(p.window.start)} · {p.window.days} days · {p.pax.adults + p.pax.kids + p.pax.seniors} travellers</p>
        <h1 className="font-display text-3xl font-semibold">{p.destName}</h1>
        <p className="text-sm opacity-95">{NEED_META[p.need].emoji} {NEED_META[p.need].label} · {PARTY_META[p.party].emoji} {PARTY_META[p.party].label}</p>
        <p className="glass-dark mt-4 inline-block rounded-2xl px-4 py-2 text-2xl font-semibold">{inr(p.cost.perHead)} <span className="text-sm font-normal opacity-90">per person, all-in</span></p>
        <div className="absolute top-3 right-3"><LikeSave planId={p.id} signature={(p as { signature?: string }).signature} /></div>
        {cover && (
          <a href={cover.source} target="_blank" rel="noreferrer" className="absolute right-3 bottom-2 max-w-[55%] truncate text-[10px] text-white/75 hover:text-white">
            Photo: {cover.artist} · {cover.license}
          </a>
        )}
      </Cover>
      {p.templateId && <p className="mx-4 mt-3 rounded-xl bg-saffron-soft px-3 py-2 text-xs text-warn">Remixed from {p.templateAuthor}&apos;s template. Every swap you make is recorded as a preference signal.</p>}
      {toast && <p className="rise fixed top-16 left-1/2 z-40 w-[90%] max-w-[440px] -translate-x-1/2 rounded-2xl border border-white/15 bg-ink/75 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-xl">{toast}</p>}

      <Section title="Change the intent" sub="Same destination; every element is re-scored with new weights">
        <IntentPicker need={p.need} party={p.party} onChange={switchIntent} />
        {busy && <Spinner label="Re-scoring…" />}
      </Section>

      <div className="md:grid md:grid-cols-2 md:items-start">
      <div>
      <Section title="Why this fits you">
        <div className="space-y-3 px-4">
          {blurb && <p className="line-clamp-2 text-sm text-muted" title="Written by Grok from the engine's reasons and real review snippets">{blurb}</p>}
          <WhyCarousel plan={p} />
        </div>
      </Section>

      {p.evidence.length > 0 && (
        <Section title="What other travellers said">
          <div className="px-3"><Testimonials evidence={p.evidence} /></div>
        </Section>
      )}

      </div>
      <div>
      <Section title="The trip">
        <div className="mx-4 space-y-3">
          {tripWide.map((r) => (
            <p key={r.label} className="rounded-xl border-l-4 border-l-saffron bg-saffron-soft px-3 py-2 text-xs leading-snug text-warn">{note(r)}</p>
          ))}
          <Card>{row("transport", p.transport, `${p.transport.hours}h door-to-door · departs ${Math.floor(p.transport.depart)}:${String(Math.round((p.transport.depart % 1) * 60)).padStart(2, "0")} · ${inr(p.transport.price)} ${p.transport.mode === "self_drive" ? "per car" : "pp"} one way`)}</Card>
          <Card>
            <div className="px-3 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Stay at</div>
            {row("stay", p.stay, `${p.stay.type} · ${p.stay.area} · ${inr(p.stay.price)}/night · ${p.rooms}`)}
          </Card>
          <Card>
            <div className="px-3 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Activities</div>
            {actFlags.map((r) => (
              <p key={r.label} className="mx-3 mt-2 rounded-lg border-l-4 border-l-saffron bg-saffron-soft px-2.5 py-1.5 text-xs leading-snug text-warn">{note(r)}</p>
            ))}
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
          <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-semibold"><span>Total ({travellers} {travellers === 1 ? "traveller" : "travellers"})</span><span>{inr(p.cost.total)}</span></div>
          <div className="flex justify-between py-0.5 font-semibold"><span>Per person</span><span>{inr(p.cost.perHead)}</span></div>
          {d.budgetPP ? (
            <div className={`mt-1.5 flex justify-between rounded-lg px-2 py-1 text-xs font-semibold ${p.cost.perHead <= d.budgetPP ? "bg-ok/10 text-ok" : "bg-saffron-soft text-warn"}`}>
              <span>Budget {inr(d.budgetPP)} per person</span>
              <span>{p.cost.perHead <= d.budgetPP ? `${inr(d.budgetPP - p.cost.perHead)} under` : `${inr(p.cost.perHead - d.budgetPP)} over`}</span>
            </div>
          ) : (
            <div className="mt-1.5 rounded-lg bg-teal-soft px-2 py-1 text-xs text-teal">No budget cap on this plan</div>
          )}
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
            const elsewhere = !current && inPlan.has(a.id);
            return (
              <div key={a.id} className={`space-y-2.5 rounded-2xl border p-3 ${current ? "border-teal bg-teal-soft" : "border-line bg-white/60"}`}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><div className="truncate font-display text-base leading-tight">{a.name}</div><div className="text-xs text-muted">{inr(a.price)}{swap ? (a.mode === "self_drive" ? " per car one way" : PRICE_UNIT[swap.elem]) : ""} · {a.reviews} reviews</div></div>
                  {!current && !elsewhere && !a.blocked.length && a.fit >= curFit + 5 && <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok">Better fit</span>}
                  <FitBadge fit={a.fit} />
                </div>
                <ProsCons good={a.good} goodKeys={a.goodKeys} flags={a.flags} blocked={a.blocked} />
                <MiniTestimonials quotes={itemQuotes(a, p.party)} />
                {!current && !elsewhere && costLine(a)}
                {!current && !elsewhere && <button disabled={busy} onClick={() => doSwap(a.id)} className="text-xs font-semibold text-teal">Use this instead →</button>}
                {current && <p className="text-xs font-semibold text-teal">In your plan</p>}
                {elsewhere && <p className="text-xs text-muted">Already elsewhere in your plan</p>}
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
