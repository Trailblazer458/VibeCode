import { nextWindow } from "@/lib/engine/triggers";
import { DEFAULT_PAX } from "@/lib/engine/plan";
import { extractRules, extractSlots, missingRequired, templateQuestion, type Slots } from "@/lib/llm";
import { handle, HttpError, logSignal, requireUser, runPlans, userTriggers } from "@/lib/server";
import { DEST_BY_ID } from "@/lib/data/catalog";
import { NEED_LABEL, PARTY_LABEL } from "@/lib/engine/weights";
import type { Need, Party, TripRequest } from "@/lib/types";

const PARTY_PHRASE: Record<Party, string> = { solo: "solo", couple: "as a couple", friends: "with friends", family_kids: "with the kids", family_elders: "with my parents" };

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

    // "Plan a trip" from an upcoming trip window: no typing. The event becomes a plain-language request, the same AI
    // slot-filling as the chat reads the intent and party from it (rules fallback without a key), and the event's own
    // dates and destination are pinned. The client then calls "create" with these slots, exactly like the chat.
    if (body.action === "trigger") {
      const trig = (await userTriggers(uid, profile)).triggers.find((t) => t.key === body.key);
      if (!trig) throw new HttpError(404, "That trip window has passed");
      const usual = (profile.intents ?? []).map((i) => `${NEED_LABEL[i.need]} trips ${PARTY_PHRASE[i.party]}`).join(", ");
      const message = `Plan a trip for ${trig.title}: ${trig.body}${usual ? ` I usually enjoy ${usual}.` : ""}`;
      let ex = await extractSlots([{ role: "user", content: message }], {});
      // Without the AI, keyword rules would latch onto the "I usually enjoy…" hint; read only the event itself and let
      // the profile's top intent fill in whatever the event doesn't say.
      if (ex.engine === "rules") ex = { ...ex, slots: extractRules(`${trig.title.replace(/ in \d+ days?$/, "")}. ${trig.body}`, {}) };
      const w = nextWindow();
      const slots: Slots = {
        ...ex.slots,
        start: trig.when,
        days: trig.days ?? ex.slots.days ?? w.days,
        whenText: trig.title.replace(/ in \d+ days$/, ""),
        destId: trig.destId ?? ex.slots.destId ?? null,
        need: ex.slots.need ?? profile.intents?.[0]?.need ?? null,
        party: ex.slots.party ?? (trig.type === "personal" ? "couple" : profile.intents?.[0]?.party ?? profile.default_party),
      };
      const dest = slots.destId ? DEST_BY_ID.get(slots.destId)?.name : null;
      const reply = `Here are plans for ${slots.whenText}${dest ? ` in ${dest}` : ""}: ${slots.need ? NEED_LABEL[slots.need as Need] : "your usual"} trip, ${slots.party ? PARTY_LABEL[slots.party as Party].toLowerCase() : "your usual group"}, ${slots.days} days. Tell me if you want to change anything.`;
      await logSignal(uid, sid, "trigger_plan", "stated", { key: trig.key, slots, engine: ex.engine });
      return { slots, messages: [{ role: "user", content: message }, { role: "assistant", content: reply }], engine: ex.engine };
    }

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
      // No budget unless the user named one in this chat: show the best options, not ones capped by the profile budget.
      const budgetPP = prev.budgetPP ?? null;
      const need = prev.need ?? (assumed.push("need"), profile.intents?.[0]?.need ?? "explore");
      const tr: TripRequest = {
        need, secondaryNeed: prev.secondaryNeed ?? null, party, pax,
        window: { start, days, label: prev.whenText ?? w.label }, budgetPP, diet: prev.diet ?? null, destId: prev.destId ?? null,
        assumed, extraDealbreakers: prev.dealbreakers ?? [],
      };
      const r = await runPlans(uid, sid, profile, tr, "chat", { disabled: body.disabled ?? [] });
      await logSignal(uid, sid, "chat_create", "stated", { slots: prev, assumed });
      return { ...r, assumedText: assumed.map((a) => ({ who: `${pax.adults + pax.kids + pax.seniors} travellers (${party.replace("_", " ")})`, when: `${days} days, ${w.label}`, budget: budgetPP ? `₹${budgetPP.toLocaleString("en-IN")} per person` : "no budget limit", need: need })[a as "who"]) };
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
