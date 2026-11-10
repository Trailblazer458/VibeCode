// Synthetic guest reviews written in mixed intent voices, plus the extraction and aggregation steps.
// In production: reviews come from the OTA's verified stays; extraction runs as an offline batch job
// (see scripts/extract-reviews.ts, which uses Grok when XAI_API_KEY is set).
import { ALL_ITEMS } from "./catalog";
import { BASE_VALENCE, PARTY_WEIGHTS } from "../engine/weights";
import type { Aspect, Item, Party } from "../types";
import { PARTIES } from "../types";

type Bank = Partial<Record<Aspect, { high: [string, string]; low: [string, string] }>>;
// [positive tone, negative tone]
export const PHRASES: Bank = {
  quiet: {
    high: ["Blissfully quiet at night, we slept like babies.", "So quiet it felt dead; nothing happening around."],
    low: ["Always buzzing around the property, never a dull moment.", "Constant noise from the road and neighbours, hard to sleep."],
  },
  nightlife: {
    high: ["Bars and live music right outside, perfect for a night out.", "Music from the bars went on till 2am, the kids couldn't sleep."],
    low: ["Peaceful after dark, just crickets and stars.", "Nothing to do after 9pm, the area goes completely dead."],
  },
  kid_friendly: {
    high: ["The kids loved the play area and the staff were great with them.", "Full of children running around, not ideal for a couples' break."],
    low: ["Adults-only feel, very calm and grown-up.", "Not set up for kids at all, no space for them to play."],
  },
  elder_friendly: {
    high: ["Lift, ramps and ground-floor rooms, easy for my parents.", "Very accessible, though it felt a bit sleepy for us."],
    low: ["Steep stairs and lots of steps, adventurous for the young.", "No lift and three floors of stairs, tough for my parents."],
  },
  safety: {
    high: ["Felt completely safe walking back late, well-lit area.", "Very secure, maybe a little too guarded."],
    low: ["Edgy area, which added to the backpacker vibe.", "The lane was dark and deserted at night, didn't feel safe."],
  },
  veg_food: {
    high: ["Excellent vegetarian options, even a separate veg kitchen.", "Veg only, so no chicken for the meat-lovers among us."],
    low: ["Great meat dishes, the kebabs were the highlight.", "Barely any vegetarian choices, my wife struggled at meals."],
  },
  romance: {
    high: ["Candle-lit dinner by the water, perfect for our anniversary.", "Very couple-heavy crowd; felt odd as a group."],
    low: ["Casual and lively, not the honeymoon kind of place.", "Zero ambience, not what we wanted for our anniversary."],
  },
  luxury: {
    high: ["Five-star service, plush rooms and a gorgeous pool.", "Overpriced luxury, we paid for frills we didn't need."],
    low: ["No-frills and honest, all we needed.", "Felt basic and dated for the price."],
  },
  value: {
    high: ["Fantastic value for money, easy on the wallet.", "Cheap, and it shows in the upkeep."],
    low: ["Pricey, but you get what you pay for.", "Way too expensive for what you get."],
  },
  adventure: {
    high: ["Rafting and treks organised from the doorstep, adrenaline all day!", "Very activity-heavy, exhausting for my parents."],
    low: ["Gentle and laid-back, no pressure to do anything.", "Nothing adventurous to do around here, got bored."],
  },
  comfort: {
    high: ["Super comfortable beds and spotless bathrooms.", "Comfortable but a bit sterile, like a business hotel."],
    low: ["Rustic and raw, part of the charm.", "Thin mattresses and patchy hot water, uncomfortable."],
  },
  social: {
    high: ["Made friends from five countries at the common room!", "Very social and loud, hard to have quiet time."],
    low: ["Private and secluded, nobody bothers you.", "Felt isolated, no other travellers to talk to."],
  },
  crowd: {
    high: ["Lively crowds, festive energy everywhere.", "Packed with tourists, long queues everywhere."],
    low: ["Uncrowded and calm, we had the place to ourselves.", "Deserted, felt a little eerie."],
  },
  scenic: {
    high: ["The view from the balcony is unreal, worth every rupee.", "Great view, but that's all it has going for it."],
    low: ["Not much of a view, but you won't spend time in the room.", "Window faces a wall, disappointing."],
  },
  wellness: {
    high: ["The spa and morning yoga reset me completely.", "Wellness-retreat vibe, a bit too slow for us."],
    low: ["Not a wellness place, but nobody comes here for that.", "No spa or yoga despite what the listing implied."],
  },
  spiritual: {
    high: ["Steps from the ghats; the aarti every evening was moving.", "Very religious atmosphere, bells from 5am."],
    low: ["Secular and modern, easy for everyone.", "Far from the temple, darshan was a long trek."],
  },
  food_adventure: {
    high: ["The street food around here is legendary, eat everything!", "Spicy and adventurous, the kids barely ate."],
    low: ["Simple, familiar food, nothing fussy.", "Bland, predictable menu."],
  },
  convenience: {
    high: ["Walking distance to everything, super convenient.", "Central, which means traffic and honking."],
    low: ["Tucked away and peaceful, worth the drive.", "Far from everything, cabs cost a fortune."],
  },
  culture: {
    high: ["Living history all around, every lane has a story.", "Monument after monument, history overload for the kids."],
    low: ["Modern and easy-going, not a history trip.", "Not much culture or heritage to see."],
  },
  nature: {
    high: ["Surrounded by forest and river, pure nature.", "Too remote and wild, insects everywhere."],
    low: ["Urban and convenient, everything within reach.", "Concrete all around, no greenery."],
  },
  work_friendly: {
    high: ["Fast Wi-Fi and a proper desk, worked two days from here.", "Full of laptops, felt like a co-working space."],
    low: ["Patchy signal, a real digital detox.", "Wi-Fi kept dropping, couldn't take a single call."],
  },
};

export const PARTY_INTROS: Record<Party, string[]> = {
  solo: ["Solo trip.", "Travelled alone for a reset."],
  couple: ["Anniversary weekend with my wife.", "Couple's getaway."],
  friends: ["Weekend with college friends.", "Gang of five from Gurgaon."],
  family_kids: ["Family trip with two kids.", "Came with our six-year-old."],
  family_elders: ["Brought my parents, both in their 60s.", "Trip with my in-laws."],
};

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function valence(party: Party, a: Aspect): number {
  return (PARTY_WEIGHTS[party][a] ?? 0) + (BASE_VALENCE[a] ?? 0);
}

export interface SeedReview {
  id: string;
  item_id: string;
  party: Party;
  text: string;
  rating: number;
  date: string;
}

const COUNT: Record<string, number> = { stay: 9, food: 4, activity: 4, destination: 6, transport: 0 };

export function generateReviews(items: Item[] = ALL_ITEMS): SeedReview[] {
  const out: SeedReview[] = [];
  for (const item of items) {
    const n = COUNT[item.kind] ?? 0;
    const r = rng(item.id);
    const salient = (Object.entries(item.priors) as [Aspect, number][])
      .filter(([a, v]) => PHRASES[a] && Math.abs(v - 0.5) >= 0.2)
      .sort((x, y) => Math.abs(y[1] - 0.5) - Math.abs(x[1] - 0.5))
      .slice(0, 6);
    if (!salient.length) continue;
    for (let i = 0; i < n; i++) {
      const party = PARTIES[Math.floor(r() * PARTIES.length)];
      const intro = PARTY_INTROS[party][Math.floor(r() * 2)];
      const picks = new Set<number>();
      while (picks.size < Math.min(2, salient.length)) picks.add(Math.floor(r() * salient.length));
      let score = 0;
      const sentences = [...picks].map((idx) => {
        const [a, v] = salient[idx];
        const high = v + (r() - 0.5) * 0.2 > 0.5;
        const val = valence(party, a);
        // "positive" means this reviewer liked how much of the aspect there was
        const likes = high ? val >= 0 : val < 0;
        score += likes ? 1 : -1;
        const pair = PHRASES[a]![high ? "high" : "low"];
        return likes ? pair[0] : pair[1];
      });
      const month = 1 + Math.floor(r() * 22); // Jan 2025 .. Oct 2026
      const y = 2025 + Math.floor((month - 1) / 12);
      const m = ((month - 1) % 12) + 1;
      out.push({
        id: `${item.id}-r${i + 1}`,
        item_id: item.id,
        party,
        text: `${intro} ${sentences.join(" ")}`,
        rating: Math.max(1, Math.min(5, 3 + score + (r() > 0.6 ? 1 : 0))),
        date: `${y}-${String(m).padStart(2, "0")}-${String(1 + Math.floor(r() * 27)).padStart(2, "0")}`,
      });
    }
  }
  return out;
}

export interface Extraction {
  review_id: string;
  item_id: string;
  party: Party | null;
  aspect: Aspect;
  level: number; // how much of the aspect the reviewer observed (0..1)
  sentiment: number; // +1 liked it, -1 disliked
  snippet: string;
}

const REVERSE = new Map<string, { aspect: Aspect; level: number; sentiment: number }>();
for (const [a, v] of Object.entries(PHRASES) as [Aspect, { high: [string, string]; low: [string, string] }][]) {
  REVERSE.set(v.high[0], { aspect: a, level: 0.9, sentiment: 1 });
  REVERSE.set(v.high[1], { aspect: a, level: 0.9, sentiment: -1 });
  REVERSE.set(v.low[0], { aspect: a, level: 0.1, sentiment: 1 });
  REVERSE.set(v.low[1], { aspect: a, level: 0.1, sentiment: -1 });
}

/** Rule-based extractor used when no LLM key is configured. Grok does the same job in scripts/extract-reviews.ts. */
export function extractHeuristic(r: { id: string; item_id: string; text: string }): Extraction[] {
  let party: Party | null = null;
  for (const [p, intros] of Object.entries(PARTY_INTROS) as [Party, string[]][]) {
    if (intros.some((i) => r.text.startsWith(i))) party = p;
  }
  const out: Extraction[] = [];
  for (const [phrase, meta] of REVERSE) {
    if (r.text.includes(phrase)) out.push({ review_id: r.id, item_id: r.item_id, party, snippet: phrase, ...meta });
  }
  return out;
}

export const LENSES = ["all", ...PARTIES] as const;
export type Lens = (typeof LENSES)[number];

/**
 * Aggregation: per item × lens (party) × aspect, blend the listing prior with review evidence.
 * Reviews from travellers with the same party count double for that lens; recent reviews count more;
 * few reviews pull the score towards the prior (Bayesian shrinkage, K = 2).
 */
export function aggregate(item: Item, ex: Extraction[], reviewsById: Map<string, SeedReview>) {
  const K = 2;
  const res: Record<string, { aspects: Record<string, number>; confidence: number }> = {};
  for (const lens of LENSES) {
    const aspects: Record<string, number> = {};
    let totalW = 0;
    const acc: Record<string, { s: number; w: number }> = {};
    for (const e of ex) {
      const rv = reviewsById.get(e.review_id);
      const ageMonths = rv ? Math.max(0, (2026 - +rv.date.slice(0, 4)) * 12 + (10 - +rv.date.slice(5, 7))) : 12;
      const recency = Math.max(0.5, 1 - ageMonths / 48);
      const w = recency * (lens !== "all" && e.party === lens ? 2 : 1);
      acc[e.aspect] ??= { s: 0, w: 0 };
      acc[e.aspect].s += w * e.level;
      acc[e.aspect].w += w;
      totalW += w;
    }
    const keys = new Set([...Object.keys(item.priors), ...Object.keys(acc)]);
    for (const a of keys) {
      const prior = (item.priors as Record<string, number>)[a] ?? 0.5;
      const ev = acc[a];
      aspects[a] = ev ? (prior * K + ev.s) / (K + ev.w) : prior;
    }
    res[lens] = { aspects, confidence: totalW / (totalW + 6) };
  }
  return res;
}
