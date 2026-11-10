import { one, q } from "@/lib/db";
import { grok } from "@/lib/llm";
import { handle, HttpError, requireUser } from "@/lib/server";
import type { Plan } from "@/lib/types";

// The LLM only rewrites engine-produced reasons and real review snippets into one plain sentence.
export async function POST(req: Request) {
  return handle(async () => {
    const { uid } = await requireUser();
    const { planId } = await req.json();
    const row = await one<{ plan: Plan & { blurb?: string } }>("select plan from plans where id=$1 and user_id=$2", [planId, uid]);
    if (!row) throw new HttpError(404, "Plan not found");
    if (row.plan.blurb) return { blurb: row.plan.blurb, engine: "cached" };
    const p = row.plan;
    const text = await grok([
      { role: "system", content: "Write ONE short sentence (max 22 words) telling a traveller why this trip fits them. Use ONLY the facts given. No invented places, prices or claims. Plain, warm, no emojis." },
      { role: "user", content: JSON.stringify({ trip: p.title, party: p.party, stay: p.stay.name, reasons: p.why, guestReviews: p.evidence.map((e) => e.text), perHead: p.cost.perHead }) },
    ], false, 12000);
    const blurb = typeof text === "string" && text.trim() ? text.trim() : null;
    if (blurb) await q("update plans set plan = jsonb_set(plan, '{blurb}', to_jsonb($2::text)) where id=$1", [planId, blurb]);
    return { blurb, engine: blurb ? "grok" : "none" };
  });
}
