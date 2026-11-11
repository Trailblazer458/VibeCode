// Profile building: yes/no experience onboarding, persona, intents, and learning from choices and edits.
import type { Need, Party } from "../types";
import { NEED_LABEL } from "./weights";

/**
 * Onboarding is a run of single experiences, each answered Yes or No. One clear signal per card, instead of a forced
 * choice between two scenes the user may like (or dislike) equally. Each card moves the dimensions and need states it
 * stands for: a Yes applies the full effect, a No pushes the other way at half strength (not wanting a dawn trek says
 * less than wanting one). Skipped cards say nothing.
 */
export interface ExperienceCard {
  id: string;
  label: string;
  img: string;
  emoji: string;
  dimension: string;
  dims: Record<string, number>;
  needs: Partial<Record<Need, number>>;
}

export const NO_WEIGHT = 0.5;

export const CARDS: ExperienceCard[] = [
  { id: "c01", label: "A slow breakfast on the porch, nowhere to be", img: "/onboarding/p01a.jpg", emoji: "☕", dimension: "Pace", dims: { pace: -0.2 }, needs: { rest: 0.3 } },
  { id: "c02", label: "Headlamps on, the trek starts at dawn", img: "/onboarding/p01b.jpg", emoji: "🥾", dimension: "Pace", dims: { pace: 0.2, nature: 0.1 }, needs: { thrill: 0.3, escape: 0.1 } },
  { id: "c03", label: "An empty beach and one chair", img: "/onboarding/p02a.jpg", emoji: "🏝️", dimension: "Social", dims: { social: -0.2 }, needs: { rest: 0.15, escape: 0.15 } },
  { id: "c04", label: "A glowing, crowded night market", img: "/onboarding/p02b.jpg", emoji: "🏮", dimension: "Social", dims: { social: 0.2, food: 0.1 }, needs: { explore: 0.2, celebrate: 0.1 } },
  { id: "c05", label: "Waking up in a heritage haveli courtyard", img: "/onboarding/p03a.jpg", emoji: "🏛️", dimension: "Culture", dims: { novelty: 0.15 }, needs: { explore: 0.25, learn: 0.1 } },
  { id: "c06", label: "A tent under the stars", img: "/onboarding/p04a.jpg", emoji: "⛺", dimension: "Comfort", dims: { comfort: -0.2, nature: 0.15 }, needs: { thrill: 0.15, escape: 0.15 } },
  { id: "c07", label: "No fixed plan, just an open map", img: "/onboarding/p06b.jpg", emoji: "🧭", dimension: "Spontaneity", dims: { control: 0.2, novelty: 0.1 }, needs: { explore: 0.15 } },
  { id: "c08", label: "Dinner at a street stall at dusk", img: "/onboarding/p07a.jpg", emoji: "🍢", dimension: "Food", dims: { food: 0.2, luxury: -0.1 }, needs: { explore: 0.2 } },
  { id: "c09", label: "A chef-plated fine-dining evening", img: "/onboarding/p07b.jpg", emoji: "🍽️", dimension: "Luxury", dims: { luxury: 0.2 }, needs: { indulge: 0.2, celebrate: 0.15 } },
  { id: "c10", label: "A misty valley outside your window", img: "/onboarding/p08a.jpg", emoji: "🌄", dimension: "Nature", dims: { nature: 0.2 }, needs: { escape: 0.25 } },
  { id: "c11", label: "White-water rafting this afternoon", img: "/onboarding/p09a.jpg", emoji: "🛶", dimension: "Thrill", dims: { pace: 0.15 }, needs: { thrill: 0.35 } },
  { id: "c12", label: "An infinity pool and a spa evening", img: "/onboarding/p10a.jpg", emoji: "💆", dimension: "Indulgence", dims: { luxury: 0.2, comfort: 0.15 }, needs: { indulge: 0.3, rest: 0.1 } },
  { id: "c13", label: "Dawn aarti at the ghats", img: "/onboarding/p11a.jpg", emoji: "🪔", dimension: "Spiritual", dims: { spiritual: 0.25 }, needs: { reflect: 0.35 } },
  { id: "c14", label: "A beach bonfire with friends", img: "/onboarding/p11b.jpg", emoji: "🔥", dimension: "Celebration", dims: { social: 0.15 }, needs: { celebrate: 0.3, reconnect: 0.1 } },
  { id: "c15", label: "Fresh snowfall in a pine forest", img: "/onboarding/p12a.jpg", emoji: "❄️", dimension: "Climate", dims: { climate: -0.25 }, needs: { escape: 0.2 } },
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
  answers: { card_id: string; choice: "yes" | "no" }[],
  parties: Party[],
) {
  const dims: Record<string, number> = { pace: 0.5, social: 0.5, novelty: 0.5, comfort: 0.5, control: 0.5, food: 0.5, nature: 0.5, luxury: 0.5, spiritual: 0.5, climate: 0.5 };
  const needs: Record<string, number> = { rest: 0.3, reconnect: 0.3, explore: 0.3, thrill: 0.3, celebrate: 0.3, reflect: 0.2, indulge: 0.25, escape: 0.3, learn: 0.15 };
  for (const a of answers) {
    const card = CARDS.find((c) => c.id === a.card_id);
    if (!card) continue;
    const k = a.choice === "yes" ? 1 : -NO_WEIGHT;
    for (const [d, v] of Object.entries(card.dims)) dims[d] = clamp((dims[d] ?? 0.5) + v * k);
    for (const [n, v] of Object.entries(card.needs)) needs[n] = clamp((needs[n] ?? 0.3) + (v as number) * k);
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

/**
 * Engagement learning: a like (weight 1) or save (1.5) on a trip nudges the profile towards it; undoing it passes the
 * negative weight. Need affinity moves 0.05 per unit, the four style dims move towards the trip's character, and if
 * the liked need now beats one of the top three intents it replaces the weakest (existing intents keep their party).
 */
export function engagementUpdate(
  p: { dims: Record<string, number>; need_affinity: Record<string, number>; intents: { need: Need; party: Party; score: number }[]; default_party: Party },
  ev: { need: Need; attrs?: Record<string, number | string> },
  weight: number,
) {
  const na = { ...p.need_affinity, [ev.need]: clamp((p.need_affinity[ev.need] ?? 0.3) + 0.05 * weight, 0, 1) };
  const dims = { ...p.dims };
  const changes: string[] = [];
  if (ev.attrs) {
    for (const [dim, attr] of [["social", "nightlife"], ["comfort", "comfort"], ["nature", "nature"], ["luxury", "luxury"]] as const) {
      const v = Number(ev.attrs[attr]);
      if (!Number.isFinite(v) || Math.abs(v - 0.5) < 0.1) continue;
      dims[dim] = clamp((dims[dim] ?? 0.5) + 0.04 * weight * Math.sign(v - 0.5));
      changes.push(`${dim} ${weight * (v - 0.5) > 0 ? "↑" : "↓"}`);
    }
  }
  // Keep existing intents (and their parties); swap in the liked need only when it now outranks the weakest one.
  const intents = (p.intents ?? []).map((i) => ({ ...i, score: na[i.need] ?? i.score }));
  if (!intents.some((i) => i.need === ev.need) && weight > 0 && intents.length) {
    const weakest = intents.reduce((m, i) => (i.score < m.score ? i : m), intents[0]);
    if ((na[ev.need] ?? 0) > weakest.score) {
      const parties = Array.from(new Set([...intents.map((i) => i.party), p.default_party]));
      const party = PARTY_FOR_NEED[ev.need].find((x) => parties.includes(x)) ?? p.default_party;
      intents.splice(intents.indexOf(weakest), 1, { need: ev.need, party, score: na[ev.need] });
      changes.push(`new For You row: ${ev.need}`);
    }
  }
  return { dims, need_affinity: na, intents, changes };
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
