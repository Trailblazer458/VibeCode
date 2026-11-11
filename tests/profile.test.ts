import { describe, expect, it } from "vitest";
import { engagementUpdate } from "../lib/engine/profile";

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
