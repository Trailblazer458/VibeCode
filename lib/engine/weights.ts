// The intent weight matrix: how much each aspect counts for each need state and party.
// Negative weights are the "polarity flip": the same aspect helps one intent and hurts another.
// In the MVP these are hand-tuned; later they are learned from choices and edits.
import type { Aspect, AspectMap, Need, Party } from "../types";

export const NEED_WEIGHTS: Record<Need, AspectMap> = {
  rest: { quiet: 2.5, wellness: 1.5, comfort: 1.5, nature: 1, scenic: 1, crowd: -2, adventure: -1, nightlife: -1 },
  reconnect: { comfort: 1, scenic: 1, quiet: 0.8, romance: 0.8, crowd: -1, social: 0.3 },
  explore: { culture: 2.5, food_adventure: 2, convenience: 1, scenic: 0.5, crowd: -0.5 },
  thrill: { adventure: 3, nature: 1.5, social: 0.5, comfort: -0.3, quiet: -0.3 },
  celebrate: { romance: 1.5, luxury: 1.5, comfort: 1.5, scenic: 1, food_adventure: 0.5, nightlife: 0.5 },
  reflect: { spiritual: 3, quiet: 1.5, culture: 1, nightlife: -2, crowd: -1 },
  indulge: { luxury: 3, comfort: 2, wellness: 1, food_adventure: 1, value: -0.5 },
  escape: { scenic: 2, nature: 2, quiet: 1, crowd: -1 },
  learn: { culture: 1.5, work_friendly: 2, convenience: 1, quiet: 0.5 },
};

export const PARTY_WEIGHTS: Record<Party, AspectMap> = {
  solo: { safety: 1.5, social: 1, value: 1 },
  couple: { romance: 2, quiet: 1, social: -0.5, kid_friendly: -0.3 },
  friends: { nightlife: 2, social: 2, value: 1.5, adventure: 0.5, quiet: -0.5 },
  family_kids: { kid_friendly: 3, safety: 2.5, quiet: 1, nightlife: -2.5, adventure: -0.5, convenience: 1 },
  family_elders: { elder_friendly: 3, safety: 2, quiet: 1.5, nightlife: -2, adventure: -1.5, comfort: 1, convenience: 1.5, crowd: -1 },
};

// Baseline valence: is "more of this" generally good? Used where an intent is silent.
export const BASE_VALENCE: AspectMap = {
  quiet: 0.3, nightlife: 0, kid_friendly: 0, elder_friendly: 0, safety: 0.5, veg_food: 0, romance: 0,
  luxury: 0, value: 0.5, adventure: 0, culture: 0.3, nature: 0.3, spiritual: 0, crowd: -0.5, wellness: 0.2,
  food_adventure: 0.2, comfort: 0.5, convenience: 0.4, scenic: 0.5, social: 0, work_friendly: 0,
};

// Transit tolerance: share of the trip's waking hours a person accepts spending in transit (round trip).
export const TRANSIT_TOLERANCE: Record<Need, number> = {
  rest: 0.22, reconnect: 0.25, explore: 0.3, thrill: 0.32, celebrate: 0.25, reflect: 0.3, indulge: 0.22, escape: 0.36, learn: 0.25,
};

// Activities per day by need state (pace).
export const PACE: Record<Need, number> = {
  rest: 1, reconnect: 1.3, explore: 2, thrill: 2, celebrate: 1.5, reflect: 1.5, indulge: 1.2, escape: 1.3, learn: 1.5,
};

export const NEED_LABEL: Record<Need, string> = {
  rest: "Rest", reconnect: "Reconnect", explore: "Explore", thrill: "Thrill", celebrate: "Celebrate",
  reflect: "Reflect", indulge: "Indulge", escape: "Escape", learn: "Learn & create",
};
export const NEED_SUBS: Record<Need, string> = {
  rest: "Slow & sleep · detox · wellness",
  reconnect: "Partner · family time · reunion",
  explore: "Heritage · cities · food trails",
  thrill: "Treks · water sports · wildlife",
  celebrate: "Birthday · anniversary · milestone",
  reflect: "Pilgrimage · retreat · solitude",
  indulge: "Luxury · fine dining · spa",
  escape: "Change of scene · weather escape",
  learn: "Photography · workshops · workcation",
};
export const NEED_EMOJI: Record<Need, string> = {
  rest: "🌿", reconnect: "🤝", explore: "🧭", thrill: "⚡", celebrate: "🥂", reflect: "🪔", indulge: "💎", escape: "🌄", learn: "📷",
};
export const PARTY_LABEL: Record<Party, string> = {
  solo: "Solo", couple: "Couple", friends: "Friends", family_kids: "Family + kids", family_elders: "With parents",
};
export const ASPECT_LABEL: Record<Aspect, string> = {
  quiet: "quiet", nightlife: "nightlife", kid_friendly: "kid-friendly", elder_friendly: "easy for seniors",
  safety: "safe area", veg_food: "veg food", romance: "romantic", luxury: "luxury", value: "value for money",
  adventure: "adventure", culture: "culture & heritage", nature: "nature", spiritual: "spiritual", crowd: "crowds",
  wellness: "wellness", food_adventure: "food finds", comfort: "comfort", convenience: "convenient location",
  scenic: "views", social: "social vibe", work_friendly: "good Wi-Fi & desk",
};

/** Profile dimensions (0..1, 0.5 neutral) shift aspect weights for this person. */
export const DIM_TO_ASPECT: Record<string, AspectMap> = {
  pace: { adventure: 1.2, quiet: -0.6 },
  social: { social: 1.2, crowd: 0.6, quiet: -0.6, nightlife: 0.6 },
  novelty: { culture: 0.8, food_adventure: 0.6 },
  comfort: { comfort: 1.2, luxury: 0.8 },
  control: {},
  food: { food_adventure: 1.2 },
  nature: { nature: 1.2, scenic: 0.6, convenience: -0.3 },
  luxury: { luxury: 1, value: -0.6 },
  spiritual: { spiritual: 1.2 },
};

export function weightsFor(
  need: Need,
  party: Party,
  dims: Record<string, number> = {},
  secondary?: Need | null,
): Record<Aspect, number> {
  const w = {} as Record<Aspect, number>;
  const add = (m: AspectMap, f: number) => {
    for (const [k, v] of Object.entries(m)) w[k as Aspect] = (w[k as Aspect] ?? 0) + (v as number) * f;
  };
  add(BASE_VALENCE, 1);
  add(NEED_WEIGHTS[need], 1);
  if (secondary && secondary !== need) add(NEED_WEIGHTS[secondary], 0.5);
  add(PARTY_WEIGHTS[party], 1);
  for (const [dim, val] of Object.entries(dims)) {
    const m = DIM_TO_ASPECT[dim];
    if (m) add(m, (val - 0.5) * 2);
  }
  return w;
}
