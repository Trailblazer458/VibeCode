import { DEST_BY_ID } from "@/lib/data/catalog";
import { one, q } from "@/lib/db";
import { engagementUpdate } from "@/lib/engine/profile";
import { NEED_LABEL } from "@/lib/engine/weights";
import { handle, HttpError, logSignal, requireUser, updateProfile } from "@/lib/server";
import type { Plan } from "@/lib/types";

// Likes and saves on plan cards. Keyed by the plan's signature so they survive feed reloads (plan ids are regenerated).

export async function GET() {
  return handle(async () => {
    const { uid } = await requireUser();
    const rows = await q<{ signature: string; kind: string }>("select signature, kind from plan_likes where user_id = $1", [uid]);
    return { liked: rows.filter((r) => r.kind === "like").map((r) => r.signature), saved: rows.filter((r) => r.kind === "save").map((r) => r.signature) };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    const { planId, kind } = await req.json();
    if (kind !== "like" && kind !== "save") throw new HttpError(400, "kind must be like or save");
    const row = await one<{ plan: Plan & { signature?: string } }>("select plan from plans where id = $1 and user_id = $2", [planId, uid]);
    if (!row) throw new HttpError(404, "Plan not found");
    const p = row.plan;
    const signature = p.signature ?? p.id;
    const has = await one("select 1 as x from plan_likes where user_id = $1 and signature = $2 and kind = $3", [uid, signature, kind]);
    if (has) await q("delete from plan_likes where user_id = $1 and signature = $2 and kind = $3", [uid, signature, kind]);
    else await q("insert into plan_likes (user_id, signature, kind, dest_id, need) values ($1,$2,$3,$4,$5) on conflict do nothing", [uid, signature, kind, p.destId, p.need]);

    // Same learning as template likes: a save counts 1.5x, undoing reverses the nudge.
    const weight = (kind === "save" ? 1.5 : 1) * (has ? -1 : 1);
    const upd = engagementUpdate(profile, { need: p.need, attrs: p.attrs }, weight);
    await updateProfile(uid, { dims: upd.dims, need_affinity: upd.need_affinity, intents: upd.intents });
    await logSignal(uid, sid, `plan_${kind}${has ? "_undo" : ""}`, "revealed", { planId, signature, destId: p.destId, need: p.need, changes: upd.changes });
    const newRow = upd.changes.some((c) => c.startsWith("new For You"));
    return {
      on: !has,
      learned: has ? null : `${kind === "save" ? "Saved" : "Liked"}. Noted: more ${NEED_LABEL[p.need]} trips${newRow ? " (new row in For You)" : ""} and more places like ${DEST_BY_ID.get(p.destId)?.name ?? "this"}.`,
    };
  });
}
