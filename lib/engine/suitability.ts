// Common-sense exclusions by who is travelling. These are hard rules, not score nudges: an item that fails one is never
// put in a plan or offered as a swap, however well it scores (a couples' spa for a solo traveller, a bungee jump with
// kids, a pub crawl with elderly parents). Deterministic and catalog-driven; the LLM plays no part.
import type { Item, Party, PartyComp } from "../types";

const COUPLES_ONLY = /couple|honeymoon|candlelit|candlelight/i;

/** Why this item does not suit this group, or null when it does. */
export function unsuitable(item: Item, party: Party, pax: PartyComp): string | null {
  if (item.kind === "destination" || item.kind === "transport") return null;
  const p = item.priors;
  if (COUPLES_ONLY.test(item.name) && party !== "couple") return "Made for couples";
  const kids = party === "family_kids" || pax.kids > 0;
  const elders = party === "family_elders" || pax.seniors > 0;
  if (item.kind === "stay" && item.type === "hostel" && (kids || elders)) return kids ? "Hostel: not set up for children" : "Hostel: not set up for seniors";
  if ((kids || elders) && (p.nightlife ?? 0) >= 0.85) return "Party and nightlife spot";
  if (item.kind === "activity") {
    const adventure = p.adventure ?? 0;
    if (kids && (item.intensity >= 0.75 || (adventure >= 0.85 && (p.kid_friendly ?? 0.5) < 0.5) || (p.kid_friendly ?? 0.5) <= 0.1)) return "Not safe or suitable for children";
    if (elders && (item.intensity >= 0.6 || adventure >= 0.85 || (p.elder_friendly ?? 0.5) <= 0.1)) return "Too strenuous for seniors";
  }
  return null;
}

export const suits = (item: Item, party: Party, pax: PartyComp) => unsuitable(item, party, pax) === null;
