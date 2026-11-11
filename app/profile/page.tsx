"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate } from "@/lib/client";
import { destCover } from "@/lib/images";
import { Button, Card, Chip, Cover, ErrorNote, NEED_META, PARTY_META, Section, Sheet, Shell, Spinner } from "@/components/ui";

interface DB { id: string; attribute: string; label: string; kind: string; context_party: string | null; confidence: number; source: string; status: string }
interface Trip { id: string; dest_id: string; name: string; need: string; party: string; destName: string; emoji: string; hue: number; start_date: string; days: number; visibility: string; checked: boolean; itemNames: { id: string; name: string }[] }
interface D {
  profile: { name: string; persona: string; home_city: string; diet: string; budget_pp: number; dims: Record<string, number>; need_affinity: Record<string, number>; intents: { need: string; party: string }[]; calendar_opt_in: boolean; personal_dates: { label: string; date: string }[]; companions: { name: string; relation: string; diet: string }[]; is_demo: boolean };
  blurb: string; dealbreakers: DB[]; trips: Trip[]; friends: { id: string; name: string }[]; stats: { stated: number; revealed: number; passive: number }; tagOptions: Record<string, string>;
  nudges: { triggers: { key: string; title: string; status: string }[]; cap: number; season: string };
}
const SRC: Record<string, string> = { onboarding: "you said at signup", chat: "you said in chat", reason_chip: "your reason chip", edit: "inferred from an edit", post_trip: "post-trip check-in", stated: "you added it" };

export default function Profile() {
  const router = useRouter();
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checkin, setCheckin] = useState<Trip | null>(null);
  const [rep, setRep] = useState<string[]>([]);
  const [skip, setSkip] = useState<string[]>([]);
  const [surprise, setSurprise] = useState("");
  const [shareT, setShareT] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const load = () => api("/api/profile").then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const post = async (b: Record<string, unknown>, msg?: string) => {
    const r = await api("/api/profile", b);
    if (msg) { setToast(msg); setTimeout(() => setToast(null), 4500); }
    await load();
    return r;
  };
  if (err) return <Shell title="You"><ErrorNote error={err} /></Shell>;
  if (!d) return <Shell title="You"><Spinner /></Shell>;
  const p = d.profile;
  const toggle = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  return (
    <Shell title="You" right={<button className="text-xs text-muted" onClick={async () => { await api("/api/session", { mode: "logout" }); router.push("/"); }}>Log out</button>}>
      {toast && <p className="rise fixed top-16 left-1/2 z-40 w-[90%] max-w-[440px] -translate-x-1/2 rounded-2xl border border-white/15 bg-ink/75 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-xl">{toast}</p>}
      <div className="cover mx-4 mt-4 rounded-3xl p-5 text-white" style={{ ["--h" as string]: 190 }}>
        <p className="text-xs uppercase tracking-widest opacity-80">{p.name} · {p.home_city}</p>
        <h1 className="font-display text-2xl font-semibold">{p.persona}</h1>
        <p className="mt-2 text-sm opacity-95">{d.blurb}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {Object.entries(p.dims).filter(([k]) => k !== "climate").map(([k, v]) => (
            <div key={k}><div className="flex justify-between capitalize opacity-90"><span>{k}</span><span>{Math.round(v * 100)}</span></div><div className="h-1 rounded bg-white/25"><div className="h-1 rounded bg-white" style={{ width: `${v * 100}%` }} /></div></div>
          ))}
        </div>
        <p className="mt-3 text-[11px] opacity-80">Signals: {d.stats.stated} stated · {d.stats.revealed} revealed · {d.stats.passive} passive (session-only)</p>
      </div>

      <Section title="Top intents" sub="Your For You feed opens with these">
        <div className="flex flex-wrap gap-1.5 px-4">{p.intents.map((i) => <span key={i.need + i.party} className="rounded-full bg-teal-soft px-3 py-1 text-sm">{NEED_META[i.need].emoji} {NEED_META[i.need].label} · {PARTY_META[i.party].label}</span>)}</div>
      </Section>

      <Section title="Your dealbreakers" sub="Hard ones filter; soft ones down-rank. Inferred ones wait for your OK." action={<button className="text-xs font-semibold text-teal" onClick={() => setAddOpen(true)}>+ Add</button>}>
        <div className="grid gap-2 px-4 md:grid-cols-2">
          {d.dealbreakers.map((b) => (
            <Card key={b.id} className={`p-3 ${b.status === "inferred" ? "border-dashed border-saffron" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium">{b.label}</div>
                  <div className="text-[11px] text-muted">{b.kind === "hard" ? "Hard" : "Soft"}{b.context_party ? ` · only for ${PARTY_META[b.context_party]?.label.toLowerCase()} trips` : ""} · {SRC[b.source] ?? b.source}{b.status === "inferred" ? ` · confidence ${Math.round(b.confidence * 100)}%` : ""}</div>
                </div>
                <button className="text-xs text-muted" onClick={() => post({ action: "remove_dealbreaker", id: b.id }, "Removed.")}>✕</button>
              </div>
              {b.status === "inferred" && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-warn">We noticed this. Keep avoiding?</span>
                  <Chip small onClick={() => post({ action: "confirm_dealbreaker", id: b.id, kind: "soft" }, "Confirmed as a soft preference.")}>Yes, soft</Chip>
                  <Chip small onClick={() => post({ action: "confirm_dealbreaker", id: b.id, kind: "hard" }, "Confirmed as a hard filter.")}>Never</Chip>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Past trips" sub="Retake one, or tell us what to repeat and skip">
        <div className="grid gap-2 px-4 md:grid-cols-2">
          {d.trips.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-2xl border border-line bg-paper">
              <Cover hue={t.hue} emoji={t.emoji} photo={destCover(t.dest_id, t.need)} className="h-16 px-3 py-2 text-white"><div className="font-display font-semibold">{t.name}</div><div className="text-xs opacity-90">{fmtDate(t.start_date)} · {t.days} days · {NEED_META[t.need].label} · {PARTY_META[t.party].label}</div></Cover>
              <div className="flex flex-wrap items-center gap-2 p-3">
                <Button className="!px-3 !py-1.5 text-xs" onClick={async () => { const r = await post({ action: "retake", tripId: t.id }); router.push(`/p/${r.planId}`); }}>Retake</Button>
                {!t.checked ? <Button kind="accent" className="!px-3 !py-1.5 text-xs" onClick={() => { setCheckin(t); setRep([]); setSkip([]); setSurprise(""); }}>3-question check-in</Button> : <span className="text-xs text-ok">✓ Checked in</span>}
                <select value={t.visibility} onChange={(e) => post({ action: "visibility", tripId: t.id, visibility: e.target.value }, "Visibility updated.")} className="ml-auto rounded-lg border border-line bg-sand px-2 py-1 text-xs">
                  <option value="private">Private</option><option value="friends">Friends</option><option value="fof">Friends of friends</option><option value="public">Public</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Nudges" sub={d.nudges.season} action={<Link href="/nudges" className="text-xs font-semibold text-teal">All →</Link>}>
        <Card className="mx-4 divide-y divide-line">
          {d.nudges.triggers.slice(0, 4).map((t) => <div key={t.key} className="flex gap-2 p-3 text-sm"><span className="flex-1">{t.title}</span><span className={`text-[11px] ${t.status === "send" ? "text-ok" : "text-muted"}`}>{t.status === "send" ? "will send" : t.status}</span></div>)}
        </Card>
      </Section>

      <Section title="Settings">
        <Card className="mx-4 space-y-3 p-3 text-sm">
          <div><p className="mb-1 text-xs text-muted">Diet</p><div className="flex flex-wrap gap-1.5">{["none", "nonveg", "eggetarian", "veg", "jain"].map((x) => <Chip key={x} small on={p.diet === x} onClick={() => post({ action: "settings", diet: x })}>{x}</Chip>)}</div></div>
          {p.companions.length > 0 && <p className="text-xs text-muted">Partner: {p.companions.map((c) => `${c.name} (${c.diet})`).join(", ")}. Couple and family trips use the strictest diet.</p>}
          <div><p className="mb-1 text-xs text-muted">Default budget per person</p><div className="flex flex-wrap gap-1.5">{[8000, 15000, 25000, 30000, 40000].map((b) => <Chip key={b} small on={p.budget_pp === b} onClick={() => post({ action: "settings", budget_pp: b })}>₹{b.toLocaleString("en-IN")}</Chip>)}</div></div>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal" checked={p.calendar_opt_in} onChange={(e) => post({ action: "settings", calendar_opt_in: e.target.checked })} /> Use my calendar and personal dates for nudges (opt-in)</label>
          {p.personal_dates.length > 0 && <p className="text-xs text-muted">Personal dates: {p.personal_dates.map((x) => `${x.label} (${fmtDate(x.date)})`).join(", ")}</p>}
          <p className="text-xs text-muted">Friends: {d.friends.map((f) => f.name).join(", ") || "none yet"}</p>
          <Link href="/metrics" className="block text-xs font-semibold text-teal">North-star & guardrail metrics →</Link>
        </Card>
      </Section>

      <Sheet open={!!checkin} onClose={() => setCheckin(null)} title={checkin ? `${checkin.name}: how was it?` : ""}>
        {checkin && (
          <div className="space-y-4">
            <div><p className="mb-1.5 text-sm font-medium">1. What would you repeat?</p><div className="flex flex-wrap gap-1.5">{checkin.itemNames.map((i) => <Chip key={i.id} small on={rep.includes(i.id)} onClick={() => setRep(toggle(rep, i.id))}>{i.name}</Chip>)}</div></div>
            <div><p className="mb-1.5 text-sm font-medium">2. What would you skip next time?</p><div className="flex flex-wrap gap-1.5">{checkin.itemNames.map((i) => <Chip key={i.id} small tone="saffron" on={skip.includes(i.id)} onClick={() => setSkip(toggle(skip, i.id))}>{i.name}</Chip>)}</div></div>
            <div><p className="mb-1.5 text-sm font-medium">3. What surprised you?</p><input value={surprise} onChange={(e) => setSurprise(e.target.value)} className="w-full rounded-xl border border-line bg-sand px-3 py-2 text-sm" placeholder="Optional" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal" checked={shareT} onChange={(e) => setShareT(e.target.checked)} /> Share this trip as a template with friends</label>
            <Button className="w-full" onClick={async () => { const r = await post({ action: "checkin", tripId: checkin.id, repeat: rep, skip, surprise, share: shareT }); setCheckin(null); setToast(r.learned?.length ? `Learned: avoid ${r.learned.join(", ").toLowerCase()} on similar trips.` : "Thanks! Your profile is updated."); setTimeout(() => setToast(null), 4500); }}>Save</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a dealbreaker">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(d.tagOptions).map(([k, v]) => <Chip key={k} small onClick={async () => { await post({ action: "add_dealbreaker", attribute: k, label: `Never: ${v.toLowerCase()}`, kind: "hard" }, "Added as a hard filter."); setAddOpen(false); }}>{v}</Chip>)}
        </div>
      </Sheet>
    </Shell>
  );
}
