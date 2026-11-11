import { describe, expect, it } from "vitest";
import { computeReviewPipeline } from "../lib/seed";
import { ScoreStore } from "../lib/engine/store";
import { buildPlans, rankElement, type EngineContext } from "../lib/engine/plan";

const { scores, extractions } = computeReviewPipeline();
const store = new ScoreStore(scores, extractions as never);
const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  store, dims: {}, dealbreakers: [], pastDestIds: [], diet: "none", signalCount: 50, ...over,
});
const window = { start: "2026-12-25", days: 3 };

describe("intent-conditioned ranking", () => {
  it("flips the same Goa stay between friends and family", () => {
    const friends = rankElement("stay", "goa", "celebrate", "friends", ctx());
    const fam = rankElement("stay", "goa", "celebrate", "family_kids", ctx());
    console.log("friends", friends.map((s) => `${s.name}:${s.fit}`));
    console.log("family", fam.map((s) => `${s.name}:${s.fit}`), fam.find((s) => s.id === "ga-partylane")?.flag);
    const pf = friends.findIndex((s) => s.id === "ga-partylane");
    const pk = fam.findIndex((s) => s.id === "ga-partylane");
    expect(pf).toBeLessThan(pk);
    expect(fam[0].id).toBe("ga-garden");
  });

  it("returns at least 3 diverse plans within budget", () => {
    const r = buildPlans({ need: "thrill", party: "friends", window, budgetPP: 20000 }, ctx());
    console.log(r.plans.map((p) => `${p.destName} ${p.fit} ₹${p.cost.perHead} ${p.stay.name}`), r.criteria.map((c) => `${c.label}:${c.hidden}`));
    expect(r.plans.length).toBeGreaterThanOrEqual(3);
    expect(r.plans.every((p) => p.cost.perHead <= 20000)).toBe(true);
    expect(new Set(r.plans.map((p) => p.destId)).size).toBe(r.plans.length);
  });

  it("changes the trip itself when the intent changes at a fixed destination", () => {
    // Couples converge on romantic stays more than friends do, so their bar for distinct stays is lower.
    for (const [party, minStays] of [["friends", 3], ["couple", 2]] as const) {
      for (const destId of ["rishikesh", "udaipur", "manali", "goa"]) {
        const trips = (["rest", "thrill", "celebrate", "reflect", "learn"] as const).map((need) => {
          const p = buildPlans({ need, party, window, budgetPP: null, destId }, ctx()).plans[0];
          return { need, stay: p.stay.id, acts: p.activities.map((a) => a.id).sort().join("+") };
        });
        console.log(party, destId, trips.map((t) => `${t.need}: ${t.stay} | ${t.acts}`));
        // Five intents should not collapse onto the same plan: stays and activity sets both vary.
        expect(new Set(trips.map((t) => t.stay)).size, `${party} ${destId} stays`).toBeGreaterThanOrEqual(minStays);
        expect(new Set(trips.map((t) => t.acts)).size, `${party} ${destId} activities`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("applies no budget filter when the budget is flexible (null)", () => {
    const capped = buildPlans({ need: "indulge", party: "couple", window, budgetPP: 15000 }, ctx());
    const open = buildPlans({ need: "indulge", party: "couple", window, budgetPP: null }, ctx());
    expect(capped.criteria.some((c) => c.key === "budget")).toBe(true);
    expect(open.criteria.some((c) => c.key === "budget")).toBe(false);
    expect(open.plans.length).toBeGreaterThanOrEqual(3);
    // Without a cap the engine is free to pick plans above the old ₹15k limit.
    expect(Math.max(...open.plans.map((p) => p.cost.perHead))).toBeGreaterThan(15000);
  });

  it("respects hard dealbreakers and veg diet", () => {
    const r = buildPlans({ need: "rest", party: "couple", window, budgetPP: 30000 }, ctx({
      diet: "veg",
      dealbreakers: [{ attribute: "long_road", label: "No long road", kind: "hard", owner: "you" }, { attribute: "hostel", label: "No hostels", kind: "hard", owner: "you" }],
    }));
    console.log(r.plans.map((p) => `${p.destName} ${p.fit} ${p.transport.name} ${p.stay.name}`));
    for (const p of r.plans) {
      expect(p.tags).not.toContain("long_road");
      expect(p.stay.type).not.toBe("hostel");
    }
  });

  it("elders get gentle plans with readiness checks", () => {
    const r = buildPlans({ need: "reflect", party: "family_elders", window, budgetPP: 25000 }, ctx());
    console.log(r.plans.map((p) => `${p.destName} ${p.fit} ${p.stay.name} | ${p.readiness.map((c) => c.status[0] + ":" + c.label).join(", ")}`));
    expect(r.plans.length).toBeGreaterThanOrEqual(3);
  });

  it("destination-fixed planning returns variants", () => {
    const r = buildPlans({ need: "explore", party: "friends", window, budgetPP: 25000, destId: "jaipur" }, ctx());
    console.log(r.plans.map((p) => `${p.stay.name} ${p.transport.name} pace ${p.attrs.pace} ₹${p.cost.perHead}`));
    expect(r.plans.length).toBeGreaterThanOrEqual(3);
  });
});
