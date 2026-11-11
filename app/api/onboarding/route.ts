import { q } from "@/lib/db";
import { applyOnboarding, CARDS, personaBlurb } from "@/lib/engine/profile";
import { TAG_LABEL } from "@/lib/engine/tags";
import { handle, logSignal, requireUser, rid, updateProfile } from "@/lib/server";
import type { Diet, Party } from "@/lib/types";

export async function GET() {
  return handle(async () => ({ cards: CARDS, dealbreakerOptions: ["long_road", "hostel", "early_start", "crowded", "red_eye", "party_scene", "strenuous", "camp"].map((k) => ({ attribute: k, label: TAG_LABEL[k] })) }));
}

export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid } = await requireUser();
    const b = await req.json();
    const answers = (b.answers ?? []) as { card_id: string; choice: "yes" | "no"; ms?: number }[];
    const parties = (b.parties ?? ["friends"]) as Party[];
    const r = applyOnboarding(answers, parties);
    await updateProfile(uid, {
      name: b.name || "Traveller",
      home_city: b.home_city || "Delhi",
      diet: (b.diet ?? "none") as Diet,
      budget_pp: Number(b.budget_pp ?? 15000),
      default_party: parties[0],
      dims: r.dims,
      need_affinity: r.needs,
      intents: r.intents,
      persona: r.persona,
      onboarded: true,
      companions: b.partnerDiet ? [{ name: "Partner", relation: "partner", diet: b.partnerDiet }] : [],
    });
    for (const a of answers) {
      await q("insert into onboarding_responses (user_id, pair_id, choice, ms) values ($1,$2,$3,$4)", [uid, a.card_id, a.choice, a.ms ?? null]);
    }
    for (const attr of (b.dealbreakers ?? []) as string[]) {
      await q("insert into dealbreakers (id, user_id, attribute, label, kind, confidence, source, status) values ($1,$2,$3,$4,'hard',1,'onboarding','confirmed')", [rid("db_"), uid, attr, `Never: ${TAG_LABEL[attr]?.toLowerCase() ?? attr}`]);
    }
    await logSignal(uid, sid, "onboarding_complete", "stated", { answers: answers.length, parties, diet: b.diet });
    return { persona: r.persona, blurb: personaBlurb(r.dims, r.needs), dims: r.dims, intents: r.intents };
  });
}
