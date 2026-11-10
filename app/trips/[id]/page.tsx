"use client";
import { use, useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Button, Card, Chip, ErrorNote, PlanCard, Section, Shell, Spinner, type PlanLite } from "@/components/ui";

interface Room {
  trip: { id: string; name: string; need: string; status: string; planId: string | null; destName: string | null };
  role: string;
  members: { id: string; name: string; role: string }[];
  poll: { id: string; label: string; start: string; days: number; count: number; mine: boolean; best: boolean }[];
  constraints: { id: string; label: string; kind: string; enabled: boolean; mine: boolean; hides: number; previewing: boolean }[];
  intentCriteria: { key: string; label: string; hidden: number }[];
  plans: (PlanLite & { destId: string; votes: { likes: number; vetoes: number }; myVote: string | null })[];
  previewKeys: { key: string; constraintId?: string }[];
  incoming: { id: string; message: string; label: string }[];
  outgoing: { id: string; status: string; label: string }[];
  tasks: { id: string; label: string; assignee: string | null; done: boolean }[];
  fairness: { lastPicker: string | null; priority: string[] };
}

export default function GroupRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Room | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const load = (pv = preview) => api(`/api/trip/${id}?preview=${pv.join(",")}`).then(setD).catch((e) => setErr(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);
  const act = async (body: Record<string, unknown>, msg?: string) => {
    setBusy(true);
    try {
      await api(`/api/trip/${id}`, body);
      if (msg) { setToast(msg); setTimeout(() => setToast(null), 4500); }
      await load();
    } catch (e) {
      setToast((e as Error).message);
      setTimeout(() => setToast(null), 4500);
    }
    setBusy(false);
  };
  const keyFor = (cid: string) => d?.previewKeys.find((k) => k.constraintId === cid)?.key ?? (d?.constraints.find((c) => c.id === cid)?.label.startsWith("Budget") ? "budget" : d?.constraints.find((c) => c.id === cid)?.label.startsWith("Vegetarian") ? "diet" : null);
  const togglePreview = (cid: string) => {
    const k = keyFor(cid);
    if (!k) return;
    const pv = preview.includes(k) ? preview.filter((x) => x !== k) : [...preview, k];
    setPreview(pv);
    load(pv);
  };

  if (err) return <Shell back="/trips" title="Trip room"><ErrorNote error={err} /></Shell>;
  if (!d) return <Shell back="/trips" title="Trip room"><Spinner label="Combining everyone's profiles…" /></Shell>;
  const invite = typeof window !== "undefined" ? `${location.origin}/?invite=${id}` : "";
  return (
    <Shell back="/trips" title={d.trip.name}>
      {toast && <p className="rise fixed top-16 left-1/2 z-40 w-[90%] max-w-[440px] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">{toast}</p>}
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {d.members.map((m) => <span key={m.id} className="rounded-full bg-paper px-3 py-1 text-sm ring-1 ring-line">{m.name}{m.role === "organizer" ? " · organizer" : ""}</span>)}
          <a href={`https://wa.me/?text=${encodeURIComponent(`Join our trip room on TripGenie: ${invite}`)}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-3 py-1 text-sm text-white">+ Invite via WhatsApp</a>
        </div>
        {d.fairness.lastPicker && <p className="mt-2 text-xs text-muted">⚖ Fairness: {d.fairness.lastPicker} picked last time, so {d.fairness.priority.join(" & ")} get a little more weight in this round.</p>}
        {d.trip.status === "booked" && <p className="mt-3 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">✓ Confirmed: {d.trip.destName}. <button className="underline" onClick={() => act({ action: "reopen" })}>Reopen</button></p>}
      </div>

      <Section title="When can everyone go?" sub="Long weekends from the holiday calendar; tap to vote">
        <div className="space-y-2 px-4">
          {d.poll.map((o) => (
            <button key={o.id} disabled={busy} onClick={() => act({ action: "vote_date", optionId: o.id })} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${o.mine ? "border-teal bg-teal-soft" : "border-line bg-paper"}`}>
              <div className="flex-1"><div className="text-sm font-semibold">{o.label}</div><div className="text-xs text-muted">{fmtDate(o.start)} · {o.days} days</div></div>
              <span className="text-sm">{"●".repeat(o.count)}<span className="text-line">{"●".repeat(Math.max(0, d.members.length - o.count))}</span></span>
              {o.best && <span className="rounded-full bg-saffron px-2 py-0.5 text-[10px] font-bold text-white">PLANNING FOR</span>}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Criteria considered" sub="Shown to everyone, never who set them. Each shows how many options it hides.">
        <div className="space-y-2 px-4">
          {d.constraints.map((c) => (
            <Card key={c.id} className={`p-3 ${!c.enabled ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className={`text-sm font-medium ${!c.enabled ? "line-through" : ""}`}>{c.label}</div>
                  <div className="text-[11px] text-muted">{c.kind === "hard" ? "Hard filter" : "Soft preference"}{c.mine ? " · set by you" : ""}{c.enabled && c.hides > 0 ? ` · hides ${c.hides} option${c.hides > 1 ? "s" : ""}` : ""}</div>
                </div>
                {c.kind === "soft" || c.mine ? (
                  <Chip small on={c.enabled} onClick={() => act({ action: "toggle", constraintId: c.id })}>{c.enabled ? "On" : "Off"}</Chip>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Chip small on={c.previewing} tone="saffron" onClick={() => togglePreview(c.id)}>{c.previewing ? "Previewing" : "Preview hidden"}</Chip>
                    <button className="text-[11px] font-semibold text-teal" onClick={() => act({ action: "request_relax", constraintId: c.id, count: c.hides }, "Request sent anonymously to whoever set it.")}>Ask to relax</button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {d.intentCriteria.map((c) => <p key={c.key} className="text-[11px] text-muted">+ {c.label}{c.hidden ? ` (hides ${c.hidden})` : ""}</p>)}
          {d.outgoing.map((o) => (
            <p key={o.id} className="text-xs text-muted">Your request on “{o.label}”: <b>{o.status}</b>
              {o.status === "pending" && <button className="ml-2 text-teal underline" onClick={() => act({ action: "respond_relax", requestId: o.id, approve: true, simulate: true }, "Simulated: the owner approved it privately.")}>(demo: simulate approval)</button>}
            </p>
          ))}
        </div>
      </Section>

      {d.incoming.length > 0 && (
        <Section title="Only you can see this" sub="Requests about a criterion you set. Nobody knows it's yours.">
          <div className="space-y-2 px-4">
            {d.incoming.map((r) => (
              <Card key={r.id} className="border-saffron p-3">
                <p className="text-sm">{r.message}</p>
                <p className="mt-1 text-[11px] text-muted">About: {r.label}</p>
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => act({ action: "respond_relax", requestId: r.id, approve: true }, "Relaxed for this trip. The group only sees the criterion switch off.")}>Allow this once</Button>
                  <Button kind="ghost" onClick={() => act({ action: "respond_relax", requestId: r.id, approve: false }, "Kept. The group won't see who declined.")}>Keep it</Button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title="Plans for the group" sub="Weights blend every member's profile; like or veto">
        <div className="space-y-3 px-4">
          {d.plans.map((p) => (
            <div key={p.id}>
              <PlanCard p={p} wide />
              <div className="mt-1.5 flex items-center gap-2">
                <Chip small on={p.myVote === "like"} onClick={() => act({ action: "vote_plan", destId: p.destId, vote: p.myVote === "like" ? null : "like" })}>👍 {p.votes.likes}</Chip>
                <Chip small tone="saffron" on={p.myVote === "veto"} onClick={() => act({ action: "vote_plan", destId: p.destId, vote: p.myVote === "veto" ? null : "veto" })}>✋ Veto</Chip>
                {d.role === "organizer" && d.trip.status !== "booked" && <Button className="ml-auto !px-3 !py-1.5 text-xs" onClick={() => act({ action: "confirm", planId: p.id, destId: p.destId }, `Confirmed ${p.destName}.`)}>Confirm</Button>}
              </div>
            </div>
          ))}
          {!d.plans.length && <Card className="p-4 text-sm text-muted">No option passes everyone&apos;s criteria. Preview a hidden option or ask to relax one.</Card>}
        </div>
      </Section>

      <Section title="Who's doing what" sub="So the planner isn't one person">
        <div className="space-y-2 px-4">
          {d.tasks.map((t) => (
            <Card key={t.id} className="flex items-center gap-2 p-3">
              <input type="checkbox" checked={t.done} onChange={() => act({ action: "task", op: "done", taskId: t.id })} className="h-4 w-4 accent-teal" />
              <span className={`flex-1 text-sm ${t.done ? "line-through text-muted" : ""}`}>{t.label}</span>
              {t.assignee ? <span className="text-xs text-muted">{t.assignee}</span> : <button className="text-xs font-semibold text-teal" onClick={() => act({ action: "task", op: "assign", taskId: t.id, assignee: d.members.find((m) => m.name === "You")?.id })}>I&apos;ll do it</button>}
            </Card>
          ))}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) { act({ action: "task", op: "add", label: newTask }); setNewTask(""); } }}>
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task" className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
            <Button type="submit" kind="ghost">Add</Button>
          </form>
        </div>
      </Section>
    </Shell>
  );
}
