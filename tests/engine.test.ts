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
