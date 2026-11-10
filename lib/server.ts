// Server-side helpers shared by the API routes: session, profile, engine context, persistence, signals.
import { cookies } from "next/headers";
import { driver, ensureReady, one, q } from "./db";
import { DEMO_ID } from "./data/people";
import { buildPlans, DEFAULT_PAX, strictestDiet, type EffectiveDealbreaker, type EngineContext } from "./engine/plan";
import { getStore } from "./engine/store";
import { nextWindow } from "./engine/triggers";
import type { Diet, Need, Party, Plan, TripRequest } from "./types";

export const APP_NAME = "TripGenie";

export function rid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function session() {
  const c = await cookies();
  return { uid: c.get("tg_uid")?.value ?? null, sid: c.get("tg_sid")?.value ?? null };
}

export async function requireUser() {
  const { uid, sid } = await session();
  if (!uid) throw new HttpError(401, "No session");
  const p = await getProfile(uid);
  if (!p) throw new HttpError(401, "Unknown user");
  return { uid, sid: sid ?? "nosession", profile: p };
}

export class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

export function handle<T>(fn: () => Promise<T>) {
  return fn()
    .then((r) => (r instanceof Response ? r : Response.json(r)))
    .catch((e) => {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
    });
}

export interface Profile {
  id: string;
  name: string;
  home_city: string;
  diet: Diet;
  budget_pp: number;
  default_party: Party;
  persona: string | null;
  dims: Record<string, number>;
  need_affinity: Record<string, number>;
  intents: { need: Need; party: Party; score: number }[];
  companions: { name: string; relation: string; diet: string }[];
  personal_dates: { label: string; date: string }[];
  segment: string;
  onboarded: boolean;
  is_demo: boolean;
  calendar_opt_in: boolean;
  ignored_nudges: number;
}

export async function getProfile(uid: string) {
  return one<Profile>("select * from profiles where id = $1", [uid]);
}

export async function updateProfile(uid: string, patch: Partial<Profile>) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}${["dims", "need_affinity", "intents", "companions", "personal_dates"].includes(k) ? "::jsonb" : ""}`);
  const vals = keys.map((k) => {
    const v = (patch as Record<string, unknown>)[k];
    return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
  });
  await q(`update profiles set ${sets.join(", ")} where id = $1`, [uid, ...vals]);
}

export async function logSignal(uid: string, sid: string | null, type: string, tier: "stated" | "revealed" | "passive", payload: Record<string, unknown> = {}) {
  await q("insert into signals (user_id, session_id, type, tier, payload) values ($1,$2,$3,$4,$5::jsonb)", [uid, sid, type, tier, JSON.stringify(payload)]);
}

export async function signalCount(uid: string) {
  const r = await one<{ n: number }>("select count(*)::int as n from signals where user_id = $1 and tier <> 'passive'", [uid]);
  return (r?.n ?? 0) + (uid === DEMO_ID || uid.startsWith("demo_") ? 40 : 0);
}

export interface DealbreakerRow {
  id: string;
  attribute: string;
  label: string;
  kind: "hard" | "soft";
  context_party: Party | null;
  context_need: Need | null;
  confidence: number;
  source: string;
  status: string;
}

export async function dealbreakersFor(uid: string, party?: Party, need?: Need): Promise<EffectiveDealbreaker[]> {
  const rows = await q<DealbreakerRow>("select * from dealbreakers where user_id = $1", [uid]);
  return rows
    .filter((r) => (!r.context_party || r.context_party === party) && (!r.context_need || r.context_need === need))
    .filter((r) => r.status === "confirmed" || r.confidence >= 0.4)
    .map((r) => ({ attribute: r.attribute, label: r.label, kind: r.status === "inferred" ? "soft" : r.kind, owner: "you" as const }));
}

export function partyDiet(p: Profile, party: Party, override?: Diet | null): Diet {
  const relevant = p.companions.filter((c) =>
    party === "couple" ? c.relation === "partner" : party === "family_kids" || party === "family_elders" ? c.relation !== "friend" : false,
  );
  return strictestDiet([p.diet, override, ...relevant.map((c) => c.diet as Diet)]);
}

export async function sessionBoost(uid: string, sid: string | null) {
  if (!sid) return {};
  const rows = await q<{ dest: string; ms: number }>(
    "select payload->>'destId' as dest, sum((payload->>'ms')::int)::int as ms from signals where user_id=$1 and session_id=$2 and type='dwell' group by 1",
    [uid, sid],
  );
  const boost: Record<string, number> = {};
  for (const r of rows) if (r.dest && r.ms >= 8000) boost[r.dest] = 0.03;
  return boost;
}

export async function engineContext(uid: string, profile: Profile, party: Party, need: Need, sid: string | null, extra: Partial<EngineContext> = {}): Promise<EngineContext> {
  const [store, dbs, past, boost, count] = await Promise.all([
    getStore(),
    dealbreakersFor(uid, party, need),
    q<{ dest_id: string }>("select dest_id from trips where owner_id = $1 and kind = 'past'", [uid]),
    sessionBoost(uid, sid),
    signalCount(uid),
  ]);
  return {
    store,
    dims: profile.dims,
    dealbreakers: dbs,
    pastDestIds: past.map((p) => p.dest_id),
    diet: partyDiet(profile, party),
    signalCount: count,
    sessionBoost: boost,
    ...extra,
  };
}

export function defaultRequest(profile: Profile, need: Need, party: Party, over: Partial<TripRequest> = {}): TripRequest {
  const w = nextWindow();
  return {
    need,
    party,
    pax: DEFAULT_PAX[party],
    window: { start: w.start, days: w.days, label: w.label },
    budgetPP: profile.budget_pp,
    ...over,
  };
}

/** Persists a plan set so plan pages, choices and edits can refer back to it. */
export async function savePlans(uid: string, plans: Plan[], request: unknown, context: string) {
  const setId = rid("set_");
  const withIds = plans.map((p) => ({ ...p, signature: p.id, id: rid("pl_") }));
  const d = await driver();
  await ensureReady();
  await d.query("insert into plan_sets (id, user_id, request, plan_ids, context) values ($1,$2,$3::jsonb,$4::jsonb,$5)", [
    setId, uid, JSON.stringify(request), JSON.stringify(withIds.map((p) => p.id)), context,
  ]);
  if (withIds.length) {
    await d.query(
      "insert into plans (id, set_id, user_id, plan, source) select x->>'id', $1, $2, x, $3 from json_array_elements($4::json) x",
      [setId, uid, context, JSON.stringify(withIds)],
    );
  }
  return { setId, plans: withIds };
}

export async function runPlans(uid: string, sid: string | null, profile: Profile, req: TripRequest, context: string, extra: Partial<EngineContext> = {}) {
  const ctx = await engineContext(uid, profile, req.party, req.need, sid, extra);
  if (req.diet) ctx.diet = partyDiet(profile, req.party, req.diet);
  const result = buildPlans(req, ctx);
  const saved = await savePlans(uid, result.plans, req, context);
  return { ...result, plans: saved.plans, setId: saved.setId, request: req };
}

export async function friendsOf(uid: string) {
  return q<{ id: string; name: string }>("select p.id, p.name from friendships f join profiles p on p.id = f.friend_id where f.user_id = $1", [uid]);
}

/** Every "Explore as Arjun" visitor gets an isolated copy of the persona so evaluators don't see each other's edits. */
export async function cloneDemo() {
  const uid = rid("demo_");
  const base = await getProfile(DEMO_ID);
  if (!base) throw new Error("demo persona missing");
  await q(
    `insert into profiles (id, name, home_city, diet, budget_pp, default_party, persona, dims, need_affinity, intents, companions, personal_dates, segment, onboarded, is_demo, calendar_opt_in)
     select $1, name, home_city, diet, budget_pp, default_party, persona, dims, need_affinity, intents, companions, personal_dates, segment, true, true, calendar_opt_in from profiles where id = $2`,
    [uid, DEMO_ID],
  );
  await q("insert into friendships (user_id, friend_id) select $1, friend_id from friendships where user_id = $2", [uid, DEMO_ID]);
  await q("insert into friendships (user_id, friend_id) select user_id, $1 from friendships where friend_id = $2 and user_id <> $1", [uid, DEMO_ID]);
  const { seedPersonaRows } = await import("./seed");
  await seedPersonaRows(await driver(), uid);
  return uid;
}

export async function createFresh() {
  const uid = rid("u_");
  await q("insert into profiles (id, name, onboarded) values ($1, 'Traveller', false)", [uid]);
  return uid;
}
