// In-memory view of the offline layer: aspect scores per item × lens, and review evidence.
// Loaded from the database once per server instance (it is a lookup, not a computation).
import type { Aspect, Party } from "../types";

export interface ScoreRow { item_id: string; lens: string; aspects: Record<string, number>; confidence: number }
export interface EvidenceRow { review_id: string; item_id: string; party: string | null; aspect: string; level: number; sentiment: number; snippet: string }

export class ScoreStore {
  private scores = new Map<string, { aspects: Record<string, number>; confidence: number }>();
  private evidence = new Map<string, EvidenceRow[]>();
  constructor(rows: ScoreRow[], ev: EvidenceRow[]) {
    for (const r of rows) this.scores.set(`${r.item_id}|${r.lens}`, { aspects: r.aspects, confidence: r.confidence });
    for (const e of ev) {
      if (!this.evidence.has(e.item_id)) this.evidence.set(e.item_id, []);
      this.evidence.get(e.item_id)!.push(e);
    }
  }
  aspects(itemId: string, lens: Party | "all"): Record<string, number> {
    return (this.scores.get(`${itemId}|${lens}`) ?? this.scores.get(`${itemId}|all`))?.aspects ?? {};
  }
  confidence(itemId: string, lens: Party | "all") {
    return (this.scores.get(`${itemId}|${lens}`) ?? this.scores.get(`${itemId}|all`))?.confidence ?? 0;
  }
  /** Review snippets about an aspect, preferring travellers with the same party (intent-conditioned evidence). */
  snippets(itemId: string, aspect: Aspect, party: Party, high: boolean, limit = 1, sentiment?: 1 | -1) {
    // A requested sentiment is strict: no praise means no "why it fits" quote, rather than a complaint in its place.
    const all = (this.evidence.get(itemId) ?? []).filter((e) => e.aspect === aspect && (high ? e.level >= 0.5 : e.level < 0.5) && (!sentiment || e.sentiment === sentiment));
    // The asked-for sentiment outranks party: "why it fits" evidence must be praise, a heads-up must be a complaint.
    // Within that, same-party voices come first.
    const score = (e: EvidenceRow) => (sentiment && e.sentiment === sentiment ? 3 : 0) + (e.party === party ? 2 : 0);
    // Distinct quotes only, best first; among equally good ones, rotate per item so neighbouring places don't all lead
    // with the same phrase.
    const seen = new Set<string>();
    const uniq = all.filter((e) => !seen.has(e.snippet) && seen.add(e.snippet)).sort((a, b) => score(b) - score(a));
    if (!uniq.length) return uniq;
    const top = uniq.filter((e) => score(e) === score(uniq[0]));
    let h = 0;
    for (const ch of itemId + aspect + party) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const k = h % top.length;
    return [...top.slice(k), ...top.slice(0, k), ...uniq.slice(top.length)].slice(0, limit);
  }
  reviewCount(itemId: string) {
    return new Set((this.evidence.get(itemId) ?? []).map((e) => e.review_id)).size;
  }
}

let cached: { store: ScoreStore; at: number } | null = null;

export async function getStore(): Promise<ScoreStore> {
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.store;
  const { q } = await import("../db");
  const rows = await q<ScoreRow>("select item_id, lens, aspects, confidence from item_aspect_scores");
  const ev = await q<EvidenceRow>("select review_id, item_id, party, aspect, level, sentiment, snippet from review_extractions");
  const store = new ScoreStore(rows, ev);
  // Don't cache a half-built table (another instance may be mid-rebuild after a catalog change): every item has 6 lenses.
  const { ALL_ITEMS } = await import("../data/catalog");
  if (rows.length >= ALL_ITEMS.length * 6) cached = { store, at: Date.now() };
  return store;
}

export function invalidateStore() {
  cached = null;
}
