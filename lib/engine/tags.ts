// Tags derived from item attributes and mined aspect scores. Dealbreakers are expressed against these tags.
import type { Item } from "../types";

export const TAG_LABEL: Record<string, string> = {
  hostel: "Hostels",
  camp: "Camps & tents",
  long_road: "Road journeys over 6 hours",
  red_eye: "Flights before 6am or after 9pm",
  night_travel: "Overnight travel",
  early_start: "Starts before 7am",
  crowded: "Crowded spots",
  party_scene: "Party scene",
  strenuous: "Strenuous activities",
  fixed_schedule: "Fixed-schedule group tours",
  nonveg_focus: "Non-veg-focused restaurants",
  rustic: "Basic, rustic comfort",
  transfer: "Changing trains/flights",
  luxury_price: "Luxury price tags",
};

export function itemTags(item: Item, aspects: Record<string, number>): string[] {
  const t: string[] = [];
  switch (item.kind) {
    case "stay":
      if (item.type === "hostel") t.push("hostel");
      if (item.type === "camp") t.push("camp");
      if ((aspects.nightlife ?? 0) >= 0.75) t.push("party_scene");
      if ((aspects.crowd ?? 0) >= 0.75) t.push("crowded");
      if ((aspects.comfort ?? 0.5) <= 0.4) t.push("rustic");
      if (item.price >= 12000) t.push("luxury_price");
      break;
    case "transport":
      if ((item.mode === "bus" || item.mode === "self_drive") && item.hours > 6) t.push("long_road");
      if (item.mode === "flight" && (item.depart < 6 || item.depart >= 21)) t.push("red_eye");
      if (item.depart >= 21 || item.depart + item.hours >= 24 + 4) t.push("night_travel");
      if (item.depart < 7 && item.depart >= 3) t.push("early_start");
      if (item.transfers > 0) t.push("transfer");
      break;
    case "food":
      if (item.diet === "nonveg_focus") t.push("nonveg_focus");
      if ((aspects.crowd ?? 0) >= 0.75) t.push("crowded");
      break;
    case "activity":
      if (item.earlyStart) t.push("early_start");
      if (item.intensity >= 0.7) t.push("strenuous");
      if (item.fixedSchedule) t.push("fixed_schedule");
      if ((aspects.crowd ?? 0) >= 0.8) t.push("crowded");
      if ((aspects.nightlife ?? 0) >= 0.8) t.push("party_scene");
      break;
    case "destination":
      if ((aspects.crowd ?? 0) >= 0.8) t.push("crowded");
      break;
  }
  return t;
}
