import { DEST_BY_ID } from "@/lib/data/catalog";
import { q } from "@/lib/db";
import { handle, requireUser } from "@/lib/server";

export async function GET() {
  return handle(async () => {
    const { uid } = await requireUser();
    const groups = await q<{ id: string; name: string; status: string; need: string; dest_id: string | null; members: number }>(
      `select t.id, t.name, t.status, t.need, t.dest_id, (select count(*)::int from trip_members x where x.trip_id = t.id) as members
       from trips t join trip_members m on m.trip_id = t.id where m.user_id = $1 and t.kind = 'group' order by t.created_at desc`, [uid]);
    const chosen = await q<{ id: string; plan: { title: string; destId: string; emoji: string; hue: number; window: { start: string; days: number }; cost: { perHead: number } } }>(
      `select p.id, p.plan from plan_choices c join plans p on p.id = c.chosen_plan_id where c.user_id = $1 order by c.created_at desc limit 10`, [uid]);
    return { groups: groups.map((g) => ({ ...g, destName: g.dest_id ? DEST_BY_ID.get(g.dest_id)?.name : null })), chosen };
  });
}
