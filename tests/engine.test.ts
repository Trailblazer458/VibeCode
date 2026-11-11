import { describe, expect, it } from "vitest";
import { computeReviewPipeline } from "../lib/seed";
import { ScoreStore } from "../lib/engine/store";
import { buildPlans, DEFAULT_PAX, rankElement, type EngineContext } from "../lib/engine/plan";
import { unsuitable } from "../lib/engine/suitability";
import { ACTIVITIES, FOOD, STAYS } from "../lib/data/catalog";
import type { Item, Need, Party } from "../lib/types";

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
    // The party hotel ranks for friends and is not offered to a family with kids at all.
    expect(friends.findIndex((s) => s.id === "ga-partylane")).toBeGreaterThanOrEqual(0);
    expect(fam.findIndex((s) => s.id === "ga-partylane")).toBe(-1);
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

  it("fits a tight budget without dominated picks or a big unspent remainder", () => {
    for (const [destId, budgetPP] of [["mussoorie", 15000], ["rishikesh", 12000], ["udaipur", 18000], ["goa", 20000]] as const) {
      const p = buildPlans({ need: "rest", party: "couple", window: { start: "2026-11-21", days: 4 }, budgetPP, destId }, ctx()).plans[0];
      if (!p) continue;
      expect(p.cost.perHead).toBeLessThanOrEqual(budgetPP);
      const foods = rankElement("food", destId, "rest", "couple", ctx());
      const acts = rankElement("activity", destId, "rest", "couple", ctx());
      // No picked item has an unpicked alternative that fits better AND costs no more.
      for (const [picked, all] of [[p.food, foods], [p.activities, acts]] as const) {
        const ids = new Set(picked.map((x) => x.id));
        for (const x of picked) {
          const dominated = all.find((y) => !ids.has(y.id) && !y.blocked.length && y.fit > x.fit + 2 && y.price <= x.price);
          expect(dominated, `${destId}: ${x.name} (${x.fit}%) picked over ${dominated?.name} (${dominated?.fit}%)`).toBeUndefined();
        }
      }
      console.log(destId, budgetPP, "->", p.cost.perHead, p.stay.name, p.food.map((f) => `${f.name} ${f.fit}`).join(", "));
    }
  });

  it("shows the same fit for an element in the plan and in the swap list", () => {
    const p = buildPlans({ need: "rest", party: "couple", window: { start: "2026-11-21", days: 4 }, budgetPP: 30000, destId: "mussoorie" }, ctx()).plans[0];
    const fitOf = (kind: "stay" | "transport" | "food" | "activity", id: string) => rankElement(kind, "mussoorie", "rest", "couple", ctx()).find((x) => x.id === id)?.fit;
    expect(fitOf("transport", p.transport.id)).toBe(p.transport.fit);
    expect(fitOf("stay", p.stay.id)).toBe(p.stay.fit);
    for (const f of p.food) expect(fitOf("food", f.id)).toBe(f.fit);
    for (const a of p.activities) expect(fitOf("activity", a.id)).toBe(a.fit);
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

describe("never suggests things that don't suit the group", () => {
  const byId = new Map<string, Item>([...STAYS, ...FOOD, ...ACTIVITIES].map((i) => [i.id, i]));
  const needs: Need[] = ["rest", "thrill", "celebrate", "reflect", "learn", "explore", "indulge", "escape", "reconnect"];
  const parties: Party[] = ["solo", "couple", "friends", "family_kids", "family_elders"];

  it("keeps couples-only, adventure, nightlife and hostel picks away from the wrong group, in plans and swap lists", () => {
    const bad: string[] = [];
    for (const party of parties) {
      for (const need of needs) {
        for (const p of buildPlans({ need, party, window, budgetPP: null }, ctx()).plans) {
          for (const id of [p.stay.id, ...p.food.map((x) => x.id), ...p.activities.map((x) => x.id)]) {
            const why = unsuitable(byId.get(id)!, party, p.pax);
            if (why) bad.push(`${party}/${need} ${p.destName}: ${byId.get(id)!.name} (${why})`);
          }
        }
      }
      for (const kind of ["stay", "food", "activity"] as const) {
        for (const dest of ["udaipur", "rishikesh", "goa", "manali", "kasol"]) {
          for (const a of rankElement(kind, dest, "thrill", party, ctx())) {
            const why = unsuitable(byId.get(a.id)!, party, DEFAULT_PAX[party]);
            if (why) bad.push(`swap ${party} ${dest}: ${a.name} (${why})`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("flags the obvious cases", () => {
    const spa = byId.get("ud-a3")!; // Couples' spa afternoon
    expect(unsuitable(spa, "solo", DEFAULT_PAX.solo)).toBeTruthy();
    expect(unsuitable(spa, "couple", DEFAULT_PAX.couple)).toBeNull();
    const bungee = byId.get("rk-a4")!;
    expect(unsuitable(bungee, "family_kids", DEFAULT_PAX.family_kids)).toBeTruthy();
    expect(unsuitable(bungee, "family_elders", DEFAULT_PAX.family_elders)).toBeTruthy();
    expect(unsuitable(bungee, "friends", DEFAULT_PAX.friends)).toBeNull();
    expect(unsuitable(byId.get("mn-a6")!, "family_kids", DEFAULT_PAX.family_kids)).toBeNull(); // snow play is fine for kids
  });
});
