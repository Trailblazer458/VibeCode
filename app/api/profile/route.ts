import { ITEM_BY_ID, DEST_BY_ID } from "@/lib/data/catalog";
import { one, q } from "@/lib/db";
import { DEFAULT_PAX, planFromItems } from "@/lib/engine/plan";
import { personaBlurb } from "@/lib/engine/profile";
import { getStore } from "@/lib/engine/store";
import { itemTags, TAG_LABEL } from "@/lib/engine/tags";
import { buildTriggers, nextWindow } from "@/lib/engine/triggers";
import { engineContext, friendsOf, handle, HttpError, logSignal, requireUser, rid, savePlans, updateProfile, userTriggers, type DealbreakerRow } from "@/lib/server";
import type { Need, Party } from "@/lib/types";

interface TripRow { id: string; name: string; need: Need; party: Party; dest_id: string; start_date: string; days: number; items: { stay: string; transport: string; food: string[]; activities: string[] }; visibility: string; status: string }

export async function GET() {
  return handle(async () => {
    const { uid, profile } = await requireUser();
    const dbs = await q<DealbreakerRow>("select * from dealbreakers where user_id = $1 order by status desc, created_at", [uid]);
    const trips = await q<TripRow & { checked: boolean }>(
      `select t.*, t.start_date::text as start_date, (c.trip_id is not null) as checked from trips t left join post_trip_checkins c on c.trip_id = t.id and c.user_id = $1
       where t.owner_id = $1 and t.kind = 'past' order by t.start_date desc`, [uid]);
    const nudges = await userTriggers(uid, profile);
    const stats = await one<{ stated: number; revealed: number; passive: number }>(
      "select count(*) filter (where tier='stated')::int as stated, count(*) filter (where tier='revealed')::int as revealed, count(*) filter (where tier='passive')::int as passive from signals where user_id=$1", [uid]);
    return {
      profile, blurb: personaBlurb(profile.dims ?? {}, profile.need_affinity ?? {}),
      dealbreakers: dbs,
      trips: trips.map((t) => ({
        ...t, start_date: String(t.start_date).slice(0, 10), destName: DEST_BY_ID.get(t.dest_id)?.name, emoji: DEST_BY_ID.get(t.dest_id)?.emoji, hue: DEST_BY_ID.get(t.dest_id)?.hue,
        itemNames: [t.items.stay, t.items.transport, ...t.items.food, ...t.items.activities].map((i) => ({ id: i, name: ITEM_BY_ID.get(i)?.name ?? i })),
      })),
      nudges, friends: await friendsOf(uid), stats, tagOptions: TAG_LABEL,
    };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    const b = await req.json();
    switch (b.action) {
      case "settings": {
        const patch: Record<string, unknown> = {};
        for (const k of ["diet", "home_city", "budget_pp", "calendar_opt_in", "segment", "name"]) if (k in b) patch[k] = b[k];
        await updateProfile(uid, patch);
        await logSignal(uid, sid, "settings", "stated", patch);
        return { ok: true };
      }
      case "confirm_dealbreaker":
        await q("update dealbreakers set status='confirmed', confidence=1, kind=$3 where id=$1 and user_id=$2", [b.id, uid, b.kind ?? "soft"]);
        await logSignal(uid, sid, "dealbreaker_confirmed", "stated", { id: b.id });
        return { ok: true };
      case "remove_dealbreaker":
        await q("delete from dealbreakers where id=$1 and user_id=$2", [b.id, uid]);
        await logSignal(uid, sid, "dealbreaker_removed", "stated", { id: b.id });
        return { ok: true };
      case "add_dealbreaker":
        await q("insert into dealbreakers (id, user_id, attribute, label, kind, context_party, confidence, source, status) values ($1,$2,$3,$4,$5,$6,1,'stated','confirmed')",
          [rid("db_"), uid, b.attribute, b.label ?? TAG_LABEL[b.attribute], b.kind ?? "hard", b.context_party ?? null]);
        return { ok: true };
      case "visibility":
        await q("update trips set visibility=$3 where id=$1 and owner_id=$2", [b.tripId, uid, b.visibility]);
        return { ok: true };
      case "checkin": {
        const t = await one<TripRow>("select *, start_date::text as start_date from trips where id=$1 and owner_id=$2", [b.tripId, uid]);
        if (!t) throw new HttpError(404, "Trip not found");
        await q("insert into post_trip_checkins (trip_id, user_id, repeat_items, skip_items, surprise) values ($1,$2,$3::jsonb,$4::jsonb,$5) on conflict do nothing",
          [b.tripId, uid, JSON.stringify(b.repeat ?? []), JSON.stringify(b.skip ?? []), b.surprise ?? ""]);
        const store = await getStore();
        const learned: string[] = [];
        for (const id of (b.skip ?? []) as string[]) {
          const item = ITEM_BY_ID.get(id);
          if (!item) continue;
          const tag = itemTags(item, store.aspects(id, t.party)).find((x) => TAG_LABEL[x]);
          if (tag) {
            await q("insert into dealbreakers (id, user_id, attribute, label, kind, context_party, confidence, source, status) values ($1,$2,$3,$4,'soft',$5,0.8,'post_trip','confirmed')",
              [rid("db_"), uid, tag, `${TAG_LABEL[tag]} (learned from ${t.name})`, t.party]);
            learned.push(TAG_LABEL[tag]);
          }
        }
        const dims = { ...profile.dims };
        for (const id of (b.repeat ?? []) as string[]) {
          const a = store.aspects(id, t.party);
          if ((a.adventure ?? 0) > 0.7) dims.pace = Math.min(0.95, (dims.pace ?? 0.5) + 0.03);
          if ((a.quiet ?? 0) > 0.7) dims.pace = Math.max(0.05, (dims.pace ?? 0.5) - 0.03);
          if ((a.luxury ?? 0) > 0.7) dims.luxury = Math.min(0.95, (dims.luxury ?? 0.5) + 0.03);
          if ((a.food_adventure ?? 0) > 0.7) dims.food = Math.min(0.95, (dims.food ?? 0.5) + 0.03);
        }
        await updateProfile(uid, { dims });
        await logSignal(uid, sid, "post_trip_checkin", "stated", { tripId: b.tripId, repeat: b.repeat, skip: b.skip });
        if (b.share) {
          await q("insert into templates (id, author_id, author_name, title, blurb, need, party, dest_id, days, items, visibility, trip_completed, trip_start) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,true,$12)",
            [rid("tpl_"), uid, profile.name, t.name, b.surprise || "", t.need, t.party, t.dest_id, t.days, JSON.stringify(t.items), b.shareVisibility ?? "friends", String(t.start_date).slice(0, 10)]);
        }
        return { ok: true, learned };
      }
      case "retake": {
        const t = await one<TripRow>("select *, start_date::text as start_date from trips where id=$1 and owner_id=$2", [b.tripId, uid]);
        if (!t) throw new HttpError(404, "Trip not found");
        const ctx = await engineContext(uid, profile, t.party, t.need, sid);
        const w = nextWindow();
        const plan = planFromItems({ need: t.need, party: t.party, pax: DEFAULT_PAX[t.party], window: { start: w.start, days: t.days, label: w.label }, budgetPP: profile.budget_pp }, t.items, ctx);
        const saved = await savePlans(uid, [{ ...plan, title: `Retake: ${t.name}` }], { retake: t.id }, "retake");
        await logSignal(uid, sid, "retake", "revealed", { tripId: t.id, destId: t.dest_id });
        return { planId: saved.plans[0].id };
      }
    }
    throw new HttpError(400, "Unknown action");
  });
}
