# TripGenie (prototype)

Intent-based travel personalization, built as a layer inside an OTA. Product decisions and architecture: **[BUILD_SPEC.md](BUILD_SPEC.md)**.

## Run locally (zero setup)

```bash
npm install
npm run dev        # http://localhost:3000, uses an embedded Postgres in ./.pglite
npm test           # engine tests (polarity flip, filters, budgets, variants)
```

Add `XAI_API_KEY` to `.env.local` to turn on Grok for chat slot-filling and the "why this fits you" summary. Without it, rule-based fallbacks run.

## Deploy (Supabase + Vercel)

1. **Supabase:** create a project. Copy *Project Settings → Database → Connection string → Transaction pooler* (port 6543). Optionally run `supabase/schema.sql` in the SQL editor; the app also creates the schema and seeds itself on first request. You can also run `DATABASE_URL=... npm run db:setup`.
2. **Vercel:** import the GitHub repo and add these environment variables:
   - `DATABASE_URL`: the pooler string
   - `XAI_API_KEY`: your xAI key
   - `XAI_MODEL` (optional): defaults to `grok-4-fast-non-reasoning`
3. Deploy. On Vercel without `DATABASE_URL` the app falls back to in-memory Postgres per instance, which works for a quick look but does not persist. Use Supabase.
4. Optional: `npm run extract` re-mines all reviews with Grok (the offline batch job) and recomputes aspect scores.

## Demo script (5 minutes)

1. **Explore as Arjun** opens on **For You**: a trigger banner (long weekend, take 1 day off), then three intent rows, then *Something different*.
2. Open a plan. Swipe through *why this fits you* (destination, stay, activity), the traveller testimonials and the true trip cost. Change the party chip to **With parents** and everything re-scores. **Swap** the camp for a heritage stay to get a discovery edit and a new inferred dealbreaker.
3. **Explore → I know where → North Goa.** Switch **Friends ↔ Family + kids**. Baga Party Lane drops from #1 (fit ~82) to ~29, below Assagao Garden Retreat, flagged with a family review ("Not set up for kids").
4. **Plan with me:** tap *Parents want a temple trip, nothing tiring*, then *Next long weekend*, then **Create trip plan**. The criteria bar shows assumptions and how many options each filter hides.
5. **Trips → College gang reunion:** date poll, anonymous criteria, *Preview hidden* on the ₹12k budget, approve the anonymous relax request on your own "no long road" rule, like/veto, confirm.
6. **You:** confirm the inferred red-eye dealbreaker, do the Rishikesh check-in (skip bungee), **Retake**, then the nudge cadence and metrics.
7. **Start fresh** (log out first): 8 yes/no experiences, then a short "That's everything we need" screen, then a guided tour of For You, Explore and Plan with me, then a personalised feed (the persona is on the You tab; replay the tour from there).

## Map

| Path | What |
|---|---|
| `lib/engine/plan.ts` | Filters, scoring, plan assembly, readiness, diversity |
| `lib/engine/weights.ts` | Intent weight matrix (need × party × profile) |
| `lib/data/reviews.ts` | Synthetic reviews, extraction, intent-conditioned aggregation |
| `lib/engine/profile.ts` | Onboarding pairs, persona, contrastive learning, reason chips |
| `lib/engine/triggers.ts` | Long weekends, bridge days, nudge cadence |
| `lib/llm.ts` | Grok client and slot filling (+ rules fallback) |
| `app/api/*` | Route handlers |
| `app/*` | Screens |
| `public/items/`, `lib/item-photos.json` | Photos for destinations, stays and activities, from Wikimedia Commons under free licences. Each slide credits its photo; the full list is in [public/items/CREDITS.md](public/items/CREDITS.md). Stays are fictional, so their photos show the real setting (ghat, lake, village), not a specific property. |
| `public/covers/`, `lib/cover-photos.json` | Four separate photos per destination for plan cards and plan headers, never the carousel's. The trip type picks which one, so the same place looks different across For You rows. Credits in [public/covers/CREDITS.md](public/covers/CREDITS.md). |
