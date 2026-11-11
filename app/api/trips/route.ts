import { DEST_BY_ID } from "@/lib/data/catalog";
import { q } from "@/lib/db";
import { handle, requireUser } from "@/lib/server";

interface PlanSummary { title: string; destId: string; destName: string; need: string; party: string; emoji: string; hue: number; window: { start: string; days: number; label?: string }; pax: { adults: number; kids: number; seniors: number }; cost: { perHead: number; total: number } }

export async function GET() {
  return handle(async () => {
    const { uid } = await requireUser();
    const groups = await q<{ id: string; name: string; status: string; need: string; dest_id: string | null; members: number }>(
      `select t.id, t.name, t.status, t.need, t.dest_id, (select count(*)::int from trip_members x where x.trip_id = t.id) as members
       from trips t join trip_members m on m.trip_id = t.id where m.user_id = $1 and t.kind = 'group' order by t.created_at desc`, [uid]);

    // Booked (checkout completed): the prototype records each booking as a plan_booked signal with its reference.
    const bookings = await q<{ id: string; ref: string; plan: PlanSummary }>(
      `select b.plan_id as id, b.ref, p.plan from (
         select distinct on (payload->>'planId') payload->>'planId' as plan_id, payload->>'ref' as ref
         from signals where user_id = $1 and type = 'plan_booked' order by payload->>'planId', id desc
       ) b join plans p on p.id = b.plan_id`, [uid]);
    const bookedIds = new Set(bookings.map((b) => b.id));
    const upcoming = bookings.sort((a, b) => String(a.plan.window.start).localeCompare(String(b.plan.window.start)));

    // Chosen but not booked yet. A booked plan moves to Upcoming trips, so it isn't listed twice.
    const chosenRows = await q<{ id: string; plan: PlanSummary }>(
      `select p.id, p.plan from plan_choices c join plans p on p.id = c.chosen_plan_id where c.user_id = $1 order by c.created_at desc limit 20`, [uid]);
    const seen = new Set<string>();
    const chosen = chosenRows.filter((c) => !bookedIds.has(c.id) && !seen.has(c.id) && seen.add(c.id)).slice(0, 10);

    return { groups: groups.map((g) => ({ ...g, destName: g.dest_id ? DEST_BY_ID.get(g.dest_id)?.name : null })), upcoming, chosen };
  });
}
