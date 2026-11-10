import { DEST_BY_ID } from "@/lib/data/catalog";
import { rankElement } from "@/lib/engine/plan";
import { engineContext, handle, logSignal, requireUser } from "@/lib/server";
import type { Need, Party } from "@/lib/types";

// "I know where": every element at one destination, ranked for the chosen intent. Switch the party and watch it flip.
export async function GET(req: Request) {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    const u = new URL(req.url);
    const dest = u.searchParams.get("dest") ?? "goa";
    const need = (u.searchParams.get("need") ?? "explore") as Need;
    const party = (u.searchParams.get("party") ?? profile.default_party) as Party;
    const ctx = await engineContext(uid, profile, party, need, sid);
    await logSignal(uid, sid, "destination_view", "passive", { destId: dest, need, party });
    const d = DEST_BY_ID.get(dest);
    return {
      dest: d,
      stay: rankElement("stay", dest, need, party, ctx),
      transport: rankElement("transport", dest, need, party, ctx),
      food: rankElement("food", dest, need, party, ctx),
      activity: rankElement("activity", dest, need, party, ctx),
    };
  });
}
