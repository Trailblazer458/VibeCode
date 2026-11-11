import { describe, expect, it } from "vitest";
import { PARTY_INTROS, PHRASES } from "../lib/data/reviews";
import { computeReviewPipeline } from "../lib/seed";

const phrases: string[] = [];
for (const v of Object.values(PHRASES)) for (const s of [v!.high, v!.low]) for (const l of [s.pos, s.neg]) for (const p of l) phrases.push(typeof p === "string" ? p : p.t);

describe("synthetic review bank", () => {
  it("has unique phrases that never contain each other (extraction matches by substring)", () => {
    expect(phrases.filter((x, i) => phrases.indexOf(x) !== i)).toEqual([]);
    expect(phrases.filter((x) => phrases.some((y) => y !== x && y.includes(x)))).toEqual([]);
    const intros = Object.values(PARTY_INTROS).flat();
    expect(intros.filter((x) => intros.some((y) => y !== x && y.startsWith(x)))).toEqual([]);
  });

  it("produces varied, party-tagged evidence", () => {
    const { reviews, extractions } = computeReviewPipeline();
    const snippets = new Set(extractions.map((e) => e.snippet));
    console.log(`phrases ${phrases.length}, reviews ${reviews.length}, extractions ${extractions.length}, distinct snippets ${snippets.size}`);
    expect(reviews.length).toBeGreaterThan(2000);
    expect(snippets.size).toBeGreaterThan(150);
    expect(extractions.every((e) => e.party)).toBe(true);
  });
});

describe("review evidence", () => {
  it("never uses a complaint as 'why it fits' evidence when praise exists", async () => {
    const { ScoreStore } = await import("../lib/engine/store");
    const { scores, extractions } = computeReviewPipeline();
    const store = new ScoreStore(scores, extractions as never);
    let checked = 0;
    for (const e of extractions) {
      const praise = extractions.some((x) => x.item_id === e.item_id && x.aspect === e.aspect && x.sentiment === 1 && (x.level >= 0.5) === (e.level >= 0.5));
      if (!praise) continue;
      const top = store.snippets(e.item_id, e.aspect, "friends", e.level >= 0.5, 1, 1)[0];
      expect(top?.sentiment).toBe(1);
      if (++checked > 400) break;
    }
  });
});
