import { DEST_BY_ID, ITEM_BY_ID } from "@/lib/data/catalog";
import { one, q } from "@/lib/db";
import { DEFAULT_PAX, planFromItems } from "@/lib/engine/plan";
import { nextWindow } from "@/lib/engine/triggers";
import { NEED_LABEL, PARTY_LABEL } from "@/lib/engine/weights";
import { engineContext, handle, HttpError, logSignal, requireUser, savePlans } from "@/lib/server";
import type { Need, Party } from "@/lib/types";

interface Tpl { id: string; author_id: string | null; author_name: string; title: string; blurb: string; need: Need; party: Party; dest_id: string; days: number; items: { stay: string; transport: string; food: string[]; activities: string[] }; visibility: string; trip_completed: boolean; trip_start: string | null; likes: number; saves: number; remixes: number; stock: boolean }

export async function GET() {
  return handle(async () => {
    const { uid } = await requireUser();
    const friends = (await q<{ friend_id: string }>("select friend_id from friendships where user_id = $1", [uid])).map((r) => r.friend_id);
    const fof = await q<{ friend_id: string; via: string }>(
      "select f2.friend_id, p.name as via from friendships f1 join friendships f2 on f2.user_id = f1.friend_id join profiles p on p.id = f1.friend_id where f1.user_id = $1 and f2.friend_id <> $1",
      [uid]);
    const fofMap = new Map(fof.filter((x) => !friends.includes(x.friend_id)).map((x) => [x.friend_id, x.via]));
    const all = await q<Tpl>("select *, trip_start::text as trip_start from templates order by stock desc, likes desc");
    const mine = await q<{ template_id: string; kind: string }>("select template_id, kind from template_likes where user_id = $1", [uid]);
    const visible = all.filter((t) => {
      if (t.author_id === uid) return true;
      if (t.visibility === "public") return true;
      if (!t.author_id) return false;
      if (friends.includes(t.author_id)) return t.visibility === "friends" || t.visibility === "fof";
      if (fofMap.has(t.author_id)) return t.visibility === "fof";
      return false;
    });
    return {
      templates: visible.map((t) => ({
        ...t,
        // Dates of upcoming trips are hidden from everyone else until the trip is over.
        trip_start: t.trip_completed || t.author_id === uid ? (t.trip_start ? String(t.trip_start).slice(0, 10) : null) : null,
        datesHidden: !t.trip_completed && t.author_id !== uid,
        relation: t.stock ? "Curated" : t.author_id === uid ? "You" : friends.includes(t.author_id ?? "") ? "Friend" : `Friend of ${fofMap.get(t.author_id ?? "")}`,
        destName: DEST_BY_ID.get(t.dest_id)?.name, emoji: DEST_BY_ID.get(t.dest_id)?.emoji, hue: DEST_BY_ID.get(t.dest_id)?.hue,
        intent: `${NEED_LABEL[t.need]} · ${PARTY_LABEL[t.party]}`,
        itemNames: [t.items.stay, ...t.items.activities].map((i) => ITEM_BY_ID.get(i)?.name ?? i),
        liked: mine.some((m) => m.template_id === t.id && m.kind === "like"),
        saved: mine.some((m) => m.template_id === t.id && m.kind === "save"),
      })),
    };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    const b = await req.json();
    const t = await one<Tpl>("select * from templates where id = $1", [b.id]);
    if (!t) throw new HttpError(404, "Template not found");
    if (b.action === "like" || b.action === "save") {
      const col = b.action === "like" ? "likes" : "saves";
      const has = await one("select 1 as x from template_likes where template_id=$1 and user_id=$2 and kind=$3", [t.id, uid, b.action]);
      if (has) {
        await q("delete from template_likes where template_id=$1 and user_id=$2 and kind=$3", [t.id, uid, b.action]);
        await q(`update templates set ${col} = ${col} - 1 where id = $1`, [t.id]);
      } else {
        await q("insert into template_likes (template_id, user_id, kind) values ($1,$2,$3)", [t.id, uid, b.action]);
        await q(`update templates set ${col} = ${col} + 1 where id = $1`, [t.id]);
        await logSignal(uid, sid, `template_${b.action}`, "revealed", { templateId: t.id, destId: t.dest_id, need: t.need });
      }
      return { ok: true };
    }
    if (b.action === "remix") {
      const ctx = await engineContext(uid, profile, t.party, t.need, sid);
      const w = nextWindow();
      const plan = planFromItems({ need: t.need, party: t.party, pax: DEFAULT_PAX[t.party], window: { start: w.start, days: t.days, label: w.label }, budgetPP: profile.budget_pp }, t.items, ctx);
      const saved = await savePlans(uid, [{ ...plan, title: `Remix: ${t.title}`, templateId: t.id, templateAuthor: t.author_name } as typeof plan], { template: t.id }, "remix");
      await q("update templates set remixes = remixes + 1 where id = $1", [t.id]);
      await logSignal(uid, sid, "template_remix", "revealed", { templateId: t.id, destId: t.dest_id });
      return { planId: saved.plans[0].id };
    }
    throw new HttpError(400, "Unknown action");
  });
}
