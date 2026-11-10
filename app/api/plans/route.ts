import { DEFAULT_PAX } from "@/lib/engine/plan";
import { nextWindow } from "@/lib/engine/triggers";
import { handle, logSignal, requireUser, runPlans } from "@/lib/server";
import type { TripRequest } from "@/lib/types";

// Generate plans for any request: intent chips, "I know where", budget-first, "Plan with me", Retake.
export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    const body = await req.json();
    const w = nextWindow();
    const party = body.party ?? profile.default_party;
    const tr: TripRequest = {
      need: body.need ?? profile.intents?.[0]?.need ?? "explore",
      secondaryNeed: body.secondaryNeed ?? null,
      party,
      pax: body.pax ?? DEFAULT_PAX[party as keyof typeof DEFAULT_PAX],
      window: body.window ?? { start: w.start, days: body.days ?? w.days, label: w.label },
      budgetPP: Number(body.budgetPP ?? profile.budget_pp),
      diet: body.diet ?? null,
      destId: body.destId ?? null,
      assumed: body.assumed ?? [],
      extraDealbreakers: body.extraDealbreakers ?? [],
      maxPlans: body.maxPlans,
    };
    const r = await runPlans(uid, sid, profile, tr, body.context ?? "explore", { disabled: body.disabled ?? [] });
    await logSignal(uid, sid, "plans_requested", "stated", { need: tr.need, party: tr.party, destId: tr.destId, budgetPP: tr.budgetPP, context: body.context });
    return r;
  });
}
