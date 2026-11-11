import { describe, expect, it } from "vitest";
import { applyOnboarding, CARDS, engagementUpdate } from "../lib/engine/profile";

const base = {
  dims: { social: 0.5, comfort: 0.5, nature: 0.5, luxury: 0.5 },
  need_affinity: { thrill: 0.8, celebrate: 0.6, rest: 0.45, reflect: 0.42 },
  intents: [{ need: "thrill", party: "friends", score: 0.8 }, { need: "celebrate", party: "couple", score: 0.6 }, { need: "rest", party: "solo", score: 0.45 }],
  default_party: "friends",
} as Parameters<typeof engagementUpdate>[0];

describe("likes and saves feed the profile", () => {
  it("raises the trip type and moves style dims towards the liked trip", () => {
    const u = engagementUpdate(base, { need: "reflect", attrs: { luxury: 0.9, nightlife: 0.1, comfort: 0.5, nature: 0.8 } }, 1.5);
    expect(u.need_affinity.reflect).toBeGreaterThan(base.need_affinity.reflect);
    expect(u.dims.luxury).toBeGreaterThan(0.5);
    expect(u.dims.social).toBeLessThan(0.5);
    expect(u.dims.comfort).toBe(0.5);
  });

  it("swaps the weakest For You row only when the liked type overtakes it, keeping row order", () => {
    const u = engagementUpdate(base, { need: "reflect" }, 1.5); // 0.42 + 0.075 > 0.45
    expect(u.intents.map((i) => i.need)).toEqual(["thrill", "celebrate", "reflect"]);
    const small = engagementUpdate(base, { need: "escape" }, 1); // 0.3 + 0.05 < 0.45
    expect(small.intents.map((i) => i.need)).toEqual(["thrill", "celebrate", "rest"]);
  });

  it("undoing a like reverses the nudge", () => {
    const liked = engagementUpdate(base, { need: "rest", attrs: { luxury: 0.9 } }, 1);
    const undone = engagementUpdate({ ...base, ...liked }, { need: "rest", attrs: { luxury: 0.9 } }, -1);
    expect(undone.need_affinity.rest).toBeCloseTo(base.need_affinity.rest);
    expect(undone.dims.luxury).toBeCloseTo(0.5);
  });
});

describe("yes/no onboarding", () => {
  const all = (ids: string[], choice: "yes" | "no") => ids.map((card_id) => ({ card_id, choice }));
  it("a thrill-seeker who says yes to the dawn trek and no to slow mornings leads with Thrill", () => {
    const r = applyOnboarding([...all(["c02"], "yes"), ...all(["c01", "c09", "c13"], "no")], ["friends"]);
    expect(r.intents[0].need).toBe("thrill");
    expect(r.needs.rest).toBeLessThan(0.3);
    expect(r.dims.pace).toBeGreaterThan(0.5);
  });

  it("a no moves the profile the other way, at half the strength of a yes", () => {
    const yes = applyOnboarding(all(["c13"], "yes"), ["solo"]);
    const no = applyOnboarding(all(["c13"], "no"), ["solo"]);
    expect(yes.dims.spiritual - 0.5).toBeCloseTo(2 * (0.5 - no.dims.spiritual));
    expect(no.needs.reflect).toBeLessThan(0.2);
  });

  it("is eight cards that between them reach every need state", () => {
    expect(CARDS.length).toBe(8);
    const reached = new Set(CARDS.flatMap((c) => Object.keys(c.needs)));
    expect([...reached].sort()).toEqual(["celebrate", "escape", "explore", "indulge", "learn", "reconnect", "reflect", "rest", "thrill"]);
  });

  it("every card points at a real photo and moves at least one need", () => {
    for (const c of CARDS) {
      expect(c.img).toMatch(/^\/onboarding\/p\d{2}[ab]\.jpg$/);
      expect(Object.keys(c.needs).length).toBeGreaterThan(0);
    }
  });
});
