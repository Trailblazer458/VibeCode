import { DEST_BY_ID } from "@/lib/data/catalog";
import { one, q } from "@/lib/db";
import type { EffectiveDealbreaker } from "@/lib/engine/plan";
import { getProfile, handle, HttpError, logSignal, requireUser, rid, runPlans } from "@/lib/server";
import type { Need, Party } from "@/lib/types";

interface Trip { id: string; owner_id: string; name: string; need: Need; secondary_need: Need | null; party: Party; status: string; fairness: Record<string, number>; last_picked_by: string | null; plan_id: string | null; dest_id: string | null }
interface Constraint { id: string; owner_id: string; attribute: string; label: string; kind: "hard" | "soft"; value: { budgetPP?: number; diet?: string }; enabled: boolean }

async function access(id: string, uid: string) {
  const t = await one<Trip>("select * from trips where id = $1 and kind = 'group'", [id]);
  if (!t) throw new HttpError(404, "Trip not found");
  const m = await one<{ role: string }>("select role from trip_members where trip_id = $1 and user_id = $2", [id, uid]);
  if (!m) throw new HttpError(403, "Not a member");
  return { t, role: m.role };
}

export async function GET(req: Request, a: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await a.params;
    const { uid, sid, profile } = await requireUser();
    const { t, role } = await access(id, uid);
    const preview = new URL(req.url).searchParams.get("preview")?.split(",").filter(Boolean) ?? [];
    const members = await q<{ user_id: string; role: string; name: string; dims: Record<string, number> }>(
      "select m.user_id, m.role, p.name, p.dims from trip_members m join profiles p on p.id = m.user_id where m.trip_id = $1 order by m.role desc, p.name", [id]);
    const opts = await q<{ id: string; label: string; start_date: string; days: number; votes: string[] }>(
      `select o.id, o.label, o.start_date::text as start_date, o.days, coalesce(array_agg(v.user_id) filter (where v.user_id is not null), '{}') as votes
       from date_poll_options o left join date_poll_votes v on v.option_id = o.id where o.trip_id = $1 group by o.id, o.label, o.start_date, o.days order by o.start_date`, [id]);
    const best = [...opts].sort((x, y) => y.votes.length - x.votes.length || String(x.start_date).localeCompare(String(y.start_date)))[0];
    const cons = await q<Constraint>("select * from trip_constraints where trip_id = $1 order by kind, id", [id]);
    const votes = await q<{ user_id: string; dest_id: string; vote: string }>("select user_id, dest_id, vote from trip_votes where trip_id = $1", [id]);
    const voteMap: Record<string, { likes: number; vetoes: number }> = {};
    for (const v of votes) {
      voteMap[v.dest_id] ??= { likes: 0, vetoes: 0 };
      if (v.vote === "like") voteMap[v.dest_id].likes++;
      else voteMap[v.dest_id].vetoes++;
    }
    const enabled = cons.filter((c) => c.enabled);
    const budget = Math.min(...enabled.filter((c) => c.attribute === "budget").map((c) => c.value.budgetPP ?? 99999), 99999);
    const dbs: EffectiveDealbreaker[] = enabled.map((c) => ({ attribute: c.attribute, label: c.label, kind: c.kind, owner: "group", constraintId: c.id, ownerIsYou: c.owner_id === uid }));
    const diet = enabled.some((c) => c.attribute === "diet_veg") ? "veg" : "none";
    const n = members.length;
    const r = await runPlans(uid, sid, profile, {
      need: t.need, secondaryNeed: t.secondary_need, party: "friends", pax: { adults: n, kids: 0, seniors: 0, pets: 0 },
      window: { start: String(best?.start_date ?? "2026-12-25").slice(0, 10), days: best?.days ?? 3, label: best?.label }, budgetPP: budget === 99999 ? profile.budget_pp : budget,
      diet: diet as "veg" | "none", maxPlans: 5,
    }, "group", {
      members: members.map((m) => ({ dims: m.dims ?? {}, weight: t.fairness?.[m.user_id] ?? 1 })),
      dealbreakers: dbs, isGroup: true, votes: voteMap, disabled: preview, diet: diet as "veg" | "none",
    });
    const myVotes = Object.fromEntries(votes.filter((v) => v.user_id === uid).map((v) => [v.dest_id, v.vote]));
    const requests = await q<{ id: string; constraint_id: string; message: string; status: string; requested_by: string }>(
      "select r.* from relax_requests r where r.trip_id = $1 order by r.created_at desc", [id]);
    const tasks = await q<{ id: string; label: string; assignee_id: string | null; done: boolean }>("select * from trip_tasks where trip_id = $1 order by id", [id]);
    const lastPicker = t.last_picked_by ? (await getProfile(t.last_picked_by))?.name : null;
    const priority = members.filter((m) => (t.fairness?.[m.user_id] ?? 1) > 1).map((m) => (m.user_id === uid ? "you" : m.name));
    return {
      trip: { id: t.id, name: t.name, need: t.need, status: t.status, planId: t.plan_id, destName: t.dest_id ? DEST_BY_ID.get(t.dest_id)?.name : null },
      role, you: uid,
      members: members.map((m) => ({ id: m.user_id, name: m.user_id === uid ? "You" : m.name, role: m.role })),
      poll: opts.map((o) => ({ id: o.id, label: o.label, start: String(o.start_date).slice(0, 10), days: o.days, count: o.votes.length, mine: o.votes.includes(uid), best: o.id === best?.id })),
      // Owner identity is never sent to the client; only whether it is you.
      constraints: cons.map((c) => {
        const crit = r.criteria.find((x) => x.constraintId === c.id || (c.attribute === "budget" && x.key === "budget") || (c.attribute === "diet_veg" && x.key === "diet"));
        return { id: c.id, label: c.label, kind: c.kind, enabled: c.enabled, mine: c.owner_id === uid, hides: crit?.hidden ?? 0, previewing: preview.includes(crit?.key ?? "") };
      }),
      intentCriteria: r.criteria.filter((c) => c.source === "intent" || c.source === "trip" || c.key === "veto"),
      plans: r.plans.map((p) => ({ ...p, votes: voteMap[p.destId] ?? { likes: 0, vetoes: 0 }, myVote: myVotes[p.destId] ?? null })),
      previewKeys: r.criteria.map((c) => ({ key: c.key, constraintId: c.constraintId })),
      incoming: requests.filter((x) => x.status === "pending" && cons.find((c) => c.id === x.constraint_id)?.owner_id === uid).map((x) => ({ id: x.id, message: x.message, label: cons.find((c) => c.id === x.constraint_id)?.label })),
      outgoing: requests.filter((x) => x.requested_by === uid).map((x) => ({ id: x.id, status: x.status, label: cons.find((c) => c.id === x.constraint_id)?.label })),
      tasks: tasks.map((k) => ({ ...k, assignee: k.assignee_id === uid ? "You" : members.find((m) => m.user_id === k.assignee_id)?.name ?? null })),
      fairness: { lastPicker, priority },
    };
  });
}

export async function POST(req: Request, a: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await a.params;
    const { uid, sid } = await requireUser();
    const { t, role } = await access(id, uid);
    const b = await req.json();
    switch (b.action) {
      case "vote_date": {
        const has = await one("select 1 as x from date_poll_votes where option_id=$1 and user_id=$2", [b.optionId, uid]);
        if (has) await q("delete from date_poll_votes where option_id=$1 and user_id=$2", [b.optionId, uid]);
        else await q("insert into date_poll_votes (option_id, user_id) values ($1,$2)", [b.optionId, uid]);
        return { ok: true };
      }
      case "vote_plan":
        await q("delete from trip_votes where trip_id=$1 and user_id=$2 and dest_id=$3", [id, uid, b.destId]);
        if (b.vote) await q("insert into trip_votes (trip_id, user_id, dest_id, vote) values ($1,$2,$3,$4)", [id, uid, b.destId, b.vote]);
        await logSignal(uid, sid, "group_vote", "revealed", { tripId: id, destId: b.destId, vote: b.vote });
        return { ok: true };
      case "toggle": {
        const c = await one<Constraint>("select * from trip_constraints where id=$1 and trip_id=$2", [b.constraintId, id]);
        if (!c) throw new HttpError(404, "No such criterion");
        if (c.kind === "hard" && c.owner_id !== uid) throw new HttpError(403, "Only the person who set this can relax it. Send an anonymous request instead.");
        await q("update trip_constraints set enabled = not enabled where id=$1", [c.id]);
        return { ok: true };
      }
      case "request_relax": {
        const c = await one<Constraint>("select * from trip_constraints where id=$1 and trip_id=$2", [b.constraintId, id]);
        if (!c) throw new HttpError(404, "No such criterion");
        await q("insert into relax_requests (id, trip_id, constraint_id, requested_by, message, status) values ($1,$2,$3,$4,$5,'pending')",
          [rid("rr_"), id, c.id, uid, b.message ?? `The group likes ${b.count ?? "some"} option(s) that “${c.label}” hides. Allow them this once?`]);
        return { ok: true };
      }
      case "respond_relax": {
        const r = await one<{ constraint_id: string }>("select constraint_id from relax_requests where id=$1 and trip_id=$2", [b.requestId, id]);
        if (!r) throw new HttpError(404, "No such request");
        const c = await one<Constraint>("select * from trip_constraints where id=$1", [r.constraint_id]);
        // Demo helper: simulated replies from friends are allowed for their constraints.
        if (c?.owner_id !== uid && !b.simulate) throw new HttpError(403, "Only the owner can answer");
        await q("update relax_requests set status=$2 where id=$1", [b.requestId, b.approve ? "approved" : "declined"]);
        if (b.approve) await q("update trip_constraints set enabled=false where id=$1", [r.constraint_id]);
        return { ok: true };
      }
      case "confirm":
        if (role !== "organizer") throw new HttpError(403, "Only the organizer confirms");
        await q("update trips set status='booked', plan_id=$2, dest_id=$3 where id=$1", [id, b.planId, b.destId]);
        await logSignal(uid, sid, "group_confirmed", "revealed", { tripId: id, destId: b.destId });
        return { ok: true };
      case "reopen":
        await q("update trips set status='planning' where id=$1", [id]);
        return { ok: true };
      case "task":
        if (b.op === "add") await q("insert into trip_tasks (id, trip_id, label, assignee_id) values ($1,$2,$3,$4)", [rid("t_"), id, b.label, b.assignee ?? null]);
        if (b.op === "assign") await q("update trip_tasks set assignee_id=$2 where id=$1", [b.taskId, b.assignee]);
        if (b.op === "done") await q("update trip_tasks set done = not done where id=$1", [b.taskId]);
        return { ok: true };
    }
    void t;
    throw new HttpError(400, "Unknown action");
  });
}
