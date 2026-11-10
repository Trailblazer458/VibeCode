// Offline batch job: re-extract aspects from every review with Grok, then recompute item × lens × aspect scores.
// Run: XAI_API_KEY=... DATABASE_URL=... npx tsx scripts/extract-reviews.ts
// Without XAI_API_KEY it keeps the rule-based extraction that the seed already wrote.
import { ALL_ITEMS } from "../lib/data/catalog";
import { aggregate, type Extraction, type SeedReview } from "../lib/data/reviews";
import { driver, ensureReady, bulkInsert } from "../lib/db";
import { grok } from "../lib/llm";
import { ASPECTS, PARTIES } from "../lib/types";

const PROMPT = `Extract travel review aspects. For each review return {"id", "party": one of [${PARTIES.join(", ")}] or null,
"aspects": [{"aspect": one of [${ASPECTS.join(", ")}], "level": 0..1 (how much of it the guest observed), "sentiment": 1 or -1 (did they like it), "snippet": exact sentence}]}.
Return ONLY {"reviews": [...]}. "Music till 2am, kids couldn't sleep" = nightlife level 0.9, sentiment -1, party family_kids.`;

async function main() {
  await ensureReady();
  const d = await driver();
  const reviews = await d.query<SeedReview>("select id, item_id, party, text, rating, date::text as date from reviews");
  if (!process.env.XAI_API_KEY) {
    console.log("No XAI_API_KEY: keeping rule-based extractions.");
    return;
  }
  const out: Extraction[] = [];
  for (let i = 0; i < reviews.length; i += 8) {
    const batch = reviews.slice(i, i + 8);
    const r = await grok([{ role: "system", content: PROMPT }, { role: "user", content: JSON.stringify(batch.map((b) => ({ id: b.id, text: b.text }))) }], true, 60000);
    for (const rv of r?.reviews ?? []) {
      const src = batch.find((b) => b.id === rv.id);
      if (!src) continue;
      for (const a of rv.aspects ?? []) {
        if (!ASPECTS.includes(a.aspect)) continue;
        out.push({ review_id: src.id, item_id: src.item_id, party: PARTIES.includes(rv.party) ? rv.party : null, aspect: a.aspect, level: Number(a.level), sentiment: a.sentiment > 0 ? 1 : -1, snippet: a.snippet });
      }
    }
    process.stdout.write(`\r${Math.min(i + 8, reviews.length)}/${reviews.length}`);
  }
  console.log(`\n${out.length} extractions`);
  await d.query("delete from review_extractions");
  await bulkInsert(d, "review_extractions", out.map((e) => ({ ...e, extractor: "grok" })));
  const byId = new Map(reviews.map((r) => [r.id, r]));
  const scores = ALL_ITEMS.flatMap((item) =>
    Object.entries(aggregate(item, out.filter((e) => e.item_id === item.id), byId)).map(([lens, v]) => ({ item_id: item.id, lens, aspects: v.aspects, confidence: v.confidence })),
  );
  await d.query("delete from item_aspect_scores");
  await bulkInsert(d, "item_aspect_scores", scores);
  console.log(`Recomputed ${scores.length} item × lens scores.`);
  process.exit(0);
}
main();
