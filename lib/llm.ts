// Grok (xAI) client + slot filling for "Plan with me". The LLM only extracts structured slots and phrases
// questions/explanations; it never picks hotels. A rule-based extractor keeps the flow working without a key.
import { DESTINATIONS } from "./data/catalog";
import { NEEDS, PARTIES, type Diet, type Need, type Party } from "./types";

export const MODEL = process.env.XAI_MODEL || "grok-4-fast-non-reasoning";

export function llmEnabled() {
  return !!process.env.XAI_API_KEY;
}

export async function grok(messages: { role: "system" | "user" | "assistant"; content: string }[], json = true, timeoutMs = 15000) {
  if (!process.env.XAI_API_KEY) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, ...(json ? { response_format: { type: "json_object" } } : {}) }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error("grok error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    if (!json) return text;
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (e) {
    console.error("grok failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------------- slot filling ----------------

export interface Slots {
  need?: Need | null;
  secondaryNeed?: Need | null;
  party?: Party | null;
  adults?: number | null;
  kids?: number | null;
  seniors?: number | null;
  pets?: number | null;
  budgetPP?: number | null;
  days?: number | null;
  start?: string | null;
  whenText?: string | null;
  diet?: Diet | null;
  destId?: string | null;
  mood?: string | null;
  dealbreakers?: { attribute: string; label: string; kind: "hard" | "soft" }[];
}

// Budget is optional: without one, plans are ranked on fit alone. It's only applied when the user names an amount.
export const REQUIRED: (keyof Slots)[] = ["days", "party"];

/** "Budget is flexible", "no budget", "money's not an issue": clear any budget, show the best options. */
export const FLEXIBLE_BUDGET = /(budget|money|price|cost|spend)\b.{0,25}\b(flexible|open|no (bar|limit|issue|constraint|problem)|(is|'s) not an? (issue|concern|problem)|doesn'?t matter|whatever)|\b(flexible|open|no|any|unlimited)\s+budget\b|\bno (budget|price) (limit|cap|constraint)/i;

const DB_PHRASES: [RegExp, string, string][] = [
  [/(no|avoid|hate|not).{0,20}(long (drive|road)|road trip|long journey|bus)/i, "long_road", "No long road journeys"],
  [/(no|avoid|hate).{0,10}hostel/i, "hostel", "No hostels"],
  [/(no|avoid|hate).{0,15}(early|morning start|5am|6am)/i, "early_start", "No early starts"],
  [/(avoid|no|hate|not).{0,15}crowd/i, "crowded", "Avoid crowded spots"],
  [/(nothing|not|no).{0,15}(tiring|strenuous|trek|hike|climb)/i, "strenuous", "Nothing strenuous"],
  [/(no|avoid|hate).{0,15}(red.?eye|night flight|late flight)/i, "red_eye", "No red-eye flights"],
  [/(no|avoid|not).{0,15}(party|parties|clubbing|nightlife)/i, "party_scene", "Skip the party scene"],
  [/(no|avoid).{0,15}(camp|tent)/i, "camp", "No camps or tents"],
];

export function extractRules(text: string, prev: Slots, today = new Date()): Slots {
  const s: Slots = { ...prev, dealbreakers: [...(prev.dealbreakers ?? [])] };
  const t = text.toLowerCase();
  const num = (w: string) => ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1 } as Record<string, number>)[w] ?? Number(w);

  // party
  if (/\b(parents|mom|dad|mother|father|in-laws|grandparents|nani|dadi)\b/.test(t)) s.party = "family_elders";
  else if (/\b(kids?|children|son|daughter|toddler|baby)\b/.test(t)) s.party = "family_kids";
  else if (/\b(wife|husband|partner|girlfriend|boyfriend|fianc|anniversary|honeymoon|couple)\b/.test(t)) s.party = "couple";
  else if (/\b(friends|gang|buddies|bros|squad|colleagues|group)\b/.test(t)) s.party = "friends";
  else if (/\b(alone|solo|by myself|just me)\b/.test(t)) s.party = "solo";
  const kidsN = t.match(/(\d|one|two|three)\s+kids?/);
  if (kidsN) s.kids = num(kidsN[1]);
  const friendsN = t.match(/(\d+|three|four|five|six)\s+(of us|friends|people)/);
  if (friendsN) s.adults = num(friendsN[1]);
  if (/\b(dog|cat|pet|puppy)\b/.test(t)) s.pets = 1;

  // need state (mood words map to need states, never stored as mood)
  const needRules: [RegExp, Need][] = [
    [/(burn(ed|t)? out|exhausted|tired|relax|unwind|rest|slow|chill|peace|sleep)/, "rest"],
    [/(rafting|trek|adventure|adrenaline|thrill|bungee|paraglid|scuba|safari|wildlife)/, "thrill"],
    [/(temple|pilgrim|darshan|spiritual|aarti|ghat|gurudwara|meditat)/, "reflect"],
    [/(anniversary|birthday|celebrat|honeymoon|bachelor|milestone)/, "celebrate"],
    [/(heritage|history|explore|culture|food trail|street food|museum|fort)/, "explore"],
    [/(luxury|spa|pamper|fine dining|5.?star|indulge)/, "indulge"],
    [/(escape|get away|getaway|heat|change of scene|snow|hills|mountains)/, "escape"],
    [/(workcation|photograph|workshop|learn|wifi|work from)/, "learn"],
    [/(catch up|reconnect|quality time|bond|reunion)/, "reconnect"],
  ];
  const found = needRules.filter(([r]) => r.test(t)).map(([, n]) => n);
  if (found.length) {
    s.need = found[0];
    if (found[1]) s.secondaryNeed = found[1];
  }
  const mood = t.match(/(burn(ed|t)? out|exhausted|stressed|bored|excited|tired)/);
  if (mood) s.mood = mood[1];

  // budget
  const k = t.match(/(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(k|thousand|l|lakh)\b/);
  const plain = t.match(/(?:₹|rs\.?|inr)\s*(\d{4,6})|\b(\d{4,6})\s*(?:rupees|rs|inr|budget|per (?:head|person))/);
  let budget: number | null = null;
  if (k) budget = parseFloat(k[1].replace(",", ".")) * (/(l|lakh)/.test(k[2]) ? 100000 : 1000);
  else if (plain) budget = Number(plain[1] ?? plain[2]);
  if (FLEXIBLE_BUDGET.test(t)) s.budgetPP = null;
  else if (budget) {
    const total = /(total|overall|for (all|everyone|us|the family))/.test(t);
    const ppl = Math.max(1, (s.adults ?? 0) + (s.kids ?? 0) + (s.seniors ?? 0) || defaultHeads(s.party ?? null));
    s.budgetPP = total ? Math.round(budget / ppl) : budget;
  }

  // when / days
  const d = t.match(/\b(\d|one|two|three|four|five|six)\s*(days?|nights?)\b/);
  if (d) s.days = num(d[1]) + (/night/.test(d[2]) ? 1 : 0);
  if (/long weekend/.test(t)) { s.whenText = "next long weekend"; s.days ??= 3; }
  else if (/this weekend|weekend/.test(t)) { s.whenText ??= "this weekend"; s.days ??= 2; }
  if (/next month/.test(t)) s.whenText = "next month";
  if (/christmas/.test(t)) { s.start = `${today.getFullYear()}-12-25`; s.days ??= 3; s.whenText = "Christmas weekend"; }
  if (/republic day/.test(t)) { s.start = `${today.getFullYear() + 1}-01-23`; s.days ??= 4; s.whenText = "Republic Day weekend"; }
  if (/diwali/.test(t)) s.whenText = "Diwali";

  // diet
  if (/\bjain\b/.test(t)) s.diet = "jain";
  else if (/(pure veg|vegetarian|\bveg\b|satvik)/.test(t)) s.diet = "veg";

  // destination
  for (const dest of DESTINATIONS) {
    const names = [dest.name.toLowerCase(), dest.id];
    if (dest.id === "goa") names.push("goa");
    if (dest.id === "corbett") names.push("corbett");
    if (names.some((n) => t.includes(n))) s.destId = dest.id;
  }

  for (const [re, attr, label] of DB_PHRASES) {
    if (re.test(text) && !s.dealbreakers!.some((x) => x.attribute === attr)) s.dealbreakers!.push({ attribute: attr, label, kind: "hard" });
  }
  return s;
}

export function defaultHeads(p: Party | null) {
  return p === "solo" ? 1 : p === "couple" ? 2 : p === "family_kids" ? 4 : p === "family_elders" ? 3 : 4;
}

const SYSTEM = `You are the slot-filling layer of a travel planner for Indian leisure travellers (origin Delhi NCR).
Read the conversation and return ONLY a JSON object:
{"slots": {"need": one of [${NEEDS.join(", ")}] or null, "secondaryNeed": same or null,
 "party": one of [${PARTIES.join(", ")}] or null, "adults": int|null, "kids": int|null, "seniors": int|null, "pets": int|null,
 "budgetPP": INR per person int|null — ONLY when the user states an amount (convert totals to per person; "30k" = 30000); null if they say it's flexible or don't mention money, "days": int|null,
 "whenText": short phrase like "next long weekend"|null, "diet": one of [none, nonveg, eggetarian, veg, jain]|null,
 "destId": one of [${DESTINATIONS.map((d) => d.id).join(", ")}]|null,
 "mood": short word|null,
 "dealbreakers": [{"attribute": one of [long_road, hostel, early_start, crowded, strenuous, red_eye, party_scene, camp, rustic, fixed_schedule], "label": short text, "kind": "hard"|"soft"}]},
 "reply": a short, warm question (max 20 words) asking ONLY for missing required slots (days/when, who) — combine them in one question; never ask about budget; if nothing required is missing, say you're ready to build plans,
 "chips": up to 4 short tappable answers for that question}
Map feelings to need states (burnt out → rest; bored → explore or thrill). "With parents" → family_elders. Never invent destinations or hotels.`;

export async function extractSlots(history: { role: "user" | "assistant"; content: string }[], prev: Slots) {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const rules = extractRules(lastUser, prev);
  const out = await grok([{ role: "system", content: SYSTEM }, { role: "user", content: `Known slots so far: ${JSON.stringify(prev)}\n\nConversation:\n${history.map((m) => `${m.role}: ${m.content}`).join("\n")}` }]);
  if (!out?.slots) return { slots: rules, reply: null as string | null, chips: null as string[] | null, engine: "rules" as const };
  const merged: Slots = { ...rules };
  for (const [k, v] of Object.entries(out.slots as Slots)) {
    if (v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
    if (k === "dealbreakers") {
      const arr = [...(merged.dealbreakers ?? [])];
      for (const d of v as Slots["dealbreakers"] & object) if (!arr.some((x) => x.attribute === d.attribute)) arr.push(d);
      merged.dealbreakers = arr;
    } else (merged as Record<string, unknown>)[k] = v;
  }
  if (FLEXIBLE_BUDGET.test(lastUser)) merged.budgetPP = null;
  if (merged.need && !NEEDS.includes(merged.need)) merged.need = rules.need ?? null;
  if (merged.party && !PARTIES.includes(merged.party)) merged.party = rules.party ?? null;
  return { slots: merged, reply: typeof out.reply === "string" ? out.reply : null, chips: Array.isArray(out.chips) ? out.chips.slice(0, 4) : null, engine: "grok" as const };
}

export function missingRequired(s: Slots) {
  const m: string[] = [];
  if (!s.days && !s.whenText && !s.start) m.push("when");
  if (!s.party) m.push("who");
  return m;
}

export function templateQuestion(missing: string[]) {
  const parts: string[] = [];
  if (missing.includes("who")) parts.push("who's coming");
  if (missing.includes("when")) parts.push("when (or how many days)");
  const chips: string[] = [];
  if (missing.includes("who")) chips.push("Just me", "With my partner", "Friends, 4 of us", "With my parents");
  else chips.push("Next long weekend", "This weekend", "4 days in December");
  return { reply: `Got it. Tell me ${parts.join(", ").replace(/, ([^,]*)$/, " and $1")}?`, chips: chips.slice(0, 4) };
}
