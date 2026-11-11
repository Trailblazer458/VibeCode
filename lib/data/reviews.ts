// Synthetic guest reviews written in mixed intent voices, plus the extraction and aggregation steps.
// In production: reviews come from the OTA's verified stays; extraction runs as an offline batch job
// (see scripts/extract-reviews.ts, which uses Grok when XAI_API_KEY is set).
import { ALL_ITEMS } from "./catalog";
import { BASE_VALENCE, PARTY_WEIGHTS } from "../engine/weights";
import type { Aspect, Item, Party } from "../types";
import { PARTIES } from "../types";

// A phrase is generic, or written in one party's voice ({ t, p }). Each slot keeps its original phrase first.
type V = string | { t: string; p: Party[] };
interface Slot { pos: V[]; neg: V[] }
type Bank = Partial<Record<Aspect, { high: Slot; low: Slot }>>;
const kids: Party[] = ["family_kids"];
const elders: Party[] = ["family_elders"];
const couple: Party[] = ["couple"];
const friends: Party[] = ["friends"];
const solo: Party[] = ["solo"];

// high/low = how much of the aspect the reviewer saw; pos/neg = whether they liked that.
export const PHRASES: Bank = {
  quiet: {
    high: {
      pos: ["Blissfully quiet at night, we slept like babies.", "Only birdsong in the morning, total peace.", "No traffic, no horns, just stillness.",
        { t: "Quiet enough to finally read a whole book alone.", p: solo }, { t: "So peaceful, my parents napped every afternoon.", p: elders },
        { t: "Calm and hushed, perfect for just the two of us.", p: couple }],
      neg: ["So quiet it felt dead; nothing happening around.", { t: "Too sleepy for our gang, we had to drive out for any fun.", p: friends },
        { t: "Pin-drop silence, the kids got restless by day two.", p: kids }],
    },
    low: {
      pos: ["Always buzzing around the property, never a dull moment.", { t: "Lively all evening, our group loved the energy.", p: friends }],
      neg: ["Constant noise from the road and neighbours, hard to sleep.", { t: "Horns and loudspeakers till late, my parents barely slept.", p: elders },
        { t: "Too noisy for a romantic break, thin walls everywhere.", p: couple }, { t: "Noise kept waking the baby, rough nights.", p: kids }],
    },
  },
  nightlife: {
    high: {
      pos: ["Bars and live music right outside, perfect for a night out.", { t: "We danced till 3am three nights in a row, best trip ever.", p: friends },
        { t: "Easy to meet people at the bars, never felt alone.", p: solo }, "Great choice of clubs and late cafés within walking distance."],
      neg: ["Music from the bars went on till 2am, the kids couldn't sleep.", { t: "Party crowd everywhere, not the setting for my parents.", p: elders },
        { t: "Loud party scene outside our window, killed the romance.", p: couple }],
    },
    low: {
      pos: ["Peaceful after dark, just crickets and stars.", { t: "Early nights and early mornings, exactly what we needed with the kids.", p: kids },
        { t: "No party noise, my parents loved the calm evenings.", p: elders }],
      neg: ["Nothing to do after 9pm, the area goes completely dead.", { t: "Zero nightlife, our gang was bored by 10pm.", p: friends },
        { t: "Wanted a drink after dinner, nothing open nearby.", p: couple }],
    },
  },
  kid_friendly: {
    high: {
      pos: ["The kids loved the play area and the staff were great with them.", { t: "Our six-year-old didn't want to leave the pool.", p: kids },
        { t: "Kids' menu, babysitting and a game room: a dream for parents.", p: kids }, { t: "Grandkids and grandparents both happy, rare find.", p: elders }],
      neg: ["Full of children running around, not ideal for a couples' break.", { t: "Felt like a school picnic, too many kids for a friends' trip.", p: friends },
        { t: "Kids screaming by the pool all day, hard to relax solo.", p: solo }],
    },
    low: {
      pos: ["Adults-only feel, very calm and grown-up.", { t: "No kids around, felt like our own private escape.", p: couple }],
      neg: ["Not set up for kids at all, no space for them to play.", { t: "No cots, no kids' food, our toddler was miserable.", p: kids },
        { t: "Nothing for the children to do, they were bored all day.", p: kids }],
    },
  },
  elder_friendly: {
    high: {
      pos: ["Lift, ramps and ground-floor rooms, easy for my parents.", { t: "Staff helped my father at every step, so caring.", p: elders },
        { t: "Wheelchair-friendly paths, my mother could go everywhere.", p: elders }, "Short walks and plenty of seating, very easy-going."],
      neg: ["Very accessible, though it felt a bit sleepy for us.", { t: "Felt like a retirement home, not our vibe.", p: friends }],
    },
    low: {
      pos: ["Steep stairs and lots of steps, adventurous for the young.", { t: "Climbing up to the room was half the adventure!", p: friends }],
      neg: ["No lift and three floors of stairs, tough for my parents.", { t: "My knees gave up on the slopes, wish we'd known.", p: elders },
        { t: "Uneven paths everywhere, I held my mother's arm the whole time.", p: elders }],
    },
  },
  safety: {
    high: {
      pos: ["Felt completely safe walking back late, well-lit area.", { t: "As a woman travelling alone, I felt safe at all hours.", p: solo },
        { t: "Gated and guarded, we let the kids roam freely.", p: kids }],
      neg: ["Very secure, maybe a little too guarded.", { t: "Security checks every time we came back, a bit much.", p: friends }],
    },
    low: {
      pos: ["Edgy area, which added to the backpacker vibe.", { t: "A bit rough around the edges, which made it feel real.", p: solo }],
      neg: ["The lane was dark and deserted at night, didn't feel safe.", { t: "Wouldn't walk back alone after dark here.", p: solo },
        { t: "Drunk crowds at night, we kept the kids inside.", p: kids }],
    },
  },
  veg_food: {
    high: {
      pos: ["Excellent vegetarian options, even a separate veg kitchen.", { t: "Pure veg and Jain options, my parents ate happily.", p: elders },
        "Best paneer we've had outside home, loads of veg choice."],
      neg: ["Veg only, so no chicken for the meat-lovers among us.", { t: "No non-veg at all, the boys complained every meal.", p: friends }],
    },
    low: {
      pos: ["Great meat dishes, the kebabs were the highlight.", { t: "Butter chicken at midnight, the gang was thrilled.", p: friends }],
      neg: ["Barely any vegetarian choices, my wife struggled at meals.", { t: "My vegetarian parents lived on dal and rice.", p: elders },
        { t: "Kids are vegetarian and the menu barely had anything for them.", p: kids }],
    },
  },
  romance: {
    high: {
      pos: ["Candle-lit dinner by the water, perfect for our anniversary.", "Fairy lights, soft music and a private table for two.", "Every corner felt made for couples.", { t: "Rose petals on the bed and a private balcony, he proposed here!", p: couple },
        { t: "Sunset from the room was pure magic for the two of us.", p: couple }],
      neg: ["Very couple-heavy crowd; felt odd as a group.", { t: "Honeymooners everywhere, awkward with the kids.", p: kids },
        { t: "Felt like the only solo traveller among couples.", p: solo }],
    },
    low: {
      pos: ["Casual and lively, not the honeymoon kind of place.", { t: "No mushy stuff, just a great base for our group.", p: friends }],
      neg: ["Zero ambience, not what we wanted for our anniversary.", { t: "Fluorescent lights and plastic chairs, not romantic at all.", p: couple }],
    },
  },
  luxury: {
    high: {
      pos: ["Five-star service, plush rooms and a gorgeous pool.", { t: "Butler, spa and a bathtub with a view, we felt royal.", p: couple },
        { t: "Pampered my parents properly for once, worth every rupee.", p: elders }],
      neg: ["Overpriced luxury, we paid for frills we didn't need.", { t: "Too fancy for us, we just needed beds and a base.", p: friends }],
    },
    low: {
      pos: ["No-frills and honest, all we needed.", { t: "Basic but clean, perfect for a backpacker budget.", p: solo }],
      neg: ["Felt basic and dated for the price.", { t: "Not special enough for an anniversary, sadly.", p: couple }],
    },
  },
  value: {
    high: {
      pos: ["Fantastic value for money, easy on the wallet.", { t: "Split four ways it cost less than a dinner in Gurgaon.", p: friends },
        { t: "Cheapest bed in town and still clean, great for solo travel.", p: solo }, "Honest prices, no hidden charges anywhere."],
      neg: ["Cheap, and it shows in the upkeep.", { t: "Budget place, felt too basic for my parents.", p: elders }],
    },
    low: {
      pos: ["Pricey, but you get what you pay for.", { t: "Splurged for our anniversary and don't regret it.", p: couple }],
      neg: ["Way too expensive for what you get.", { t: "Paid luxury prices for an average family room.", p: kids }],
    },
  },
  adventure: {
    high: {
      pos: ["Rafting and treks organised from the doorstep, adrenaline all day!", { t: "Something wild every morning and afternoon, our gang was buzzing.", p: friends },
        { t: "Joined a group trek on day one, made friends instantly.", p: solo }, "Every kind of activity is a short drive away."],
      neg: ["Very activity-heavy, exhausting for my parents.", { t: "Everything here is extreme, nothing gentle for the little ones.", p: kids }],
    },
    low: {
      pos: ["Gentle and laid-back, no pressure to do anything.", { t: "Easy walks only, just right for my parents.", p: elders }],
      neg: ["Nothing adventurous to do around here, got bored.", { t: "Came for adventure, found only souvenir shops.", p: friends }],
    },
  },
  comfort: {
    high: {
      pos: ["Super comfortable beds and spotless bathrooms.", "Spotless, cosy and everything just worked.", "Slept better here than at home, honestly.", { t: "Firm mattresses and warm water, my father slept well.", p: elders },
        "Room heater, good pillows, hot showers: everything worked."],
      neg: ["Comfortable but a bit sterile, like a business hotel.", { t: "Too much like a city hotel, wanted something rustic.", p: friends }],
    },
    low: {
      pos: ["Rustic and raw, part of the charm.", { t: "Thin mattress, great stories, would do it again.", p: solo }],
      neg: ["Thin mattresses and patchy hot water, uncomfortable.", { t: "Cold room and no geyser, my parents had a hard time.", p: elders },
        { t: "Damp sheets and a broken AC, not what you want with a toddler.", p: kids }],
    },
  },
  social: {
    high: {
      pos: ["Made friends from five countries at the common room!", { t: "Joined strangers for dinner every night, never felt solo.", p: solo },
        { t: "Big common area, our group took over the bonfire.", p: friends }],
      neg: ["Very social and loud, hard to have quiet time.", { t: "Strangers everywhere, hardly a private moment as a couple.", p: couple }],
    },
    low: {
      pos: ["Private and secluded, nobody bothers you.", { t: "Felt like our own private hideaway.", p: couple }],
      neg: ["Felt isolated, no other travellers to talk to.", { t: "Hard to meet anyone, lonely as a solo traveller.", p: solo }],
    },
  },
  crowd: {
    high: {
      pos: ["Lively crowds, festive energy everywhere.", { t: "The buzz of the crowds was half the fun for our group.", p: friends }],
      neg: ["Packed with tourists, long queues everywhere.", { t: "Pushed through crowds with my parents, very stressful.", p: elders },
        { t: "Lost sight of our son twice in the crowds, scary.", p: kids }],
    },
    low: {
      pos: ["Uncrowded and calm, we had the place to ourselves.", { t: "Hardly anyone around, felt like our private holiday.", p: couple }],
      neg: ["Deserted, felt a little eerie.", { t: "Too empty, no one around to share it with.", p: solo }],
    },
  },
  scenic: {
    high: {
      pos: ["The view from the balcony is unreal, worth every rupee.", "Golden-hour light from the terrace was unforgettable.", { t: "Woke up to that view from bed, my wife teared up a little.", p: couple },
        { t: "My parents sat on the balcony all day just watching the view.", p: elders }, "Every window frames a postcard."],
      neg: ["Great view, but that's all it has going for it.", "Pretty views, but the room itself was tired."],
    },
    low: {
      pos: ["Not much of a view, but you won't spend time in the room.", { t: "We were out all day anyway, the view didn't matter.", p: friends }],
      neg: ["Window faces a wall, disappointing.", { t: "Booked for the view on our anniversary, got a parking lot.", p: couple }],
    },
  },
  wellness: {
    high: {
      pos: ["The spa and morning yoga reset me completely.", { t: "Came burnt out, left after four days of yoga and silence feeling new.", p: solo },
        { t: "Couple's massage by the river, pure bliss.", p: couple }, { t: "Gentle yoga classes my parents could join too.", p: elders }],
      neg: ["Wellness-retreat vibe, a bit too slow for us.", { t: "Too much yoga, not enough fun for the gang.", p: friends }],
    },
    low: {
      pos: ["Not a wellness place, but nobody comes here for that.", { t: "No spa, no problem, we were out exploring.", p: friends }],
      neg: ["No spa or yoga despite what the listing implied.", { t: "Wanted a relaxing spa break, found nothing of the sort.", p: couple }],
    },
  },
  spiritual: {
    high: {
      pos: ["Steps from the ghats; the aarti every evening was moving.", { t: "My mother cried at the evening aarti, it meant so much to her.", p: elders },
        { t: "Morning prayers and evening aarti gave the trip real meaning.", p: solo }, "Temple bells and chanting all around, very soulful."],
      neg: ["Very religious atmosphere, bells from 5am.", { t: "Too much of a pilgrimage vibe for a friends' trip.", p: friends }],
    },
    low: {
      pos: ["Secular and modern, easy for everyone.", { t: "No temple crowds, just a relaxed holiday.", p: couple }],
      neg: ["Far from the temple, darshan was a long trek.", { t: "My parents wanted to be near the temple, it was a long drive.", p: elders }],
    },
  },
  food_adventure: {
    high: {
      pos: ["The street food around here is legendary, eat everything!", { t: "We did a food crawl every night, the gang ate like kings.", p: friends },
        { t: "Ate my way through the lanes alone, best solo food trip.", p: solo }, "Every corner has something new to taste."],
      neg: ["Spicy and adventurous, the kids barely ate.", { t: "Too spicy and oily for my parents' stomachs.", p: elders }],
    },
    low: {
      pos: ["Simple, familiar food, nothing fussy.", { t: "Plain dal-chawal that my parents loved.", p: elders }, { t: "Kids happily ate the simple food every day.", p: kids }],
      neg: ["Bland, predictable menu.", { t: "Same boring menu for four days, we were craving something local.", p: friends }],
    },
  },
  convenience: {
    high: {
      pos: ["Walking distance to everything, super convenient.", { t: "Could walk my parents to the main sights in minutes.", p: elders },
        "Cabs, cafés and markets right at the doorstep."],
      neg: ["Central, which means traffic and honking.", { t: "Right on the busy road, not the escape we wanted.", p: couple }],
    },
    low: {
      pos: ["Tucked away and peaceful, worth the drive.", { t: "Off the map in the best way, our secret hideout.", p: couple }],
      neg: ["Far from everything, cabs cost a fortune.", { t: "Every outing meant an hour's drive with cranky kids.", p: kids }],
    },
  },
  culture: {
    high: {
      pos: ["Living history all around, every lane has a story.", { t: "Our guide brought the history alive, the kids were hooked.", p: kids },
        { t: "Wandered the old lanes alone for hours, felt like time travel.", p: solo }, "Old temples, crafts and stories at every turn."],
      neg: ["Monument after monument, history overload for the kids.", { t: "Too many museums for our gang's liking.", p: friends }],
    },
    low: {
      pos: ["Modern and easy-going, not a history trip.", { t: "No sightseeing pressure, just chilling with the gang.", p: friends }],
      neg: ["Not much culture or heritage to see.", { t: "Hoped to learn about the place, found only malls.", p: solo }],
    },
  },
  nature: {
    high: {
      pos: ["Surrounded by forest and river, pure nature.", { t: "Spotted deer from the balcony, the kids went wild.", p: kids },
        { t: "Long green walks every morning, the reset I needed.", p: solo }, "Fresh air and greenery everywhere."],
      neg: ["Too remote and wild, insects everywhere.", { t: "Leeches on the trail and no network, my mother panicked.", p: elders }],
    },
    low: {
      pos: ["Urban and convenient, everything within reach.", { t: "City comforts close by, easy with my parents.", p: elders }],
      neg: ["Concrete all around, no greenery.", { t: "Came for the mountains, saw mostly buildings.", p: couple }],
    },
  },
  work_friendly: {
    high: {
      pos: ["Fast Wi-Fi and a proper desk, worked two days from here.", { t: "Took client calls from the balcony with a mountain view.", p: solo },
        "Power backup and strong Wi-Fi, never dropped a call."],
      neg: ["Full of laptops, felt like a co-working space.", { t: "Everyone was on Zoom calls, not much holiday feeling.", p: couple }],
    },
    low: {
      pos: ["Patchy signal, a real digital detox.", { t: "No signal meant no work calls, best thing for us.", p: couple }],
      neg: ["Wi-Fi kept dropping, couldn't take a single call.", { t: "Had to walk to the market to find signal for a meeting.", p: solo }],
    },
  },
};

export const PARTY_INTROS: Record<Party, string[]> = {
  solo: ["Solo trip.", "Travelled alone for a reset.", "First trip by myself.", "Came here on my own."],
  couple: ["Anniversary weekend with my wife.", "Couple's getaway.", "Honeymoon trip.", "Weekend away with my husband."],
  friends: ["Weekend with college friends.", "Gang of five from Gurgaon.", "Office friends' trip.", "Bachelor trip with the boys."],
  family_kids: ["Family trip with two kids.", "Came with our six-year-old.", "Holiday with our toddler.", "Family break with the children."],
  family_elders: ["Brought my parents, both in their 60s.", "Trip with my in-laws.", "Took my mother on her first big trip.", "Pilgrimage with my grandparents."],
};

const text = (v: V) => (typeof v === "string" ? v : v.t);
/** Pick a phrase for this reviewer: their own party's voice 60% of the time when one exists. */
function pickPhrase(list: V[], party: Party, r: () => number) {
  const own = list.filter((v) => typeof v !== "string" && v.p.includes(party));
  const generic = list.filter((v) => typeof v === "string");
  const pool = own.length && (r() < 0.6 || !generic.length) ? own : generic.length ? generic : list;
  return text(pool[Math.floor(r() * pool.length)]);
}

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

const COUNT: Record<string, number> = { stay: 14, food: 6, activity: 7, destination: 12, transport: 0 };

export function generateReviews(items: Item[] = ALL_ITEMS): SeedReview[] {
  const out: SeedReview[] = [];
  for (const item of items) {
    const n = COUNT[item.kind] ?? 0;
    const r = rng(item.id);
    const salient = (Object.entries(item.priors) as [Aspect, number][])
      .filter(([a, v]) => PHRASES[a] && Math.abs(v - 0.5) >= 0.2)
      .sort((x, y) => Math.abs(y[1] - 0.5) - Math.abs(x[1] - 0.5))
      .slice(0, 8);
    if (!salient.length) continue;
    for (let i = 0; i < n; i++) {
      const party = PARTIES[Math.floor(r() * PARTIES.length)];
      const intros = PARTY_INTROS[party];
      const intro = intros[Math.floor(r() * intros.length)];
      const picks = new Set<number>();
      while (picks.size < Math.min(2, salient.length)) picks.add(Math.floor(r() * salient.length));
      let score = 0;
      const sentences = [...picks].map((idx) => {
        const [a, v] = salient[idx];
        const high = v + (r() - 0.5) * 0.2 > 0.5;
        // Individual taste on top of the party's typical valence: strong party preferences still win,
        // neutral ones split both ways (some friends find luxury too fancy, some solo travellers love rustic).
        const val = valence(party, a) + (r() - 0.5) * 1.2;
        // "positive" means this reviewer liked how much of the aspect there was
        const likes = high ? val >= 0 : val < 0;
        score += likes ? 1 : -1;
        const slot = PHRASES[a]![high ? "high" : "low"];
        return pickPhrase(likes ? slot.pos : slot.neg, party, r);
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
for (const [a, v] of Object.entries(PHRASES) as [Aspect, { high: Slot; low: Slot }][]) {
  for (const [level, slot] of [[0.9, v.high], [0.1, v.low]] as const) {
    for (const p of slot.pos) REVERSE.set(text(p), { aspect: a, level, sentiment: 1 });
    for (const p of slot.neg) REVERSE.set(text(p), { aspect: a, level, sentiment: -1 });
  }
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
