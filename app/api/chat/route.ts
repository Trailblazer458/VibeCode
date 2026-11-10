import { nextWindow } from "@/lib/engine/triggers";
import { DEFAULT_PAX } from "@/lib/engine/plan";
import { extractSlots, missingRequired, templateQuestion, type Slots } from "@/lib/llm";
import { handle, HttpError, logSignal, requireUser, runPlans } from "@/lib/server";
import type { Party, TripRequest } from "@/lib/types";

const hits = new Map<string, number[]>();
function rateLimit(key: string, max = 30, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, "Too many messages. Try again in a few minutes.");
  arr.push(now);
  hits.set(key, arr);
}

export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    rateLimit(uid + (req.headers.get("x-forwarded-for") ?? ""));
    const body = await req.json();
    const prev: Slots = body.slots ?? {};

    if (body.action === "create") {
      const w = nextWindow();
      const assumed: string[] = [];
      const party = (prev.party ?? (assumed.push("who"), profile.default_party)) as Party;
      const base = DEFAULT_PAX[party];
      const pax = {
        adults: prev.adults ?? base.adults,
        kids: prev.kids ?? base.kids,
        seniors: prev.seniors ?? base.seniors,
        pets: prev.pets ?? 0,
      };
      if (party === "family_elders" && !prev.seniors) pax.seniors = 2;
      const days = prev.days ?? (assumed.push("when"), w.days);
      const start = prev.start ?? w.start;
      const budgetPP = prev.budgetPP ?? (assumed.push("budget"), profile.budget_pp);
      const need = prev.need ?? (assumed.push("need"), profile.intents?.[0]?.need ?? "explore");
      const tr: TripRequest = {
        need, secondaryNeed: prev.secondaryNeed ?? null, party, pax,
        window: { start, days, label: prev.whenText ?? w.label }, budgetPP, diet: prev.diet ?? null, destId: prev.destId ?? null,
        assumed, extraDealbreakers: prev.dealbreakers ?? [],
      };
      const r = await runPlans(uid, sid, profile, tr, "chat", { disabled: body.disabled ?? [] });
      await logSignal(uid, sid, "chat_create", "stated", { slots: prev, assumed });
      return { ...r, assumedText: assumed.map((a) => ({ who: `${pax.adults + pax.kids + pax.seniors} travellers (${party.replace("_", " ")})`, when: `${days} days, ${w.label}`, budget: `₹${budgetPP.toLocaleString("en-IN")} per person`, need: need })[a as "who"]) };
    }

    const messages = (body.messages ?? []).slice(-12) as { role: "user" | "assistant"; content: string }[];
    if (!messages.length || messages[messages.length - 1].content.length > 600) throw new HttpError(400, "Message missing or too long");
    const ex = await extractSlots(messages, prev);
    const missing = missingRequired(ex.slots);
    const turns = (body.turns ?? 0) + 1;
    const ready = missing.length === 0 || turns >= 3;
    let reply = ex.reply;
    let chips = ex.chips;
    if (!reply || ready) {
      if (ready) {
        reply = missing.length ? "I'll fill the gaps with your usual preferences. Tap “Create trip plan” and I'll show the assumptions up top." : "Perfect, I have what I need. Tap “Create trip plan”.";
        chips = [];
      } else {
        const t = templateQuestion(missing);
        reply = t.reply;
        chips = t.chips;
      }
    }
    await logSignal(uid, sid, "chat_turn", "stated", { slots: ex.slots, engine: ex.engine });
    return { slots: ex.slots, reply, chips: chips ?? [], missing, ready, engine: ex.engine, turns };
  });
}
