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
    const all = (this.evidence.get(itemId) ?? []).filter((e) => e.aspect === aspect && (high ? e.level >= 0.5 : e.level < 0.5));
    const score = (e: EvidenceRow) => (e.party === party ? 2 : 0) + (sentiment && e.sentiment === sentiment ? 1 : 0);
    all.sort((a, b) => score(b) - score(a));
    return all.slice(0, limit);
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
  cached = { store: new ScoreStore(rows, ev), at: Date.now() };
  return cached.store;
}

export function invalidateStore() {
  cached = null;
}
