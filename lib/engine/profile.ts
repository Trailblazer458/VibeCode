// Profile building: swipe onboarding, persona, intents, and learning from choices and edits.
import type { Need, Party } from "../types";
import { NEED_LABEL } from "./weights";

export interface OnboardingPair {
  id: string;
  question: string;
  dimension: string;
  a: { label: string; img: string; emoji: string; dims: Record<string, number>; needs: Partial<Record<Need, number>> };
  b: { label: string; img: string; emoji: string; dims: Record<string, number>; needs: Partial<Record<Need, number>> };
}

export const PAIRS: OnboardingPair[] = [
  { id: "p01", question: "Your first morning on holiday?", dimension: "Pace",
    a: { label: "Slow breakfast on the porch", img: "/onboarding/p01a.png", emoji: "☕", dims: { pace: -0.2 }, needs: { rest: 0.3 } },
    b: { label: "Headlamps on, trek starts at dawn", img: "/onboarding/p01b.png", emoji: "🥾", dims: { pace: 0.2 }, needs: { thrill: 0.3 } } },
  { id: "p02", question: "Pick your beach.", dimension: "Social density",
    a: { label: "Empty beach, one chair", img: "/onboarding/p02a.png", emoji: "🏝️", dims: { social: -0.2 }, needs: { rest: 0.15, escape: 0.15 } },
    b: { label: "Glowing, crowded night market", img: "/onboarding/p02b.png", emoji: "🏮", dims: { social: 0.2 }, needs: { explore: 0.2, celebrate: 0.1 } } },
  { id: "p03", question: "Where would you rather wake up?", dimension: "Stay style",
    a: { label: "Heritage haveli courtyard", img: "/onboarding/p03a.png", emoji: "🏛️", dims: { novelty: 0.15 }, needs: { explore: 0.2 } },
    b: { label: "Glass-walled boutique hotel", img: "/onboarding/p03b.png", emoji: "🏙️", dims: { comfort: 0.15 }, needs: { indulge: 0.2 } } },
  { id: "p04", question: "Tonight's bed?", dimension: "Comfort",
    a: { label: "Tent under the stars", img: "/onboarding/p04a.png", emoji: "⛺", dims: { comfort: -0.2, nature: 0.1 }, needs: { thrill: 0.15, escape: 0.15 } },
    b: { label: "Resort balcony, pool below", img: "/onboarding/p04b.png", emoji: "🛎️", dims: { comfort: 0.2 }, needs: { indulge: 0.15, rest: 0.15 } } },
  { id: "p05", question: "Which path do you take?", dimension: "Novelty",
    a: { label: "The busy hill-station high street", img: "/onboarding/p05a.png", emoji: "🚂", dims: { novelty: -0.2 }, needs: { reconnect: 0.15 } },
    b: { label: "The unmarked trail into the forest", img: "/onboarding/p05b.png", emoji: "🌲", dims: { novelty: 0.2 }, needs: { explore: 0.15, escape: 0.15 } } },
  { id: "p06", question: "How should the trip be planned?", dimension: "Control",
    a: { label: "Printed, hour-by-hour itinerary", img: "/onboarding/p06a.png", emoji: "🗓️", dims: { control: -0.2 }, needs: {} },
    b: { label: "An open map and a compass", img: "/onboarding/p06b.png", emoji: "🧭", dims: { control: 0.2 }, needs: { explore: 0.1 } } },
  { id: "p07", question: "Dinner tonight?", dimension: "Food",
    a: { label: "Street stall at dusk", img: "/onboarding/p07a.png", emoji: "🍢", dims: { food: 0.2, luxury: -0.1 }, needs: { explore: 0.2 } },
    b: { label: "Chef-plated fine dining", img: "/onboarding/p07b.png", emoji: "🍽️", dims: { luxury: 0.2 }, needs: { indulge: 0.15, celebrate: 0.15 } } },
  { id: "p08", question: "The view from your window?", dimension: "Nature vs city",
    a: { label: "Misty valley", img: "/onboarding/p08a.png", emoji: "🌄", dims: { nature: 0.2 }, needs: { escape: 0.2 } },
    b: { label: "City skyline at night", img: "/onboarding/p08b.png", emoji: "🌃", dims: { nature: -0.2 }, needs: { explore: 0.2 } } },
  { id: "p09", question: "This afternoon?", dimension: "Thrill",
    a: { label: "White-water rafting", img: "/onboarding/p09a.png", emoji: "🛶", dims: { pace: 0.15 }, needs: { thrill: 0.3 } },
    b: { label: "Hammock by a still lake", img: "/onboarding/p09b.png", emoji: "🧘", dims: { pace: -0.15 }, needs: { rest: 0.3 } } },
  { id: "p10", question: "Your evening hangout?", dimension: "Indulgence",
    a: { label: "Infinity pool and spa", img: "/onboarding/p10a.png", emoji: "💆", dims: { luxury: 0.2, social: -0.1 }, needs: { indulge: 0.3 } },
    b: { label: "Lively hostel common room", img: "/onboarding/p10b.png", emoji: "🎸", dims: { social: 0.2, luxury: -0.2 }, needs: { celebrate: 0.15, thrill: 0.1 } } },
  { id: "p11", question: "Which night stays with you?", dimension: "Reflect vs celebrate",
    a: { label: "Dawn aarti at the ghats", img: "/onboarding/p11a.png", emoji: "🪔", dims: { spiritual: 0.25 }, needs: { reflect: 0.35 } },
    b: { label: "Beach bonfire with friends", img: "/onboarding/p11b.png", emoji: "🔥", dims: { social: 0.15 }, needs: { celebrate: 0.3 } } },
  { id: "p12", question: "Which weather pulls you?", dimension: "Climate",
    a: { label: "Fresh snowfall, pine forest", img: "/onboarding/p12a.png", emoji: "❄️", dims: { climate: -0.25 }, needs: { escape: 0.2 } },
    b: { label: "Sunny beach, coconut palms", img: "/onboarding/p12b.png", emoji: "🌴", dims: { climate: 0.25 }, needs: { rest: 0.15, celebrate: 0.1 } } },
];

const PARTY_FOR_NEED: Record<Need, Party[]> = {
  rest: ["couple", "solo", "family_elders"],
  reconnect: ["family_kids", "couple", "family_elders"],
  explore: ["friends", "solo", "couple"],
  thrill: ["friends", "solo"],
  celebrate: ["couple", "friends"],
  reflect: ["family_elders", "solo"],
  indulge: ["couple", "solo"],
  escape: ["solo", "friends", "couple"],
  learn: ["solo"],
};

export function applyOnboarding(
  answers: { pair_id: string; choice: "a" | "b" }[],
  parties: Party[],
) {
  const dims: Record<string, number> = { pace: 0.5, social: 0.5, novelty: 0.5, comfort: 0.5, control: 0.5, food: 0.5, nature: 0.5, luxury: 0.5, spiritual: 0.5, climate: 0.5 };
  const needs: Record<string, number> = { rest: 0.3, reconnect: 0.3, explore: 0.3, thrill: 0.3, celebrate: 0.3, reflect: 0.2, indulge: 0.25, escape: 0.3, learn: 0.15 };
  for (const a of answers) {
    const pair = PAIRS.find((p) => p.id === a.pair_id);
    if (!pair) continue;
    const opt = pair[a.choice];
    for (const [k, v] of Object.entries(opt.dims)) dims[k] = clamp((dims[k] ?? 0.5) + v);
    for (const [k, v] of Object.entries(opt.needs)) needs[k] = clamp((needs[k] ?? 0.3) + (v as number));
  }
  const ps = parties.length ? parties : (["friends"] as Party[]);
  if (ps.includes("family_elders")) needs.reflect = clamp(needs.reflect + 0.1);
  if (ps.includes("couple")) needs.celebrate = clamp(needs.celebrate + 0.05);
  const intents = deriveIntents(needs, ps);
  return { dims, needs, intents, persona: personaFor(dims, needs) };
}

export function deriveIntents(needs: Record<string, number>, parties: Party[]) {
  const sorted = Object.entries(needs).sort((a, b) => b[1] - a[1]);
  const out: { need: Need; party: Party; score: number }[] = [];
  for (const [n, score] of sorted) {
    const prefs = PARTY_FOR_NEED[n as Need];
    const party = prefs.find((p) => parties.includes(p)) ?? parties[0];
    if (out.some((o) => o.need === n)) continue;
    out.push({ need: n as Need, party, score });
    if (out.length === 3) break;
  }
  return out;
}

export function personaFor(dims: Record<string, number>, needs: Record<string, number>) {
  const top = Object.entries(needs).sort((a, b) => b[1] - a[1])[0][0] as Need;
  const noun: Record<Need, string> = {
    rest: "Recharger", reconnect: "Connector", explore: "Explorer", thrill: "Thrill-seeker", celebrate: "Celebrator",
    reflect: "Seeker", indulge: "Indulger", escape: "Escapist", learn: "Maker",
  };
  const adj = dims.pace > 0.6 ? "Spirited" : dims.pace < 0.4 ? "Slow" : dims.social > 0.6 ? "Social" : dims.nature > 0.6 ? "Wild" : dims.luxury > 0.6 ? "Refined" : "Curious";
  return `The ${adj} ${noun[top]}`;
}

export function personaBlurb(dims: Record<string, number>, needs: Record<string, number>) {
  const bits: string[] = [];
  bits.push(dims.pace > 0.6 ? "packed days" : dims.pace < 0.4 ? "an unhurried pace" : "a balanced pace");
  bits.push(dims.social > 0.6 ? "lively places" : dims.social < 0.4 ? "quiet corners" : "a mix of buzz and calm");
  if ((dims.food ?? 0.5) > 0.6) bits.push("street food");
  if ((dims.nature ?? 0.5) > 0.6) bits.push("mountains and forests");
  if ((dims.luxury ?? 0.5) > 0.6) bits.push("a little luxury");
  const tops = Object.entries(needs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => NEED_LABEL[n as Need].toLowerCase());
  return `You lean towards ${bits.join(", ")}. Trips that ${tops.join(" and ")} suit you most.`;
}

export function clamp(v: number, lo = 0.05, hi = 0.95) {
  return Math.max(lo, Math.min(hi, v));
}

/** Contrastive learning: move dimensions towards the chosen plan's attributes relative to the rejected ones. */
export function contrastiveUpdate(dims: Record<string, number>, chosen: Record<string, number | string>, rejected: Record<string, number | string>[]) {
  const map: [string, string, number][] = [
    ["pace", "pace", 0.5],
    ["social", "nightlife", 1],
    ["comfort", "comfort", 1],
    ["nature", "nature", 1],
    ["luxury", "luxury", 1],
  ];
  const next = { ...dims };
  const changes: string[] = [];
  for (const r of rejected) {
    for (const [dim, attr, scale] of map) {
      const diff = (Number(chosen[attr]) - Number(r[attr])) * scale;
      if (Math.abs(diff) < 0.15) continue;
      next[dim] = clamp((next[dim] ?? 0.5) + Math.sign(diff) * 0.03);
      changes.push(`${dim} ${diff > 0 ? "↑" : "↓"}`);
    }
  }
  return { dims: next, changes: Array.from(new Set(changes)) };
}

/** Reason chips: only offered when the choice doesn't explain itself (the plans differ on several things). */
export function reasonChips(chosen: { attrs: Record<string, number | string>; cost: { perHead: number }; destId: string }, rejected: { attrs: Record<string, number | string>; cost: { perHead: number }; destId: string }[], pastDestIds: string[]) {
  const chips = new Set<string>();
  let dims = 0;
  for (const r of rejected) {
    let local = 0;
    if (r.cost.perHead > chosen.cost.perHead * 1.15) { chips.add("Too pricey"); local++; }
    if (Number(r.attrs.transit) > Number(chosen.attrs.transit) + 1.5) { chips.add("Too much travel"); local++; }
    if (Number(r.attrs.pace) > Number(chosen.attrs.pace) + 0.4) { chips.add("Too packed"); local++; }
    if (Number(r.attrs.crowd) > Number(chosen.attrs.crowd) + 0.15) { chips.add("Too crowded"); local++; }
    if (Number(r.attrs.nightlife) > Number(chosen.attrs.nightlife) + 0.2) { chips.add("Too much party scene"); local++; }
    if (Number(r.attrs.comfort) < Number(chosen.attrs.comfort) - 0.2) { chips.add("Too basic"); local++; }
    if (pastDestIds.includes(r.destId)) { chips.add("Been there already"); local++; }
    dims = Math.max(dims, local);
  }
  chips.add("Not right for this group");
  return { ambiguous: dims >= 2 || chips.size > 3, chips: [...chips].slice(0, 5) };
}

export const CHIP_TO_DEALBREAKER: Record<string, { attribute: string; label: string } | null> = {
  "Too crowded": { attribute: "crowded", label: "Avoid crowded spots" },
  "Too much party scene": { attribute: "party_scene", label: "Skip the party scene" },
  "Too much travel": { attribute: "long_road", label: "Keep travel time short" },
  "Too packed": { attribute: "strenuous", label: "Nothing too strenuous" },
  "Too basic": { attribute: "rustic", label: "Avoid basic, rustic stays" },
  "Too pricey": null,
  "Been there already": null,
  "Not right for this group": null,
};
