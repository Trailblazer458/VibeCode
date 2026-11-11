import { nextWindow } from "@/lib/engine/triggers";
import { DEFAULT_PAX } from "@/lib/engine/plan";
import { extractRules, extractSlots, missingRequired, templateQuestion, type Slots } from "@/lib/llm";
import { handle, HttpError, logSignal, requireUser, runPlans, userTriggers } from "@/lib/server";
import { DEST_BY_ID } from "@/lib/data/catalog";
import { NEED_LABEL } from "@/lib/engine/weights";
import type { Need, Party, TripRequest } from "@/lib/types";

const CHIP_NEED: Record<Need, string> = {
  rest: "Rest and recharge", reconnect: "Quality time", explore: "Explore culture and food", thrill: "An adventure",
  celebrate: "Celebrate", reflect: "A spiritual trip", indulge: "Indulge in luxury", escape: "Escape to the mountains", learn: "A workcation",
};
const CHIP_PARTY: Record<Party, string> = { solo: "solo", couple: "with my partner", friends: "with friends", family_kids: "with the kids", family_elders: "with my parents" };
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
      const when = trig.title.replace(/ in \d+ days?$/, "");
      // Best guess at intent and party, used only to order the suggestion chips. It is never shown or sent as the
      // user's words: the user answers the opener themselves (tap a chip or type), as in the normal chat.
      const usual = (profile.intents ?? []).map((i) => `${NEED_LABEL[i.need]} ${PARTY_PHRASE[i.party]}`).join(", ");
      let ex = await extractSlots([{ role: "user", content: `Upcoming: ${when}. ${trig.body}${usual ? ` Traveller's usual trips: ${usual}.` : ""}` }], {});
      if (ex.engine === "rules") ex = { ...ex, slots: extractRules(`${when}. ${trig.body}`, {}) };
      const guess = {
        need: (ex.slots.need ?? profile.intents?.[0]?.need ?? "rest") as Need,
        party: (ex.slots.party ?? (trig.type === "personal" ? "couple" : profile.intents?.[0]?.party ?? profile.default_party)) as Party,
      };
      const options = [guess, ...(profile.intents ?? [])].filter((o, i, all) => all.findIndex((x) => x.need === o.need && x.party === o.party) === i).slice(0, 4);
      const w = nextWindow();
      // Only what the event itself fixes: dates, length and (for destination events) the place.
      const slots: Slots = { start: trig.when, days: trig.days ?? w.days, whenText: when, destId: trig.destId ?? null };
      const dest = slots.destId ? DEST_BY_ID.get(slots.destId)?.name : null;
      const reply = `${when}${dest ? ` in ${dest}` : ""}: ${trig.body} I've set the dates. What kind of trip are you in the mood for, and who's coming? Tap a suggestion or tell me in your own words.`;
      await logSignal(uid, sid, "trigger_open", "stated", { key: trig.key, guess, engine: ex.engine });
      return { slots, reply, chips: options.map((o) => `${CHIP_NEED[o.need]} ${CHIP_PARTY[o.party]}`), engine: ex.engine };
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
