import { one, q } from "@/lib/db";
import { handle, requireUser } from "@/lib/server";

export async function GET() {
  return handle(async () => {
    await requireUser();
    const edits = await one<{ total: number; violation: number; discovery: number }>(
      "select count(*)::int as total, count(*) filter (where edit_type='violation')::int as violation, count(*) filter (where edit_type='discovery')::int as discovery from plan_edits");
    const plansShown = await one<{ n: number }>("select count(*)::int as n from plans");
    const chosen = await one<{ n: number }>("select count(distinct chosen_plan_id)::int as n from plan_choices");
    const chips = await one<{ n: number }>("select count(*)::int as n from signals where type='reason_chips'");
    const tiers = await q<{ tier: string; n: number }>("select tier, count(*)::int as n from signals group by tier order by n desc");
    const types = await q<{ type: string; n: number }>("select type, count(*)::int as n from signals group by type order by n desc limit 12");
    const remixes = await one<{ n: number }>("select count(*)::int as n from template_remixes");
    const users = await one<{ n: number }>("select count(*)::int as n from profiles where id <> 'arjun' and id not in ('rohan','neha','kabir','priya')");
    const pc = plansShown?.n ?? 0;
    return {
      live: {
        users: users?.n ?? 0, plansShown: pc, plansChosen: chosen?.n ?? 0, reasonChipAnswers: chips?.n ?? 0, remixEdits: remixes?.n ?? 0,
        edits: edits ?? { total: 0, violation: 0, discovery: 0 },
        violationRate: edits?.total ? edits.violation / edits.total : 0,
        discoveryRate: edits?.total ? edits.discovery / edits.total : 0,
        tiers, types,
      },
    };
  });
}
