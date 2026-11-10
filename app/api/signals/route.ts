import { handle, logSignal, requireUser } from "@/lib/server";

// Passive signals (dwell time). Used only within the current session to re-rank.
export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid } = await requireUser();
    const b = JSON.parse(await req.text());
    if (b.type === "dwell" && b.ms > 1500) await logSignal(uid, sid, "dwell", "passive", { planId: b.planId, destId: b.destId, ms: Math.min(b.ms, 300000) });
    return { ok: true };
  });
}
