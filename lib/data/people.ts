// Seeded demo persona, friends, past trips, a live group trip, templates and the holiday calendar.
import type { Need, Party } from "../types";

export const DEMO_ID = "arjun";

export interface SeedProfile {
  id: string;
  name: string;
  home_city: string;
  diet: string;
  budget_pp: number;
  default_party: Party;
  persona: string;
  dims: Record<string, number>;
  need_affinity: Record<string, number>;
  intents: { need: Need; party: Party; score: number }[];
  companions: { name: string; relation: string; diet: string }[];
  personal_dates: { label: string; date: string }[];
  segment: string;
}

export const PROFILES: SeedProfile[] = [
  {
    id: DEMO_ID,
    name: "Arjun",
    home_city: "Gurugram",
    diet: "nonveg",
    budget_pp: 30000,
    default_party: "friends",
    persona: "The Spirited Explorer",
    dims: { pace: 0.72, social: 0.62, novelty: 0.66, comfort: 0.6, control: 0.78, food: 0.7, nature: 0.72, luxury: 0.5, spiritual: 0.35, climate: 0.4 },
    need_affinity: { thrill: 0.9, celebrate: 0.8, rest: 0.7, explore: 0.62, escape: 0.55, reconnect: 0.5, indulge: 0.45, reflect: 0.3, learn: 0.2 },
    intents: [
      { need: "thrill", party: "friends", score: 0.9 },
      { need: "celebrate", party: "couple", score: 0.8 },
      { need: "rest", party: "solo", score: 0.7 },
    ],
    companions: [{ name: "Meera", relation: "partner", diet: "veg" }],
    personal_dates: [{ label: "Anniversary with Meera", date: "2026-12-12" }],
    segment: "professional",
  },
  {
    id: "rohan", name: "Rohan", home_city: "Noida", diet: "nonveg", budget_pp: 12000, default_party: "friends", persona: "The Budget Adventurer",
    dims: { pace: 0.8, social: 0.85, novelty: 0.6, comfort: 0.3, control: 0.5, food: 0.75, nature: 0.7, luxury: 0.2, spiritual: 0.3 },
    need_affinity: { thrill: 0.9, escape: 0.7, explore: 0.6 }, intents: [{ need: "thrill", party: "friends", score: 0.9 }],
    companions: [], personal_dates: [], segment: "professional",
  },
  {
    id: "neha", name: "Neha", home_city: "Delhi", diet: "veg", budget_pp: 20000, default_party: "friends", persona: "The Calm Seeker",
    dims: { pace: 0.4, social: 0.5, novelty: 0.6, comfort: 0.65, control: 0.4, food: 0.55, nature: 0.8, luxury: 0.45, spiritual: 0.6 },
    need_affinity: { rest: 0.85, escape: 0.75, reflect: 0.6 }, intents: [{ need: "rest", party: "friends", score: 0.8 }],
    companions: [], personal_dates: [], segment: "professional",
  },
  {
    id: "kabir", name: "Kabir", home_city: "Gurugram", diet: "eggetarian", budget_pp: 22000, default_party: "friends", persona: "The Quiet Wanderer",
    dims: { pace: 0.6, social: 0.35, novelty: 0.75, comfort: 0.55, control: 0.6, food: 0.6, nature: 0.85, luxury: 0.4, spiritual: 0.4 },
    need_affinity: { escape: 0.85, explore: 0.7, thrill: 0.6 }, intents: [{ need: "escape", party: "friends", score: 0.85 }],
    companions: [], personal_dates: [], segment: "professional",
  },
  {
    id: "priya", name: "Priya", home_city: "Delhi", diet: "veg", budget_pp: 15000, default_party: "friends", persona: "The Food-first Explorer",
    dims: { pace: 0.55, social: 0.7, novelty: 0.7, comfort: 0.5, food: 0.9, nature: 0.4 },
    need_affinity: { explore: 0.9 }, intents: [{ need: "explore", party: "friends", score: 0.9 }],
    companions: [], personal_dates: [], segment: "professional",
  },
];

export const FRIENDSHIPS: [string, string][] = [
  [DEMO_ID, "rohan"],
  [DEMO_ID, "neha"],
  [DEMO_ID, "kabir"],
  ["neha", "priya"], // friend-of-friend for Arjun
];

export interface SeedDealbreaker {
  attribute: string;
  label: string;
  kind: "hard" | "soft";
  context_party?: Party | null;
  confidence: number;
  source: string;
  status: "confirmed" | "inferred";
}

export const DEMO_DEALBREAKERS: SeedDealbreaker[] = [
  { attribute: "long_road", label: "No road journeys over 6 hours", kind: "hard", confidence: 1, source: "onboarding", status: "confirmed" },
  { attribute: "fixed_schedule", label: "Avoid fixed-schedule group tours", kind: "soft", confidence: 0.8, source: "chat", status: "confirmed" },
  { attribute: "hostel", label: "No hostels when travelling with Meera", kind: "hard", context_party: "couple", confidence: 1, source: "reason_chip", status: "confirmed" },
  { attribute: "red_eye", label: "Skips flights before 6am or after 9pm", kind: "soft", confidence: 0.45, source: "edit", status: "inferred" },
];

export interface SeedPastTrip {
  id: string;
  name: string;
  need: Need;
  party: Party;
  dest_id: string;
  start: string;
  days: number;
  items: { stay: string; transport: string; food: string[]; activities: string[] };
  visibility: "private" | "friends" | "fof" | "public";
  checkin_done: boolean;
}

export const DEMO_PAST_TRIPS: SeedPastTrip[] = [
  {
    id: "past-rishikesh", name: "Rishikesh rafting weekend", need: "thrill", party: "friends", dest_id: "rishikesh",
    start: "2026-03-20", days: 3, items: { stay: "rk-camp", transport: "rk-drive", food: ["rk-f1", "rk-f4"], activities: ["rk-a1", "rk-a4"] },
    visibility: "friends", checkin_done: false,
  },
  {
    id: "past-udaipur", name: "Udaipur anniversary", need: "celebrate", party: "couple", dest_id: "udaipur",
    start: "2025-12-12", days: 3, items: { stay: "ud-lakeview", transport: "ud-flight", food: ["ud-f1", "ud-f4"], activities: ["ud-a1", "ud-a3"] },
    visibility: "private", checkin_done: true,
  },
  {
    id: "past-goa", name: "Goa with the gang", need: "celebrate", party: "friends", dest_id: "goa",
    start: "2024-11-15", days: 4, items: { stay: "ga-partylane", transport: "ga-flight", food: ["ga-f1"], activities: ["ga-a1", "ga-a3"] },
    visibility: "public", checkin_done: true,
  },
];

export const GROUP_TRIP = {
  id: "grp-reunion",
  name: "College gang reunion",
  need: "thrill" as Need,
  secondary: "escape" as Need,
  party: "friends" as Party,
  organizer: DEMO_ID,
  members: [DEMO_ID, "rohan", "neha", "kabir"],
  // Rohan picked the destination last time (Goa 2024), so the others get priority this time.
  fairness: { [DEMO_ID]: 1.05, rohan: 0.8, neha: 1.1, kabir: 1.1 } as Record<string, number>,
  lastPickedBy: "rohan",
  pollOptions: [
    { id: "opt-nov", label: "Guru Nanak Jayanti weekend", start: "2026-11-21", days: 4 },
    { id: "opt-dec", label: "Christmas weekend", start: "2026-12-25", days: 3 },
    { id: "opt-jan", label: "Republic Day weekend", start: "2027-01-23", days: 4 },
  ],
  votes: { "opt-nov": ["neha"], "opt-dec": ["rohan", "neha", "kabir"], "opt-jan": ["rohan"] } as Record<string, string[]>,
  constraints: [
    { id: "c-budget", owner: "rohan", attribute: "budget", label: "Budget ≤ ₹12,000 per person", kind: "hard", value: { budgetPP: 12000 } },
    { id: "c-veg", owner: "neha", attribute: "diet_veg", label: "Vegetarian food available everywhere", kind: "hard", value: { diet: "veg" } },
    { id: "c-early", owner: "neha", attribute: "early_start", label: "No starts before 7am", kind: "soft", value: {} },
    { id: "c-crowd", owner: "kabir", attribute: "crowded", label: "Avoid crowded spots", kind: "soft", value: {} },
    { id: "c-road", owner: DEMO_ID, attribute: "long_road", label: "No road journeys over 6 hours", kind: "hard", value: {} },
  ],
  relaxRequests: [
    { id: "rr-1", constraint: "c-road", message: "The group likes 2 options that need an overnight road journey (Kasol, Manali). Allow it this once?" },
  ],
  tripVotes: [
    { user: "rohan", dest: "kasol", vote: "like" },
    { user: "rohan", dest: "rishikesh", vote: "like" },
    { user: "neha", dest: "rishikesh", vote: "like" },
    { user: "neha", dest: "mussoorie", vote: "like" },
    { user: "kabir", dest: "corbett", vote: "like" },
    { user: "kabir", dest: "goa", vote: "veto" },
  ],
  tasks: [
    { id: "t1", label: "Book cabs at the destination", assignee: "rohan", done: false },
    { id: "t2", label: "Shortlist veg-friendly cafés", assignee: "neha", done: true },
    { id: "t3", label: "Confirm stay booking", assignee: null as string | null, done: false },
  ],
};

export interface SeedTemplate {
  id: string;
  author_id: string | null;
  author_name: string;
  title: string;
  blurb: string;
  need: Need;
  party: Party;
  dest_id: string;
  days: number;
  items: { stay: string; transport: string; food: string[]; activities: string[] };
  visibility: "public" | "friends" | "fof";
  trip_completed: boolean;
  trip_start: string | null;
  likes: number;
  saves: number;
  remixes: number;
  stock: boolean;
}

export const TEMPLATES: SeedTemplate[] = [
  { id: "tpl-landour", author_id: null, author_name: "Curated by TripGenie", title: "Three slow days in Landour", blurb: "No itinerary stress: one walk a day, long breakfasts, early nights.", need: "rest", party: "couple", dest_id: "mussoorie", days: 3,
    items: { stay: "ms-landour", transport: "ms-flight", food: ["ms-f1", "ms-f3"], activities: ["ms-a1"] }, visibility: "public", trip_completed: true, trip_start: null, likes: 1240, saves: 860, remixes: 214, stock: true },
  { id: "tpl-varanasi-parents", author_id: null, author_name: "Curated by TripGenie", title: "Varanasi with parents, done gently", blurb: "Lift-access stay away from the ghat steps, dawn boat instead of the crush at the aarti.", need: "reflect", party: "family_elders", dest_id: "varanasi", days: 3,
    items: { stay: "vn-cantt", transport: "vn-flight", food: ["vn-f2", "vn-f3"], activities: ["vn-a1", "vn-a4"] }, visibility: "public", trip_completed: true, trip_start: null, likes: 980, saves: 1120, remixes: 301, stock: true },
  { id: "tpl-rishikesh-rush", author_id: null, author_name: "Curated by TripGenie", title: "Rishikesh adrenaline weekend", blurb: "Rafting, bungee and riverside cafés, back by Sunday night.", need: "thrill", party: "friends", dest_id: "rishikesh", days: 3,
    items: { stay: "rk-camp", transport: "rk-vb", food: ["rk-f1", "rk-f4"], activities: ["rk-a1", "rk-a4", "rk-a2"] }, visibility: "public", trip_completed: true, trip_start: null, likes: 2210, saves: 1430, remixes: 512, stock: true },
  { id: "tpl-corbett-kids", author_id: null, author_name: "Curated by TripGenie", title: "Corbett with kids", blurb: "Jungle lodge with a pool, one safari, a museum and early bedtimes.", need: "explore", party: "family_kids", dest_id: "corbett", days: 3,
    items: { stay: "cb-jungle", transport: "cb-drive", food: ["cb-f1", "cb-f2"], activities: ["cb-a1", "cb-a4"] }, visibility: "public", trip_completed: true, trip_start: null, likes: 760, saves: 690, remixes: 120, stock: true },
  { id: "tpl-rohan-kasol", author_id: "rohan", author_name: "Rohan", title: "Kasol 4-day backpack loop", blurb: "Kheerganga trek, Tosh, and too many Israeli breakfasts.", need: "thrill", party: "friends", dest_id: "kasol", days: 4,
    items: { stay: "ks-riverside", transport: "ks-volvo", food: ["ks-f1", "ks-f2"], activities: ["ks-a1", "ks-a4"] }, visibility: "friends", trip_completed: true, trip_start: "2026-10-02", likes: 18, saves: 6, remixes: 2, stock: false },
  { id: "tpl-neha-mussoorie", author_id: "neha", author_name: "Neha", title: "Mussoorie reset (upcoming)", blurb: "Homestay in Landour, nothing planned on purpose.", need: "rest", party: "solo", dest_id: "mussoorie", days: 3,
    items: { stay: "ms-landour", transport: "ms-train", food: ["ms-f3"], activities: ["ms-a1"] }, visibility: "friends", trip_completed: false, trip_start: "2026-12-04", likes: 9, saves: 3, remixes: 0, stock: false },
  { id: "tpl-priya-amritsar", author_id: "priya", author_name: "Priya", title: "Amritsar eat-everything weekend", blurb: "Kulchas at 8am, langar at noon, fish at night.", need: "explore", party: "friends", dest_id: "amritsar", days: 2,
    items: { stay: "am-heritage", transport: "am-shatabdi", food: ["am-f1", "am-f2", "am-f4"], activities: ["am-a1", "am-a3"] }, visibility: "fof", trip_completed: true, trip_start: "2026-08-14", likes: 44, saves: 21, remixes: 5, stock: false },
];

// Sample holiday calendar (national + widely observed). Region-specific lists would come from the user's declared state.
export const HOLIDAYS: { date: string; name: string }[] = [
  { date: "2026-11-24", name: "Guru Nanak Jayanti" },
  { date: "2026-12-25", name: "Christmas" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-01-26", name: "Republic Day" },
  { date: "2027-03-22", name: "Holi" },
  { date: "2027-03-26", name: "Good Friday" },
  { date: "2027-04-14", name: "Ambedkar Jayanti" },
  { date: "2027-05-21", name: "Buddha Purnima" },
  { date: "2027-08-15", name: "Independence Day" },
  { date: "2027-10-02", name: "Gandhi Jayanti" },
  { date: "2027-10-29", name: "Diwali" },
  { date: "2027-12-25", name: "Christmas" },
];

export const DEST_EVENTS: { dest: string; name: string; start: string; end: string }[] = [
  { dest: "varanasi", name: "Dev Deepawali on the ghats", start: "2026-11-24", end: "2026-11-24" },
  { dest: "goa", name: "Goa year-end music festival week", start: "2026-12-27", end: "2026-12-30" },
  { dest: "manali", name: "First-snowfall window", start: "2026-12-15", end: "2027-01-31" },
  { dest: "jaipur", name: "Jaipur Literature Festival", start: "2027-01-21", end: "2027-01-25" },
  { dest: "rishikesh", name: "International Yoga Festival", start: "2027-03-01", end: "2027-03-07" },
];
