import { ITEM_BY_ID } from "@/lib/data/catalog";
import { one, q } from "@/lib/db";
import { planFromItems, rankElement } from "@/lib/engine/plan";
import { CHIP_TO_DEALBREAKER, contrastiveUpdate, engagementUpdate, reasonChips } from "@/lib/engine/profile";
import { getStore } from "@/lib/engine/store";
import { itemTags, TAG_LABEL } from "@/lib/engine/tags";
import { ASPECT_LABEL } from "@/lib/engine/weights";
import { engineContext, handle, HttpError, logSignal, requireUser, rid, runPlans, updateProfile } from "@/lib/server";
import type { Plan, TripRequest } from "@/lib/types";

type Stored = Plan & { signature?: string; templateId?: string; templateAuthor?: string };

/** The booking reference if this user has booked this plan (the prototype records bookings as signals). */
async function bookingRef(uid: string, id: string) {
  const r = await one<{ ref: string }>("select payload->>'ref' as ref from signals where user_id = $1 and type = 'plan_booked' and payload->>'planId' = $2 order by id desc limit 1", [uid, id]);
  return r?.ref ?? null;
}

async function load(id: string, uid: string) {
  const row = await one<{ plan: Stored; set_id: string; user_id: string }>("select plan, set_id, user_id from plans where id = $1", [id]);
  if (!row) throw new HttpError(404, "Plan not found");
  if (row.user_id !== uid) throw new HttpError(403, "Not your plan");
  return row;
}

export async function GET(_req: Request, ctxArg: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctxArg.params;
    const { uid, sid, profile } = await requireUser();
    const row = await load(id, uid);
    const p = row.plan;
    const ctx = await engineContext(uid, profile, p.party, p.need, sid);
    const alts = {
      stay: rankElement("stay", p.destId, p.need, p.party, ctx, null, p.pax),
      transport: rankElement("transport", p.destId, p.need, p.party, ctx, null, p.pax),
      food: rankElement("food", p.destId, p.need, p.party, ctx, null, p.pax),
      activity: rankElement("activity", p.destId, p.need, p.party, ctx, null, p.pax),
    };
    const set = row.set_id ? await one<{ plan_ids: string[]; request: Partial<TripRequest> | null }>("select plan_ids, request from plan_sets where id = $1", [row.set_id]) : null;
    const chosen = await one("select 1 as x from plan_choices where chosen_plan_id = $1", [id]);
    const booked = await bookingRef(uid, id);

    // Exact price of every possible swap: rebuild the plan with the swap applied and compare. Keyed
    // "element:removeId>addId"; pp is per person for the whole trip (transport is return), total is for the group.
    const budgetPP = set?.request && "budgetPP" in set.request ? (set.request.budgetPP ?? null) : profile.budget_pp;
    const tr: TripRequest = { need: p.need, party: p.party, pax: p.pax, window: p.window, budgetPP };
    const ids = { stay: p.stay.id, transport: p.transport.id, food: p.food.map((f) => f.id), activities: p.activities.map((a) => a.id) };
    const swapCost: Record<string, { pp: number; total: number; perHead: number }> = {};
    const price = (next: typeof ids) => {
      const np = planFromItems(tr, next, ctx);
      return { pp: np.cost.perHead - p.cost.perHead, total: np.cost.total - p.cost.total, perHead: np.cost.perHead };
    };
    for (const elem of ["stay", "transport"] as const)
      for (const alt of alts[elem]) if (alt.id !== ids[elem]) swapCost[`${elem}:${ids[elem]}>${alt.id}`] = price({ ...ids, [elem]: alt.id });
    for (const [elem, key] of [["food", "food"], ["activity", "activities"]] as const)
      for (const cur of ids[key])
        for (const alt of alts[elem]) if (!ids[key].includes(alt.id)) swapCost[`${elem}:${cur}>${alt.id}`] = price({ ...ids, [key]: ids[key].map((x) => (x === cur ? alt.id : x)) });
    return { plan: p, alts, swapCost, budgetPP, siblings: (set?.plan_ids ?? []).length, chosen: !!chosen, booked };
  });
}

export async function POST(req: Request, ctxArg: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctxArg.params;
    const { uid, sid, profile } = await requireUser();
    const body = await req.json();
    const row = await load(id, uid);
    const p = row.plan;
    // Re-ranking keeps the budget the plans were made with: none for a "flexible" Plan with me request.
    const originalBudget = async () => {
      const set = row.set_id ? await one<{ request: Partial<TripRequest> | null }>("select request from plan_sets where id = $1", [row.set_id]) : null;
      return set?.request && "budgetPP" in set.request ? (set.request.budgetPP ?? null) : profile.budget_pp;
    };

    // Prototype checkout: no payment is taken. A booking is the strongest signal we get, so it updates the profile
    // like a like or save does, at double weight, and is logged with a reference the confirmation screen shows.
    if (body.action === "book") {
      // Booking twice is a no-op that returns the first reference, so a refresh or double tap never re-books.
      const existing = await bookingRef(uid, id);
      if (existing) return { ok: true, ref: existing, already: true };
      const ref = "TG-" + id.replace(/^pl_/, "").slice(-6).toUpperCase();
      const upd = engagementUpdate(profile, { need: p.need, attrs: p.attrs }, 2);
      await updateProfile(uid, { dims: upd.dims, need_affinity: upd.need_affinity, intents: upd.intents });
      await logSignal(uid, sid, "plan_booked", "revealed", { planId: id, destId: p.destId, ref, total: p.cost.total, travellers: body.travellers ?? null });
      return { ok: true, ref };
    }

    if (body.action === "choose") {
      const set = await one<{ plan_ids: string[] }>("select plan_ids from plan_sets where id = $1", [row.set_id]);
      const others = (set?.plan_ids ?? []).filter((x) => x !== id);
      const rejected = others.length ? await q<{ id: string; plan: Plan }>(`select id, plan from plans where id = any($1::text[])`, [others]) : [];
      const past = await q<{ dest_id: string }>("select dest_id from trips where owner_id = $1 and kind='past'", [uid]);
      const rc = reasonChips(p, rejected.map((r) => r.plan), past.map((x) => x.dest_id));
      const upd = contrastiveUpdate(profile.dims, p.attrs, rejected.map((r) => r.plan.attrs));
      await updateProfile(uid, { dims: upd.dims });
      await q("insert into plan_choices (user_id, set_id, chosen_plan_id, rejected) values ($1,$2,$3,$4::jsonb)", [uid, row.set_id, id, JSON.stringify(rejected.map((r) => r.id))]);
      await logSignal(uid, sid, "plan_chosen", "revealed", { planId: id, destId: p.destId, rejected: rejected.map((r) => r.plan.destId), changes: upd.changes });
      return { ok: true, ambiguous: rc.ambiguous && rejected.length > 0, chips: rc.chips, learned: upd.changes, rejected: rejected.map((r) => ({ destName: r.plan.destName, stay: r.plan.stay.name })) };
    }

    if (body.action === "reasons") {
      const created: string[] = [];
      for (const chip of (body.chips ?? []) as string[]) {
        const m = CHIP_TO_DEALBREAKER[chip];
        if (chip === "Too pricey") {
          await updateProfile(uid, { dims: { ...profile.dims, luxury: Math.max(0.05, (profile.dims.luxury ?? 0.5) - 0.05) } });
          created.push("Watching price more closely");
        }
        if (!m) continue;
        const exists = await one("select 1 as x from dealbreakers where user_id=$1 and attribute=$2 and coalesce(context_party,'')=$3", [uid, m.attribute, p.party]);
        if (!exists) {
          await q("insert into dealbreakers (id, user_id, attribute, label, kind, context_party, confidence, source, status) values ($1,$2,$3,$4,'soft',$5,0.6,'reason_chip','confirmed')", [rid("db_"), uid, m.attribute, `${m.label} (${p.party.replace("_", " ")} trips)`, p.party]);
          created.push(m.label);
        }
      }
      await logSignal(uid, sid, "reason_chips", "stated", { planId: id, chips: body.chips });
      return { ok: true, created };
    }

    if (body.action === "swap") {
      const { element, removeId, addId } = body as { element: "stay" | "transport" | "food" | "activity"; removeId: string; addId: string };
      const store = await getStore();
      const removed = ITEM_BY_ID.get(removeId);
      const added = ITEM_BY_ID.get(addId);
      if (!removed || !added) throw new HttpError(400, "Unknown item");
      const rTags = itemTags(removed, store.aspects(removeId, p.party));
      const aTags = itemTags(added, store.aspects(addId, p.party));
      const known = await q<{ id: string; attribute: string; label: string; confidence: number; status: string }>("select id, attribute, label, confidence, status from dealbreakers where user_id = $1", [uid]);
      const violated = known.find((k) => rTags.includes(k.attribute) && !aTags.includes(k.attribute));
      let editType = "neutral";
      let message = "Swapped. Your profile notes the change.";
      let attr: string | null = null;
      if (violated) {
        editType = "violation";
        attr = violated.attribute;
        message = `That broke one of your known preferences (“${violated.label}”). Logged as a violation edit so the engine is held to account.`;
        if (violated.status === "inferred") await q("update dealbreakers set confidence = least(1, confidence + 0.2) where id = $1", [violated.id]);
      } else {
        const fresh = rTags.find((t) => !aTags.includes(t) && TAG_LABEL[t]);
        if (fresh) {
          editType = "discovery";
          attr = fresh;
          const ex = known.find((k) => k.attribute === fresh);
          if (ex) await q("update dealbreakers set confidence = least(1, confidence + 0.25) where id = $1", [ex.id]);
          else await q("insert into dealbreakers (id, user_id, attribute, label, kind, confidence, source, status) values ($1,$2,$3,$4,'soft',0.4,'edit','inferred')", [rid("db_"), uid, fresh, `Maybe avoid: ${TAG_LABEL[fresh].toLowerCase()}`]);
          message = `New signal: you might prefer to avoid ${TAG_LABEL[fresh].toLowerCase()}. Confirm it in your profile.`;
        } else {
          const ra = store.aspects(removeId, p.party);
          const aa = store.aspects(addId, p.party);
          const diffs = Object.keys({ ...ra, ...aa }).map((k) => ({ k, d: (aa[k] ?? 0.5) - (ra[k] ?? 0.5) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
          if (diffs[0] && Math.abs(diffs[0].d) > 0.2) {
            editType = "discovery";
            message = `Noted: you picked more ${ASPECT_LABEL[diffs[0].k as keyof typeof ASPECT_LABEL] ?? diffs[0].k} (${diffs[0].d > 0 ? "+" : "−"}).`;
          }
        }
      }
      const ids = {
        stay: element === "stay" ? addId : p.stay.id,
        transport: element === "transport" ? addId : p.transport.id,
        food: element === "food" ? p.food.map((f) => (f.id === removeId ? addId : f.id)) : p.food.map((f) => f.id),
        activities: element === "activity" ? p.activities.map((a) => (a.id === removeId ? addId : a.id)) : p.activities.map((a) => a.id),
      };
      const ctx = await engineContext(uid, profile, p.party, p.need, sid);
      const tr: TripRequest = { need: p.need, party: p.party, pax: p.pax, window: p.window, budgetPP: await originalBudget() };
      const np = { ...planFromItems(tr, ids, ctx), id, signature: p.signature, templateId: p.templateId, templateAuthor: p.templateAuthor, assumed: p.assumed };
      await q("update plans set plan = $2::jsonb where id = $1", [id, JSON.stringify(np)]);
      await q("insert into plan_edits (user_id, plan_id, template_id, element, removed_id, added_id, edit_type, dealbreaker_attr) values ($1,$2,$3,$4,$5,$6,$7,$8)", [uid, id, p.templateId ?? null, element, removeId, addId, editType, attr]);
      if (p.templateId) {
        await q("insert into template_remixes (template_id, user_id, plan_id, diff) values ($1,$2,$3,$4::jsonb)", [p.templateId, uid, id, JSON.stringify([{ element, removed: removed.name, added: added.name }])]);
      }
      await logSignal(uid, sid, "plan_edit", "revealed", { planId: id, element, removeId, addId, editType, attr });
      return { ok: true, plan: np, editType, message };
    }

    if (body.action === "switch") {
      const r = await runPlans(uid, sid, profile, {
        need: body.need ?? p.need, party: body.party ?? p.party, window: p.window, budgetPP: await originalBudget(), destId: p.destId, maxPlans: 4,
      }, "intent_switch");
      await logSignal(uid, sid, "intent_switch", "stated", { from: { need: p.need, party: p.party }, to: { need: body.need, party: body.party }, destId: p.destId });
      return { ok: true, planId: r.plans[0]?.id ?? null, criteria: r.criteria };
    }

    if (body.action === "save_template") {
      const tid = rid("tpl_");
      await q(
        "insert into templates (id, author_id, author_name, title, blurb, need, party, dest_id, days, items, visibility, trip_completed, trip_start) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,false,$12)",
        [tid, uid, profile.name, body.title ?? p.title, body.blurb ?? "", p.need, p.party, p.destId, p.window.days,
          JSON.stringify({ stay: p.stay.id, transport: p.transport.id, food: p.food.map((f) => f.id), activities: p.activities.map((a) => a.id) }),
          body.visibility ?? "friends", p.window.start],
      );
      return { ok: true, templateId: tid };
    }
    throw new HttpError(400, "Unknown action");
  });
}

