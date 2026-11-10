"use client";
import { useEffect, useRef, useState } from "react";
import { api, inr } from "@/lib/client";
import { Button, Chip, CriteriaBar, ErrorNote, NEED_META, PARTY_META, PLAN_GRID, PlanCard, Shell, Spinner, type Criterion, type PlanLite } from "@/components/ui";

interface Slots { need?: string | null; secondaryNeed?: string | null; party?: string | null; adults?: number | null; kids?: number | null; seniors?: number | null; pets?: number | null; budgetPP?: number | null; days?: number | null; whenText?: string | null; diet?: string | null; destId?: string | null; mood?: string | null; dealbreakers?: { label: string }[] }
interface Msg { role: "user" | "assistant"; content: string }

export default function PlanWithMe() {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Tell me what you're in the mood for. Who's coming, how long, a rough budget: say it however you like." }]);
  const [chips, setChips] = useState<string[]>(["Burnt out, need 3 quiet days alone", "Anniversary trip with my wife, 30k each", "Parents want a temple trip, nothing tiring", "4 of us, adventure, long weekend, under 12k"]);
  const [slots, setSlots] = useState<Slots>({});
  const [text, setText] = useState("");
  const [turns, setTurns] = useState(0);
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<string | null>(null);
  const [res, setRes] = useState<{ plans: PlanLite[]; criteria: Criterion[]; assumedText: string[]; nPlans: number; uncertainty: number } | null>(null);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, res]);

  const send = async (t: string) => {
    if (!t.trim()) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setText("");
    setBusy(true);
    setErr(null);
    try {
      const r = await api("/api/chat", { messages: next, slots, turns });
      setSlots(r.slots);
      setTurns(r.turns);
      setEngine(r.engine);
      setMsgs([...next, { role: "assistant", content: r.reply }]);
      setChips(r.chips ?? []);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const create = async (dis = disabled) => {
    setBusy(true);
    setErr(null);
    try {
      setRes(await api("/api/chat", { action: "create", slots, disabled: dis }));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const toggle = (k: string) => {
    const d = disabled.includes(k) ? disabled.filter((x) => x !== k) : [...disabled, k];
    setDisabled(d);
    create(d);
  };
  const ppl = (slots.adults ?? 0) + (slots.kids ?? 0) + (slots.seniors ?? 0);
  const S = [
    { k: "When", v: slots.whenText ?? (slots.days ? `${slots.days} days` : null), req: true },
    { k: "Who", v: slots.party ? `${PARTY_META[slots.party]?.label}${ppl ? ` (${ppl})` : ""}` : null, req: true },
    { k: "Budget", v: slots.budgetPP ? `${inr(slots.budgetPP)} pp` : null, req: true },
    { k: "Need state", v: slots.need ? `${NEED_META[slots.need]?.emoji} ${NEED_META[slots.need]?.label}${slots.secondaryNeed ? ` + ${NEED_META[slots.secondaryNeed]?.label}` : ""}` : null },
    { k: "Diet", v: slots.diet && slots.diet !== "none" ? slots.diet : null },
    { k: "Avoid", v: slots.dealbreakers?.length ? slots.dealbreakers.map((d) => d.label).join(", ") : null },
  ];
  return (
    <Shell title="Plan with me" right={engine && <span className="text-[10px] text-muted">{engine === "grok" ? "AI" : "rules"}</span>}>
      <div className="sticky top-[53px] z-10 border-b border-line bg-sand/95 px-4 py-2 backdrop-blur">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {S.map((s) => (
            <span key={s.k} className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] ${s.v ? "border-teal/30 bg-teal-soft" : s.req ? "border-dashed border-saffron text-warn" : "border-dashed border-line text-muted"}`}>
              <b>{s.k}</b> {s.v ?? (s.req ? "needed" : "optional")}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={`rise flex ${m.role === "user" ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "rounded-br-sm bg-teal text-white" : "rounded-bl-sm border border-line bg-paper"}`}>{m.content}</div>
          </div>
        ))}
        {busy && <Spinner label={res ? "Re-ranking…" : "Thinking…"} />}
        {chips.length > 0 && !busy && (
          <div className="flex flex-wrap gap-1.5">{chips.map((c) => <Chip key={c} small onClick={() => send(c)}>{c}</Chip>)}</div>
        )}
        <ErrorNote error={err} />
        {res && (
          <div className="-mx-4 space-y-3 pt-2">
            <CriteriaBar criteria={res.criteria} onToggle={toggle} assumed={res.assumedText} />
            <p className="px-4 text-xs text-muted">Showing {res.plans.length} plans (engine picked {res.nPlans} based on how sure it is: uncertainty {Math.round(res.uncertainty * 100)}%).</p>
            <div className={PLAN_GRID}>{res.plans.map((p) => <PlanCard key={p.id} p={p} wide />)}</div>
            {res.plans.length === 0 && <p className="px-4 text-sm text-muted">Nothing passes every filter. Switch one off above to see what it hides.</p>}
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="fixed inset-x-0 bottom-[57px] z-20 border-t border-line bg-paper/95 p-3 backdrop-blur md:bottom-0 md:left-60 md:px-8 md:py-4">
        <div className="mx-auto max-w-3xl md:flex md:items-center md:gap-3">
          <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type how you feel and what you need…" className="min-w-0 flex-1 rounded-xl border border-line bg-sand px-3 py-2.5 text-sm outline-teal" />
            <Button type="submit" kind="ghost" disabled={busy || !text.trim()}>Send</Button>
          </form>
          <Button className="mt-2 w-full md:mt-0 md:w-auto" onClick={() => create()} disabled={busy}>Create trip plan</Button>
        </div>
      </div>
      <div className="h-32" />
    </Shell>
  );
}
