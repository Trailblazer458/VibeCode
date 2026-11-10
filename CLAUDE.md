@AGENTS.md

# TripGenie

Read BUILD_SPEC.md first: it records every product decision. Key rules:
- Ranking is deterministic TypeScript (`lib/engine/plan.ts`); the LLM (Grok, `lib/llm.ts`) only extracts slots and phrases explanations. Never let the LLM pick or invent items.
- Every LLM call needs a rule-based fallback.
- Constraint owners in group trips must never be sent to other members.
- Run `npm test` and `npm run build` after engine changes.
