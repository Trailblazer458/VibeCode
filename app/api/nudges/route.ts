import { q } from "@/lib/db";
import { buildTriggers, longWeekends } from "@/lib/engine/triggers";
import { handle, requireUser } from "@/lib/server";

export async function GET() {
  return handle(async () => {
    const { uid, profile } = await requireUser();
    const groups = await q<{ name: string }>("select t.name from trips t join trip_members m on m.trip_id=t.id where m.user_id=$1 and t.kind='group' and t.status='planning'", [uid]);
    const past = await q<{ name: string; start_date: string }>("select name, start_date::text as start_date from trips where owner_id=$1 and kind='past'", [uid]);
    return {
      ...buildTriggers({ personalDates: profile.personal_dates, calendarOptIn: profile.calendar_opt_in, segment: profile.segment, ignored: profile.ignored_nudges,
        groupInvites: groups.map((g) => ({ tripName: g.name, from: "Rohan" })), searchedNotBooked: profile.is_demo ? ["udaipur"] : [],
        pastTrips: past.map((p) => ({ name: p.name, start: String(p.start_date).slice(0, 10) })) }),
      longWeekends: longWeekends().slice(0, 6),
    };
  });
}
