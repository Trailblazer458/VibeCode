import { DEST_BY_ID } from "@/lib/data/catalog";
import { DEFAULT_PAX } from "@/lib/engine/plan";
import { buildTriggers, nextWindow } from "@/lib/engine/triggers";
import { NEED_EMOJI, NEED_LABEL, NEED_SUBS, PARTY_LABEL } from "@/lib/engine/weights";
import { q } from "@/lib/db";
import { defaultRequest, handle, requireUser, runPlans, sessionBoost } from "@/lib/server";
import type { Need, Party } from "@/lib/types";
import { NEEDS } from "@/lib/types";

export async function GET() {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    if (!profile.onboarded) return { needsOnboarding: true };
    const window = nextWindow();
    const intents = (profile.intents ?? []).slice(0, 3);
    const rows = [];
    for (const it of intents) {
      const req = defaultRequest(profile, it.need, it.party, { maxPlans: 3, minPlans: 3 });
      const r = await runPlans(uid, sid, profile, req, "feed");
      rows.push({
        need: it.need, party: it.party, label: `${NEED_EMOJI[it.need]} ${NEED_LABEL[it.need]} · ${PARTY_LABEL[it.party]}`,
        sub: NEED_SUBS[it.need], setId: r.setId, plans: r.plans, criteria: r.criteria,
      });
    }
    // "Something different": the strongest need state outside the top 3, so the profile can grow.
    const used = new Set(intents.map((i) => i.need));
    const nextNeed = (Object.entries(profile.need_affinity ?? {}).sort((a, b) => b[1] - a[1]).map(([n]) => n as Need).find((n) => !used.has(n)) ??
      NEEDS.find((n) => !used.has(n))) as Need;
    const altParty: Party = nextNeed === "reflect" ? "family_elders" : nextNeed === "reconnect" ? "family_kids" : profile.default_party;
    const alt = await runPlans(uid, sid, profile, defaultRequest(profile, nextNeed, altParty, { maxPlans: 3, minPlans: 3, pax: DEFAULT_PAX[altParty] }), "feed_different");
    const boost = await sessionBoost(uid, sid);
    const trips = await q<{ name: string }>("select t.name from trips t join trip_members m on m.trip_id = t.id where m.user_id = $1 and t.kind = 'group' and t.status = 'planning'", [uid]);
    const nudges = buildTriggers({ personalDates: profile.personal_dates, calendarOptIn: profile.calendar_opt_in, segment: profile.segment, ignored: profile.ignored_nudges, groupInvites: trips.map((t) => ({ tripName: t.name, from: "Rohan" })) });
    return {
      profile: { name: profile.name, persona: profile.persona },
      window,
      trigger: nudges.triggers.find((t) => t.type === "calendar") ?? null,
      rows,
      different: { need: nextNeed, party: altParty, label: `${NEED_EMOJI[nextNeed]} ${NEED_LABEL[nextNeed]} · ${PARTY_LABEL[altParty]}`, plan: alt.plans[0] ?? null, setId: alt.setId },
      boosted: Object.keys(boost).map((d) => DEST_BY_ID.get(d)?.name),
    };
  });
}
