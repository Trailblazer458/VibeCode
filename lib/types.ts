// Core domain types for the intent-based personalization engine.

export const NEEDS = [
  "rest",
  "reconnect",
  "explore",
  "thrill",
  "celebrate",
  "reflect",
  "indulge",
  "escape",
  "learn",
] as const;
export type Need = (typeof NEEDS)[number];

export const PARTIES = ["solo", "couple", "friends", "family_kids", "family_elders"] as const;
export type Party = (typeof PARTIES)[number];

export type Diet = "none" | "nonveg" | "eggetarian" | "veg" | "jain";

export const ASPECTS = [
  "quiet",
  "nightlife",
  "kid_friendly",
  "elder_friendly",
  "safety",
  "veg_food",
  "romance",
  "luxury",
  "value",
  "adventure",
  "culture",
  "nature",
  "spiritual",
  "crowd",
  "wellness",
  "food_adventure",
  "comfort",
  "convenience",
  "scenic",
  "social",
  "work_friendly",
] as const;
export type Aspect = (typeof ASPECTS)[number];
export type AspectMap = Partial<Record<Aspect, number>>;

export type ElementKind = "destination" | "stay" | "transport" | "food" | "activity";

export interface Destination {
  id: string;
  kind: "destination";
  name: string;
  state: string;
  emoji: string;
  hue: number; // used for the generated cover gradient
  summary: string;
  season: number[]; // 12 months, 0..1 fit
  localPerDay: number; // INR per vehicle per day for local transport
  priors: AspectMap;
}

export interface Stay {
  id: string;
  kind: "stay";
  destId: string;
  name: string;
  type: "hotel" | "hostel" | "resort" | "homestay" | "ashram" | "heritage" | "camp";
  area: string;
  price: number; // INR per room-night
  areaSafety: number; // 0..1
  veg: "veg_only" | "veg_available" | "limited";
  jain: boolean;
  petFriendly: boolean;
  rooms: ("single" | "double" | "connecting" | "family" | "dorm" | "suite")[];
  checkIn: number; // hour
  priors: AspectMap;
}

export interface Transport {
  id: string;
  kind: "transport";
  destId: string;
  name: string;
  mode: "flight" | "train" | "bus" | "self_drive";
  price: number; // INR per person, one way (self_drive: per car)
  depart: number; // hour of departure from origin, decimal
  hours: number; // door-to-door, one way
  transfers: number;
  priors: AspectMap;
}

export interface Food {
  id: string;
  kind: "food";
  destId: string;
  name: string;
  cuisine: string;
  price: number; // INR per person per meal
  diet: "veg_only" | "mixed" | "nonveg_focus";
  jain: boolean;
  priors: AspectMap;
}

export interface Activity {
  id: string;
  kind: "activity";
  destId: string;
  name: string;
  price: number; // INR per person
  intensity: number; // 0..1
  hours: number;
  earlyStart: boolean;
  fixedSchedule: boolean;
  priors: AspectMap;
}

export type Item = Destination | Stay | Transport | Food | Activity;

export interface PartyComp {
  adults: number;
  kids: number;
  seniors: number;
  pets: number;
}

export interface TripWindow {
  start: string; // ISO date
  days: number;
  label?: string;
}

export interface DealbreakerRow {
  id: string;
  user_id: string;
  attribute: string;
  label: string;
  kind: "hard" | "soft";
  context_party: Party | null;
  context_need: Need | null;
  confidence: number;
  source: string;
  status: "confirmed" | "inferred";
}

export interface ProfileRow {
  id: string;
  name: string;
  home_city: string;
  diet: Diet;
  budget_pp: number;
  default_party: Party;
  persona: string | null;
  dims: Record<string, number>;
  need_affinity: Record<string, number>;
  intents: { need: Need; party: Party; score: number }[];
  onboarded: boolean;
  is_demo: boolean;
  calendar_opt_in: boolean;
  personal_dates: { label: string; date: string }[];
  signal_count: number;
}

export interface TripRequest {
  need: Need;
  secondaryNeed?: Need | null;
  party: Party;
  pax?: PartyComp;
  window: TripWindow;
  /** Per-person cap. null = no budget filter (the user said it's flexible or never gave one in Plan with me). */
  budgetPP: number | null;
  diet?: Diet | null;
  destId?: string | null;
  assumed?: string[];
  extraDealbreakers?: { attribute: string; label: string; kind: "hard" | "soft" }[];
  maxPlans?: number;
  minPlans?: number;
  excludeDestIds?: string[];
}

export interface PlanItemRef {
  id: string;
  name: string;
  fit: number;
  price: number;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  /** Plan items this check is about, so the plan page can flag them. Empty or missing means the trip as a whole. */
  items?: string[];
}

export interface Plan {
  id: string;
  title: string;
  need: Need;
  party: Party;
  pax: PartyComp;
  window: TripWindow;
  destId: string;
  destName: string;
  emoji: string;
  hue: number;
  stay: PlanItemRef & { type: string; area: string };
  transport: PlanItemRef & { mode: string; hours: number; depart: number };
  food: PlanItemRef[];
  activities: (PlanItemRef & { day: number })[];
  rooms: string;
  cost: { transport: number; stay: number; food: number; activities: number; local: number; total: number; perHead: number };
  fit: number;
  why: string[];
  evidence: { text: string; party: string; itemName: string }[];
  readiness: ReadinessCheck[];
  tags: string[];
  attrs: Record<string, number | string>;
  exploration?: boolean;
  assumed?: string[];
}
