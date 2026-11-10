// The personalization engine: hard filters → aspect scores × intent weights → ranked elements →
// plan assembly (compatibility + budget) → readiness check → diverse set of ≥3 plans.
// Deterministic code ranks; the LLM only extracts slots and phrases explanations.
import { ACTIVITIES, DEST_BY_ID, DESTINATIONS, FOOD, STAYS, TRANSPORT } from "../data/catalog";
import type {
  Activity, Aspect, Destination, Diet, Food, Item, Need, Party, PartyComp, Plan, ReadinessCheck, Stay, Transport, TripRequest,
} from "../types";
import { ScoreStore } from "./store";
import { itemTags, TAG_LABEL } from "./tags";
import { ASPECT_LABEL, NEED_LABEL, PACE, PARTY_LABEL, TRANSIT_TOLERANCE, weightsFor } from "./weights";

export interface EffectiveDealbreaker {
  attribute: string;
  label: string;
  kind: "hard" | "soft";
  owner: "you" | "group" | "assumed" | "intent";
  constraintId?: string;
  ownerIsYou?: boolean;
}

export interface MemberLens { dims: Record<string, number>; weight: number }

export interface EngineContext {
  store: ScoreStore;
  dims: Record<string, number>;
  dealbreakers: EffectiveDealbreaker[];
  pastDestIds: string[];
  diet: Diet;
  signalCount: number;
  sessionBoost?: Record<string, number>;
  disabled?: string[]; // filter keys switched off (soft) or previewed (hard)
  members?: MemberLens[]; // group planning
  votes?: Record<string, { likes: number; vetoes: number }>;
  isGroup?: boolean;
  today?: Date;
}

export interface CriteriaItem {
  key: string;
  label: string;
  kind: "hard" | "soft";
  source: "you" | "group" | "assumed" | "intent" | "trip";
  hidden: number; // trip options removed by this criterion
  enabled: boolean;
  constraintId?: string;
  ownerIsYou?: boolean;
}

export interface PlanResult {
  plans: Plan[];
  criteria: CriteriaItem[];
  uncertainty: number;
  nPlans: number;
  candidates: number;
  weights: Record<string, number>;
}

const DIET_RANK: Record<Diet, number> = { none: 0, nonveg: 0, eggetarian: 1, veg: 2, jain: 3 };
export function strictestDiet(diets: (Diet | string | null | undefined)[]): Diet {
  let best: Diet = "none";
  for (const d of diets) if (d && DIET_RANK[d as Diet] > DIET_RANK[best]) best = d as Diet;
  return best;
}

export const DEFAULT_PAX: Record<Party, PartyComp> = {
  solo: { adults: 1, kids: 0, seniors: 0, pets: 0 },
  couple: { adults: 2, kids: 0, seniors: 0, pets: 0 },
  friends: { adults: 4, kids: 0, seniors: 0, pets: 0 },
  family_kids: { adults: 2, kids: 2, seniors: 0, pets: 0 },
  family_elders: { adults: 1, kids: 0, seniors: 2, pets: 0 },
};

const sigmoidPct = (x: number) => Math.round(100 / (1 + Math.exp(-12 * x)));

function heads(p: PartyComp) {
  return p.adults + p.kids + p.seniors;
}
function payers(p: PartyComp) {
  return p.adults + p.seniors + p.kids * 0.6;
}

/** Fit of one item under weights W: weighted, centred aspect scores normalised by total weight. */
export function itemFit(aspects: Record<string, number>, W: Record<string, number>) {
  let raw = 0;
  let norm = 0;
  const contrib: { aspect: Aspect; v: number }[] = [];
  for (const [a, w] of Object.entries(W)) {
    if (!w) continue;
    norm += Math.abs(w);
    const s = aspects[a];
    if (s === undefined) continue;
    const c = w * (s - 0.5);
    raw += c;
    contrib.push({ aspect: a as Aspect, v: c });
  }
  contrib.sort((x, y) => y.v - x.v);
  return { x: norm ? raw / norm : 0, contrib };
}

export function roomsFor(party: Party, pax: PartyComp, stay: Stay): { label: string; units: number; ok: boolean; note?: string } {
  const n = heads(pax);
  const has = (r: Stay["rooms"][number]) => stay.rooms.includes(r);
  if (stay.type === "hostel" && party === "friends" && has("dorm")) return { label: `${n} beds in a private dorm`, units: n * 0.55, ok: true };
  switch (party) {
    case "solo":
      return { label: "1 room", units: stay.type === "hostel" ? 0.55 : 1, ok: true };
    case "couple":
      return has("double") || has("suite") ? { label: "1 double room", units: 1, ok: true } : { label: "No private double", units: 1, ok: false };
    case "friends":
      return { label: `${Math.ceil(n / 2)} twin/double rooms`, units: Math.ceil(n / 2), ok: has("double") };
    case "family_kids":
      if (has("family")) return { label: "1 family room (fits 2 adults + 2 kids)", units: 1.4, ok: true };
      if (has("connecting")) return { label: "2 connecting rooms", units: 2, ok: true };
      return { label: "2 separate rooms (no family or connecting rooms)", units: 2, ok: false, note: "Kids would sleep in a separate room" };
    case "family_elders":
      if (has("connecting")) return { label: `${Math.ceil(n / 2)} connecting rooms, ground floor requested`, units: Math.ceil(n / 2), ok: true };
      return { label: `${Math.ceil(n / 2)} rooms, ground floor requested`, units: Math.ceil(n / 2), ok: true };
  }
}

interface Scored<T extends Item> { item: T; x: number; aspects: Record<string, number>; tags: string[]; contrib: { aspect: Aspect; v: number }[] }

interface Built {
  plan: Plan;
  x: number;
  destId: string;
}

type Fail = { fail: string };

function month(start: string) {
  return new Date(start + "T00:00:00").getMonth();
}

export function buildPlans(req: TripRequest, ctx: EngineContext): PlanResult {
  const party = req.party;
  const pax = req.pax ?? DEFAULT_PAX[party];
  const W = groupWeights(req, ctx);
  const diet = strictestDiet([ctx.diet, req.diet]);
  const disabled = new Set(ctx.disabled ?? []);

  // ---- criteria (filters) ----
  const crit: (CriteriaItem & { test: Test })[] = [];
  const dbs: EffectiveDealbreaker[] = [...ctx.dealbreakers, ...(req.extraDealbreakers ?? []).map((d) => ({ ...d, owner: "you" as const }))];
  const seen = new Set<string>();
  for (const d of dbs) {
    const key = `tag:${d.attribute}`;
    if (!TAG_LABEL[d.attribute]) continue;
    if (seen.has(key)) {
      const ex = crit.find((c) => c.key === key);
      if (ex && d.kind === "hard" && ex.kind === "soft") Object.assign(ex, { kind: "hard", label: d.label });
      continue;
    }
    seen.add(key);
    crit.push({
      key, label: d.label, kind: d.kind, source: d.owner === "group" ? "group" : d.owner === "intent" ? "intent" : "you",
      hidden: 0, enabled: !disabled.has(key), constraintId: d.constraintId, ownerIsYou: d.ownerIsYou,
      test: { type: "tag", tag: d.attribute },
    });
  }
  const budgetLabel = `Budget ≤ ₹${req.budgetPP.toLocaleString("en-IN")} per person`;
  const budgetFromGroup = ctx.dealbreakers.find((d) => d.attribute === "budget");
  crit.unshift({
    key: "budget", label: budgetFromGroup?.label ?? budgetLabel, kind: "hard",
    source: budgetFromGroup ? "group" : req.assumed?.includes("budget") ? "assumed" : "you", hidden: 0,
    enabled: !disabled.has("budget"), constraintId: budgetFromGroup?.constraintId, ownerIsYou: budgetFromGroup?.ownerIsYou,
    test: { type: "budget" },
  });
  if (DIET_RANK[diet] >= 2) {
    const dietFromGroup = ctx.dealbreakers.find((d) => d.attribute === "diet_veg");
    crit.push({
      key: "diet", label: dietFromGroup?.label ?? (diet === "jain" ? "Jain food available" : "Vegetarian food available everywhere"),
      kind: "hard", source: dietFromGroup ? "group" : "you", hidden: 0, enabled: !disabled.has("diet"),
      constraintId: dietFromGroup?.constraintId, ownerIsYou: dietFromGroup?.ownerIsYou, test: { type: "diet", diet },
    });
  }
  const tol = TRANSIT_TOLERANCE[req.need] * (party === "family_elders" ? 0.85 : 1);
  const maxOneWay = (tol * req.window.days * 16) / 2;
  crit.push({
    key: "transit", label: `Travel ≤ ${maxOneWay.toFixed(1)}h each way (${Math.round(tol * 100)}% of a ${req.window.days}-day ${NEED_LABEL[req.need].toLowerCase()} trip)`,
    kind: "hard", source: "intent", hidden: 0, enabled: !disabled.has("transit"), test: { type: "transit", max: maxOneWay },
  });
  crit.push({ key: "season", label: "Good season for these dates", kind: "hard", source: "trip", hidden: 0, enabled: !disabled.has("season"), test: { type: "season" } });
  if (pax.pets > 0) crit.push({ key: "pets", label: "Pet-friendly stays", kind: "hard", source: "you", hidden: 0, enabled: !disabled.has("pets"), test: { type: "pets" } });
  if (party === "family_elders" || party === "family_kids") {
    crit.push({
      key: "pace", label: party === "family_elders" ? "Gentle activities for seniors" : "Activities suitable for kids", kind: "hard", source: "intent",
      hidden: 0, enabled: !disabled.has("pace"), test: { type: "intensity", max: party === "family_elders" ? 0.5 : 0.75 },
    });
  }
  if (ctx.votes) {
    const vetoed = Object.entries(ctx.votes).filter(([, v]) => v.vetoes > 0).map(([d]) => d);
    if (vetoed.length) crit.push({ key: "veto", label: "Vetoed by a member", kind: "hard", source: "group", hidden: 0, enabled: !disabled.has("veto"), test: { type: "veto", dests: vetoed } });
  }

  const dests = req.destId ? DESTINATIONS.filter((d) => d.id === req.destId) : DESTINATIONS.filter((d) => !req.excludeDestIds?.includes(d.id));
  const active = crit.filter((c) => c.enabled);

  const run = (filters: typeof crit, variants: boolean) => {
    const out: Built[] = [];
    for (const d of dests) {
      const r = planForDest(d, req, pax, W, diet, filters, ctx, variants);
      for (const b of r) if (!("fail" in b)) out.push(b);
    }
    return out;
  };

  const built = run(active, !!req.destId);
  const feasibleDests = new Set(built.map((b) => b.destId));
  // hidden counts: how many destinations would come back if this one criterion were relaxed
  for (const c of crit) {
    if (!c.enabled) {
      c.hidden = 0;
      continue;
    }
    const without = run(active.filter((x) => x.key !== c.key), false);
    c.hidden = new Set(without.map((b) => b.destId).filter((d) => !feasibleDests.has(d))).size;
  }

  // ---- uncertainty → number of plans ----
  let U = 0.15;
  if (ctx.signalCount < 12) U += 0.3;
  U += Math.min(0.3, (req.assumed?.length ?? 0) * 0.1);
  if (ctx.isGroup) U += 0.2;
  U = Math.min(1, U);
  const minN = req.minPlans ?? 3;
  const n = Math.max(minN, Math.min(req.maxPlans ?? 6, 3 + Math.round(U * 3)));

  // ---- diverse selection (maximal marginal relevance) ----
  const pool = [...built].sort((a, b) => b.x - a.x);
  const chosen: Built[] = [];
  while (chosen.length < n && pool.length) {
    let bestI = 0;
    let bestS = -Infinity;
    pool.forEach((c, i) => {
      const sim = chosen.length ? Math.max(...chosen.map((s) => similarity(c.plan, s.plan))) : 0;
      const s = c.x - 0.12 * sim;
      if (s > bestS) {
        bestS = s;
        bestI = i;
      }
    });
    chosen.push(pool.splice(bestI, 1)[0]);
  }
  // exploration option: make sure one plan goes somewhere the person hasn't been
  if (!req.destId && chosen.length >= 3 && chosen.every((c) => ctx.pastDestIds.includes(c.destId))) {
    const alt = pool.find((p) => !ctx.pastDestIds.includes(p.destId));
    if (alt) chosen[chosen.length - 1] = alt;
  }
  if (!req.destId) {
    const fresh = chosen.filter((c) => !ctx.pastDestIds.includes(c.destId));
    const lowest = fresh.sort((a, b) => a.x - b.x)[0];
    if (lowest && chosen.length >= 3) lowest.plan.exploration = true;
  }

  return {
    plans: chosen.sort((a, b) => b.x - a.x).map((c) => ({ ...c.plan, assumed: req.assumed })),
    criteria: crit.map(({ test: _t, ...c }) => c),
    uncertainty: U,
    nPlans: n,
    candidates: built.length,
    weights: W,
  };
}

type Test =
  | { type: "tag"; tag: string }
  | { type: "budget" }
  | { type: "diet"; diet: Diet }
  | { type: "transit"; max: number }
  | { type: "season" }
  | { type: "pets" }
  | { type: "intensity"; max: number }
  | { type: "veto"; dests: string[] };

function groupWeights(req: TripRequest, ctx: EngineContext) {
  if (!ctx.members?.length) return weightsFor(req.need, req.party, ctx.dims, req.secondaryNeed);
  const acc: Record<string, number> = {};
  let tw = 0;
  for (const m of ctx.members) {
    const w = weightsFor(req.need, req.party, m.dims, req.secondaryNeed);
    for (const [k, v] of Object.entries(w)) acc[k] = (acc[k] ?? 0) + v * m.weight;
    tw += m.weight;
  }
  for (const k of Object.keys(acc)) acc[k] /= tw;
  return acc as Record<Aspect, number>;
}

function similarity(a: Plan, b: Plan) {
  let s = a.destId === b.destId ? 0.6 : 0;
  if (a.stay.type === b.stay.type) s += 0.15;
  const ca = a.cost.perHead, cb = b.cost.perHead;
  s += 0.15 * (1 - Math.abs(ca - cb) / Math.max(ca, cb, 1));
  s += 0.1 * (1 - Math.min(1, Math.abs(Number(a.attrs.pace) - Number(b.attrs.pace)) / 2));
  return s;
}

function scoreList<T extends Item>(items: T[], lens: Party, W: Record<string, number>, store: ScoreStore): Scored<T>[] {
  return items.map((item) => {
    const aspects = store.aspects(item.id, lens);
    const { x, contrib } = itemFit(aspects, W);
    return { item, x, aspects, contrib, tags: itemTags(item, aspects) };
  });
}

function planForDest(
  dest: Destination,
  req: TripRequest,
  pax: PartyComp,
  W: Record<string, number>,
  diet: Diet,
  filters: { key: string; kind: "hard" | "soft"; test: Test; label: string }[],
  ctx: EngineContext,
  variants: boolean,
): (Built | Fail)[] {
  const { store } = ctx;
  const party = req.party;
  const hardTags = filters.filter((f) => f.kind === "hard" && f.test.type === "tag").map((f) => (f.test as { tag: string }).tag);
  const softTags = filters.filter((f) => f.kind === "soft" && f.test.type === "tag").map((f) => (f.test as { tag: string }).tag);
  const has = (t: Test["type"]) => filters.find((f) => f.test.type === t)?.test;
  const m = month(req.window.start);

  const vetoT = has("veto") as { dests: string[] } | undefined;
  if (vetoT && vetoT.dests.includes(dest.id)) return [{ fail: "veto" }];
  if (has("season") && dest.season[m] < 0.35) return [{ fail: "season" }];
  const destScored = scoreList([dest], party, W, store)[0];
  if (destScored.tags.some((t) => hardTags.includes(t))) return [{ fail: "dest_tag" }];

  const softPenalty = (tags: string[]) => tags.filter((t) => softTags.includes(t)).length * 0.08;
  const okTags = (tags: string[]) => !tags.some((t) => hardTags.includes(t));

  // transport
  const transitT = has("transit") as { max: number } | undefined;
  let transports = scoreList(TRANSPORT.filter((t) => t.destId === dest.id), party, W, store)
    .filter((t) => okTags(t.tags) && (!transitT || t.item.hours <= transitT.max));
  transports = transports.map((t) => ({ ...t, x: t.x - 0.012 * t.item.hours - softPenalty(t.tags) })).sort((a, b) => b.x - a.x);
  if (!transports.length) return [{ fail: "transport" }];

  // stays
  const dietT = has("diet") as { diet: Diet } | undefined;
  let stays = scoreList(STAYS.filter((s) => s.destId === dest.id), party, W, store).filter(
    (s) =>
      okTags(s.tags) &&
      (!has("pets") || s.item.petFriendly) &&
      (!dietT || (s.item.veg !== "limited" && (dietT.diet !== "jain" || s.item.jain))),
  );
  stays = stays.map((s) => ({ ...s, x: s.x - softPenalty(s.tags) })).sort((a, b) => b.x - a.x);
  if (!stays.length) return [{ fail: "stay" }];

  // food
  const foods = scoreList(FOOD.filter((f) => f.destId === dest.id), party, W, store)
    .filter((f) => okTags(f.tags) && (!dietT || (f.item.diet !== "nonveg_focus" && (dietT.diet !== "jain" || f.item.jain || f.item.diet === "veg_only"))))
    .map((f) => ({ ...f, x: f.x - softPenalty(f.tags) }))
    .sort((a, b) => b.x - a.x);

  // activities
  const intT = has("intensity") as { max: number } | undefined;
  const acts = scoreList(ACTIVITIES.filter((a) => a.destId === dest.id), party, W, store)
    .filter((a) => okTags(a.tags) && (!intT || a.item.intensity <= intT.max))
    .map((a) => ({ ...a, x: a.x - softPenalty(a.tags) }))
    .sort((a, b) => b.x - a.x);

  const days = req.window.days;
  const paceLevels = variants ? [PACE[req.need], Math.max(0.7, PACE[req.need] - 0.6), PACE[req.need] + 0.6] : [PACE[req.need]];
  const budgetT = has("budget");
  const out: (Built | Fail)[] = [];
  const combos: [Scored<Stay>, Scored<Transport>][] = [];
  for (const s of stays.slice(0, 3)) for (const t of transports.slice(0, 3)) combos.push([s, t]);
  combos.sort((a, b) => b[0].x * 0.6 + b[1].x * 0.4 - (a[0].x * 0.6 + a[1].x * 0.4));
  // add cheapest combo as a budget fallback
  const cheapS = [...stays].sort((a, b) => a.item.price - b.item.price)[0];
  const cheapT = [...transports].sort((a, b) => a.item.price - b.item.price)[0];
  combos.push([cheapS, cheapT]);

  const usedStay = new Set<string>();
  for (const pace of paceLevels) {
    const nActs = Math.min(acts.length, Math.max(1, Math.round(pace * Math.max(1, days - 1))));
    const pickedActs = acts.slice(0, nActs);
    const pickedFood = foods.slice(0, Math.min(3, Math.max(2, days)));
    let made = false;
    const ordered = variants ? [...combos.filter(([s]) => !usedStay.has(s.item.id)), ...combos.filter(([s]) => usedStay.has(s.item.id))] : combos;
    for (const [s, t] of ordered) {
      let p = assemble(dest, destScored, s, t, pickedFood, pickedActs, req, pax, diet, W, ctx, softTags, hardTags);
      if (budgetT && p.plan.cost.perHead > req.budgetPP) {
        // trim the priciest activities (keep at least one) and use the cheapest food picks before giving up on this combo
        let acts2 = [...pickedActs];
        let food2 = [...pickedFood];
        while (p.plan.cost.perHead > req.budgetPP && acts2.length > 1) {
          const priciest = acts2.reduce((m, a) => (a.item.price > m.item.price ? a : m), acts2[0]);
          if (priciest.item.price === 0) break;
          acts2 = acts2.filter((a) => a !== priciest);
          p = assemble(dest, destScored, s, t, food2, acts2, req, pax, diet, W, ctx, softTags, hardTags);
        }
        if (p.plan.cost.perHead > req.budgetPP && foods.length > 1) {
          food2 = [...foods].sort((a, b) => a.item.price - b.item.price).slice(0, pickedFood.length);
          p = assemble(dest, destScored, s, t, food2, acts2, req, pax, diet, W, ctx, softTags, hardTags);
        }
        if (p.plan.cost.perHead > req.budgetPP) continue;
      }
      out.push(p);
      usedStay.add(s.item.id);
      made = true;
      if (!variants) break;
      if (out.length >= 6) break;
      if (made && pace !== paceLevels[0]) break;
    }
    if (!made) out.push({ fail: "budget" });
    if (!variants) break;
  }
  return out;
}

function assemble(
  dest: Destination,
  d: Scored<Destination>,
  s: Scored<Stay>,
  t: Scored<Transport>,
  food: Scored<Food>[],
  acts: Scored<Activity>[],
  req: TripRequest,
  pax: PartyComp,
  diet: Diet,
  W: Record<string, number>,
  ctx: EngineContext,
  softTags: string[],
  hardTags: string[],
): Built {
  const days = req.window.days;
  const nights = Math.max(1, days - 1);
  const party = req.party;
  const rooms = roomsFor(party, pax, s.item);
  const n = heads(pax);
  const cars = Math.ceil(n / 5);
  const transportCost = t.item.mode === "self_drive" ? t.item.price * cars * 2 : Math.round(t.item.price * payers(pax) * 2);
  const stayCost = Math.round(s.item.price * rooms.units * nights);
  const avgFood = food.length ? food.reduce((a, f) => a + f.item.price, 0) / food.length : 500;
  const foodCost = Math.round(avgFood * payers(pax) * days * 2);
  const actCost = Math.round(acts.reduce((a, x) => a + x.item.price, 0) * payers(pax));
  const localCost = Math.round(dest.localPerDay * days * cars * (t.item.mode === "self_drive" ? 0.3 : 1));
  const total = transportCost + stayCost + foodCost + actCost + localCost;
  const perHead = Math.round(total / Math.max(1, n));

  const actMean = acts.length ? acts.reduce((a, x) => a + x.x, 0) / acts.length : 0;
  const foodMean = food.length ? food.reduce((a, x) => a + x.x, 0) / food.length : 0;
  const boost = ctx.sessionBoost?.[dest.id] ?? 0;
  const voteAdj = ctx.votes?.[dest.id] ? ctx.votes[dest.id].likes * 0.015 : 0;
  let x = 0.35 * d.x + 0.3 * s.x + 0.12 * t.x + 0.13 * actMean + 0.1 * foodMean + boost + voteAdj;

  const arrive = (t.item.depart + t.item.hours) % 24;
  const lateArrival = arrive >= 22 || arrive < 5;
  if (lateArrival) x -= 0.02;

  const readiness = checks(dest, d, s, t, food, acts, req, pax, diet, rooms, arrive, ctx, softTags, hardTags);

  const evidence: Plan["evidence"] = [];
  const why: string[] = [];
  const topStay = s.contrib.filter((c) => c.v > 0).slice(0, 2);
  if (topStay.length) {
    const agree = topStay.some((c) => ctx.store.snippets(s.item.id, c.aspect, party, W[c.aspect] > 0)[0]?.party === party);
    why.push(`${s.item.name}: ${describe(topStay, W)}${agree ? ` (${PARTY_LABEL[party].toLowerCase()} travellers who stayed agree)` : ""}`);
  }
  for (const c of topStay) {
    const sn = ctx.store.snippets(s.item.id, c.aspect, party, W[c.aspect] > 0, 1, 1)[0];
    if (sn && !evidence.some((e) => e.text === sn.snippet)) evidence.push({ text: sn.snippet, party: sn.party ?? "all", itemName: s.item.name });
  }
  const topDest = d.contrib.filter((c) => c.v > 0).slice(0, 2);
  if (topDest.length) why.unshift(`${dest.name}: ${describe(topDest, W)}, which matters most for a ${NEED_LABEL[req.need].toLowerCase()} trip ${({ solo: "on your own", couple: "as a couple", friends: "with friends", family_kids: "with kids", family_elders: "with your parents" } as Record<Party, string>)[party]}`);
  const topAct = acts[0];
  if (topAct) {
    const ta = topAct.contrib[0];
    if (ta && ta.v > 0) why.push(`${topAct.item.name}: picked for ${ASPECT_LABEL[ta.aspect]}`);
  }
  for (const a of acts.slice(0, 1)) {
    const c = a.contrib[0];
    if (!c) continue;
    const sn = ctx.store.snippets(a.item.id, c.aspect, party, true, 1, 1)[0];
    if (sn && !evidence.some((e) => e.text === sn.snippet)) evidence.push({ text: sn.snippet, party: sn.party ?? "all", itemName: a.item.name });
  }
  if (ctx.sessionBoost?.[dest.id]) why.push(`You spent time looking at ${dest.name} earlier`);

  const actsPerDay = acts.length / Math.max(1, days - 1);
  const id = [dest.id, s.item.id, t.item.id, req.need, req.party, acts.map((a) => a.item.id).join("+")].join("|");
  const plan: Plan = {
    id,
    title: `${NEED_LABEL[req.need]} in ${dest.name}`,
    need: req.need,
    party: req.party,
    pax,
    window: req.window,
    destId: dest.id,
    destName: dest.name,
    emoji: dest.emoji,
    hue: dest.hue,
    stay: { id: s.item.id, name: s.item.name, fit: sigmoidPct(s.x), price: s.item.price, type: s.item.type, area: s.item.area },
    transport: { id: t.item.id, name: t.item.name, fit: sigmoidPct(t.x), price: t.item.price, mode: t.item.mode, hours: t.item.hours, depart: t.item.depart },
    food: food.map((f) => ({ id: f.item.id, name: f.item.name, fit: sigmoidPct(f.x), price: f.item.price })),
    activities: acts.map((a, i) => ({ id: a.item.id, name: a.item.name, fit: sigmoidPct(a.x), price: a.item.price, day: 1 + (i % Math.max(1, days - 1)) + (days > 2 ? 0 : 0) })),
    rooms: rooms.label,
    cost: { transport: transportCost, stay: stayCost, food: foodCost, activities: actCost, local: localCost, total, perHead },
    fit: sigmoidPct(x),
    why,
    evidence,
    readiness,
    tags: Array.from(new Set([...s.tags, ...t.tags, ...acts.flatMap((a) => a.tags)])),
    attrs: {
      pace: Math.round(actsPerDay * 10) / 10,
      transit: t.item.hours,
      crowd: round2(d.aspects.crowd ?? 0.5),
      nightlife: round2(s.aspects.nightlife ?? 0.5),
      comfort: round2(s.aspects.comfort ?? 0.5),
      nature: round2(d.aspects.nature ?? 0.5),
      luxury: round2(s.aspects.luxury ?? 0.5),
      stayType: s.item.type,
    },
  };
  return { plan, x, destId: dest.id };
}

function checks(
  dest: Destination,
  d: Scored<Destination>,
  s: Scored<Stay>,
  t: Scored<Transport>,
  food: Scored<Food>[],
  acts: Scored<Activity>[],
  req: TripRequest,
  pax: PartyComp,
  diet: Diet,
  rooms: ReturnType<typeof roomsFor>,
  arrive: number,
  ctx: EngineContext,
  softTags: string[],
  hardTags: string[],
): ReadinessCheck[] {
  const out: ReadinessCheck[] = [];
  const party = req.party;
  const days = req.window.days;
  const share = (t.item.hours * 2) / (days * 16);
  const tol = TRANSIT_TOLERANCE[req.need] * (party === "family_elders" ? 0.85 : 1);
  out.push({
    key: "transit", label: "Door-to-door time",
    status: share <= tol ? "ok" : share <= tol * 1.2 ? "warn" : "fail",
    detail: `${t.item.hours}h each way: ${Math.round(share * 100)}% of your waking trip time (limit for this intent: ${Math.round(tol * 100)}%).`,
  });

  const fmt = (h: number) => `${Math.floor(h) % 24}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const late = arrive >= 22 || arrive < 5;
  const vulnerable = party === "solo" || party === "family_kids" || party === "family_elders";
  if (late) {
    out.push({
      key: "arrival", label: "Late-night arrival",
      status: s.item.areaSafety < 0.75 || vulnerable ? "fail" : "warn",
      detail: `Arrives around ${fmt(arrive)} in ${s.item.area} (area safety ${Math.round(s.item.areaSafety * 100)}/100). Pre-book a verified pickup or take the earlier option.`,
    });
  } else if (arrive + 3 < s.item.checkIn && arrive > 5) {
    out.push({ key: "arrival", label: "Arrival vs check-in", status: "warn", detail: `Arrives ${fmt(arrive)}, check-in ${s.item.checkIn}:00. Request early check-in or plan a first stop.` });
  } else {
    out.push({ key: "arrival", label: "Arrival time", status: "ok", detail: `Arrives around ${fmt(arrive)}, comfortably before dark.` });
  }

  if (DIET_RANK[diet] >= 2) {
    const okMeals = food.filter((f) => f.item.diet !== "nonveg_focus").length;
    out.push({
      key: "diet", label: diet === "jain" ? "Jain food" : "Vegetarian food",
      status: s.item.veg === "limited" ? "fail" : okMeals === food.length ? "ok" : "warn",
      detail: `${s.item.veg === "veg_only" ? "Pure-veg stay" : "Stay has a veg menu"}; ${okMeals}/${food.length} picked restaurants are veg-friendly.`,
    });
  } else {
    out.push({ key: "diet", label: "Food", status: "ok", detail: `No restrictions; ${food.length} restaurants matched to your taste.` });
  }

  out.push({ key: "rooms", label: "Room setup", status: rooms.ok ? "ok" : "warn", detail: rooms.label + (rooms.note ? `: ${rooms.note}` : "") + ` for ${heads(pax)} ${heads(pax) === 1 ? "person" : "people"}.` });

  const sf = dest.season[month(req.window.start)];
  out.push({ key: "season", label: "Season fit", status: sf >= 0.7 ? "ok" : sf >= 0.4 ? "warn" : "fail", detail: sf >= 0.7 ? "Good time to go." : sf >= 0.4 ? "Shoulder season: check weather and closures." : "Off-season for this trip." });

  const respected = ctx.dealbreakers.filter((x) => x.kind === "hard" && hardTags.includes(x.attribute)).map((x) => x.label);
  const softHits = ctx.dealbreakers.filter((x) => x.kind === "soft" && softTags.includes(x.attribute) && [...s.tags, ...t.tags, ...acts.flatMap((a) => a.tags)].includes(x.attribute));
  if (softHits.length) {
    out.push({ key: "dealbreakers", label: "Your preferences", status: "warn", detail: `Includes something you usually avoid: ${softHits.map((x) => x.label.toLowerCase()).join("; ")}. Swap it below.` });
  } else if (respected.length || softTags.length) {
    out.push({ key: "dealbreakers", label: "Your dealbreakers", status: "ok", detail: `Respected: ${[...respected, ...ctx.dealbreakers.filter((x) => x.kind === "soft").map((x) => x.label)].slice(0, 4).join("; ")}.` });
  }

  // intent trip-killers
  const sa = s.aspects;
  const killer = (status: ReadinessCheck["status"], label: string, detail: string, aspect?: Aspect, high = true) => {
    const sn = aspect ? ctx.store.snippets(s.item.id, aspect, party, high)[0] : undefined;
    out.push({ key: "killer", label, status, detail: detail + (sn ? ` Guest review: “${sn.snippet}”` : "") });
  };
  if (party === "family_kids") {
    if ((sa.nightlife ?? 0) > 0.6) killer("fail", "Trip-killer: late-night noise", "Families report noise at night here.", "nightlife", true);
    else if ((sa.kid_friendly ?? 0.5) < 0.45) killer("warn", "Kid-friendliness", "Not set up for children.", "kid_friendly", false);
    else killer("ok", "Kid-friendly stay", "Families rate this stay well for children.", "kid_friendly", true);
  }
  if (party === "family_elders") {
    if ((sa.elder_friendly ?? 0.5) < 0.5) killer("fail", "Trip-killer: stairs and access", "Guests mention steps or no lift.", "elder_friendly", false);
    else killer("ok", "Easy for seniors", "Lift or ground-floor access reported.", "elder_friendly", true);
    if (acts.some((a) => a.item.intensity > 0.45)) out.push({ key: "killer", label: "Activity intensity", status: "warn", detail: "One activity involves walking or steps; keep a rest slot." });
  }
  if (party === "couple" && (sa.romance ?? 0.5) < 0.45) killer("warn", "Privacy & ambience", "Couples find this stay more lively than romantic.", "romance", false);
  if (party === "friends" && (sa.social ?? 0.5) < 0.35) killer("warn", "Evenings", "Groups say it gets very quiet after 9pm.", "nightlife", false);
  if (party === "solo" && s.item.areaSafety < 0.7) out.push({ key: "killer", label: "Solo safety", status: "warn", detail: `Area safety ${Math.round(s.item.areaSafety * 100)}/100. Prefer well-lit routes after dark.` });
  if (req.need === "rest") {
    if ((sa.quiet ?? 0.5) < 0.45) killer("fail", "Trip-killer: noisy stay", "A rest trip needs quiet nights.", "quiet", false);
    if (acts.length / Math.max(1, days - 1) > 1.4) out.push({ key: "killer", label: "Pace", status: "warn", detail: "More than one activity a day; this may feel packed for a rest trip." });
  }
  if (req.need === "reflect" && (d.aspects.crowd ?? 0) > 0.8) out.push({ key: "killer", label: "Crowds at the sites", status: "warn", detail: "Expect queues at the main darshan or aarti; dawn slots are calmer." });
  if (req.need === "thrill" && !acts.some((a) => (a.aspects.adventure ?? 0) > 0.6)) out.push({ key: "killer", label: "Adventure", status: "warn", detail: "No high-adrenaline activity fits your filters here." });
  if (req.need === "celebrate" && ![...acts, ...food].some((a) => (a.aspects.romance ?? 0) > 0.75 || (a.aspects.luxury ?? 0) > 0.75)) out.push({ key: "killer", label: "Signature moment", status: "warn", detail: "No standout celebration experience picked yet." });
  if (req.need === "indulge" && (sa.luxury ?? 0.5) < 0.65) out.push({ key: "killer", label: "Luxury level", status: "warn", detail: "This stay is comfortable rather than indulgent." });
  if (req.need === "learn" && (sa.work_friendly ?? 0.5) < 0.5) out.push({ key: "killer", label: "Connectivity", status: "warn", detail: "Wi-Fi and desk space are not reported here." });
  return out;
}

/** "plenty of adventure and little nightlife": positive-weight aspects read as strengths, negative-weight ones as absences. */
function describe(contrib: { aspect: Aspect; v: number }[], W: Record<string, number>) {
  const N: Record<string, string> = {
    quiet: "quiet nights", nightlife: "nightlife", kid_friendly: "things for kids", elder_friendly: "easy access for seniors", safety: "safety",
    veg_food: "veg food", romance: "romance", luxury: "luxury", value: "value", adventure: "adventure", culture: "culture & heritage", nature: "nature",
    spiritual: "spiritual sites", crowd: "crowds", wellness: "wellness", food_adventure: "food finds", comfort: "comfort", convenience: "location",
    scenic: "views", social: "social vibe", work_friendly: "Wi-Fi & workspace",
  };
  const pos = contrib.filter((c) => W[c.aspect] >= 0).map((c) => N[c.aspect]);
  const neg = contrib.filter((c) => W[c.aspect] < 0).map((c) => N[c.aspect]);
  return [pos.length ? `strong on ${pos.join(" and ")}` : "", neg.length ? `low on ${neg.join(" and ")}` : ""].filter(Boolean).join(", ");
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Ranked alternatives for one element of a plan (used by "Swap" and the I-know-where view). */
export function rankElement(kind: "stay" | "transport" | "food" | "activity", destId: string, need: Need, party: Party, ctx: EngineContext, secondary?: Need | null) {
  const W = groupWeights({ need, party, secondaryNeed: secondary } as TripRequest, ctx);
  const list = kind === "stay" ? STAYS : kind === "transport" ? TRANSPORT : kind === "food" ? FOOD : ACTIVITIES;
  const scored = scoreList((list as Item[]).filter((i) => "destId" in i && i.destId === destId), party, W, ctx.store);
  const hard = ctx.dealbreakers.filter((d) => d.kind === "hard").map((d) => d.attribute);
  return scored
    .map((s) => {
      const top = s.contrib.filter((c) => c.v > 0 && (s.aspects[c.aspect] ?? 0.5) >= 0.6).slice(0, 2);
      const worst = [...s.contrib].filter((c) => c.v < -0.15).sort((a, b) => a.v - b.v).slice(0, 2);
      const flags = worst.map((w) => {
        const sn = ctx.store.snippets(s.item.id, w.aspect, party, W[w.aspect] < 0, 1, -1)[0];
        return { aspect: ASPECT_LABEL[w.aspect], snippet: sn?.snippet ?? null, sameParty: sn?.party === party };
      });
      const goodSn = top[0] ? ctx.store.snippets(s.item.id, top[0].aspect, party, W[top[0].aspect] > 0, 1, 1)[0] : undefined;
      return {
        id: s.item.id,
        name: s.item.name,
        price: (s.item as { price: number }).price,
        fit: sigmoidPct(s.x),
        tags: s.tags,
        blocked: s.tags.filter((t) => hard.includes(t)).map((t) => TAG_LABEL[t]),
        good: top.map((c) => ASPECT_LABEL[c.aspect]),
        flag: flags[0] ?? null,
        flags,
        evidence: goodSn ? { snippet: goodSn.snippet, sameParty: goodSn.party === party } : null,
        reviews: ctx.store.reviewCount(s.item.id),
      };
    })
    .sort((a, b) => b.fit - a.fit);
}

/** Rebuild a plan from explicit item choices (swaps, template remixes, retakes) with fresh scores and checks. */
export function planFromItems(
  req: TripRequest,
  ids: { stay: string; transport: string; food: string[]; activities: string[] },
  ctx: EngineContext,
): Plan {
  const pax = req.pax ?? DEFAULT_PAX[req.party];
  const W = groupWeights(req, ctx);
  const diet = strictestDiet([ctx.diet, req.diet]);
  const stay = STAYS.find((s) => s.id === ids.stay)!;
  const dest = DEST_BY_ID.get(stay.destId)!;
  const tr = TRANSPORT.find((t) => t.id === ids.transport)!;
  const d = scoreList([dest], req.party, W, ctx.store)[0];
  const s = scoreList([stay], req.party, W, ctx.store)[0];
  const t = scoreList([tr], req.party, W, ctx.store)[0];
  const f = scoreList(FOOD.filter((x) => ids.food.includes(x.id)), req.party, W, ctx.store);
  const a = scoreList(ACTIVITIES.filter((x) => ids.activities.includes(x.id)), req.party, W, ctx.store);
  const hardTags = ctx.dealbreakers.filter((x) => x.kind === "hard").map((x) => x.attribute);
  const softTags = ctx.dealbreakers.filter((x) => x.kind === "soft").map((x) => x.attribute);
  return assemble(dest, d, s, t, f, a, req, pax, diet, W, ctx, softTags, hardTags).plan;
}

export function destName(id: string) {
  return DEST_BY_ID.get(id)?.name ?? id;
}
