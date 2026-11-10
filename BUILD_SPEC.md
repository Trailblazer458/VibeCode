# TripGenie: build spec and product decisions

Working name: **TripGenie** (placeholder; another travel company already uses a similar name, so rename before submission. Change `APP_NAME` in `lib/server.ts` and the strings in `app/page.tsx` / `app/layout.tsx`).

Media.net APM case, topic 4: AI-powered personalized recommendations for a travel booking app.

## Thesis

Travel apps are **destination-first** ("from, to, date"). People are **intent-first and time-window-first** ("I'm exhausted and have four days"). Every pain point traces to five blind spots. Current apps don't know:

| Blind spot | What the app doesn't know | Engine component |
|---|---|---|
| **Why** | The trip's intent | Intent model (need state + party + functional purpose) |
| **Who** | The user's profile | Swipe onboarding, signal hierarchy, learned dimensions |
| **With whom** | The group | Group room, combined weights, private constraints |
| **What else** | Context and completeness | Readiness check: trip-killers + dealbreakers |
| **When** | When to step in (reactive vs proactive) | Trigger engine, long-weekend nudge |

Scope: leisure and personal travel in India, origin Delhi NCR. Business travel is excluded because it is low-discretion and policy-controlled. Positioning: a **layer inside an existing online travel agency (OTA)**, so first-party reviews, bookings and inventory are available.

## Core model

- **Intent** = functional purpose + **need state** + party.
  - **Need states (9):**
    1. Rest
    2. Reconnect
    3. Explore
    4. Thrill
    5. Celebrate
    6. Reflect
    7. Indulge
    8. Escape
    9. Learn & create

    Sub-states are listed in `lib/engine/weights.ts`.
  - **Party:** solo, couple, friends, family + kids, with parents. A beneficiary modifier, for trips booked for someone else, is noted for later.
- **Trigger** = why now. The trigger decides *when* the app speaks; intent decides *what* it says.
- **Profile** = who the user is, stable across trips. It is held as dimensions: pace, social, novelty, comfort, control, food, nature, luxury, spiritual, climate.
- **Dealbreakers** = what to avoid.
  - **Kinds:** hard (filter) or soft (down-rank).
  - **Context:** optional, by party or need ("no hostels *with my partner*").
  - **Status:** confirmed or inferred (an inferred one waits for the user's OK).
- **Mood** is not inferred passively. Stated feelings in chat ("burnt out") map to a need state. Current mood only affects tone and short-lead trips. A low mood is never used to push an impulse booking.

## Ranking: deterministic code ranks, the LLM only extracts and explains

1. **Offline (batch):**
   1. Reviews are mined into aspects (level, sentiment, reviewer party, snippet).
   2. Aggregation computes per item × lens (party) × aspect.
   3. Same-party reviews count double.
   4. Recency decays older reviews.
   5. A Bayesian shrink (K=2) pulls thin evidence towards the listing prior.

   Code: `lib/data/reviews.ts`, `scripts/extract-reviews.ts` (Grok). Tables: `review_extractions`, `item_aspect_scores`.
2. **Hard filters:**
   - budget (true trip cost)
   - diet (strictest in the party)
   - transit feasibility (intent-specific share of waking hours)
   - season
   - pets
   - hard dealbreakers (tags)
   - gentle pace for seniors and kids
   - group vetoes
3. **Weights:** need weights + party weights (+0.5 × secondary need) + profile-dimension adjustments, plus a fairness-weighted blend of members for groups. **Negative weights are the polarity flip**: nightlife adds points for friends and subtracts for families.
4. **Fit** = Σ weight × (aspect − 0.5) / Σ|weight|. It is computed for **every element**: destination, stay, transport, food and activities.
5. **Plan assembly:**
   - Elements are chosen in order: destination → stay → transport → food and activities.
   - Activities per day follow the need state's pace.
   - The true trip cost is checked against the budget. If over, the engine tries other stay/transport combos, trims the priciest activities, then picks cheaper food.
   - Plan fit is computed with a late-arrival penalty.
6. **Readiness check:**
   - door-to-door time
   - late-night arrival vs area safety
   - diet
   - room setup (derived from the party)
   - season
   - dealbreakers respected
   - intent trip-killers, with a review snippet as evidence
7. **Diverse set:** maximal marginal relevance over plans, with a count of 3–6 driven by uncertainty (thin profile, assumed slots, group). One exploration option goes to an unvisited destination.
8. **Explanation:** "Why this fits you" lists the top weighted contributions, with same-intent review snippets. Grok (optional) rewrites them into two sentences using only those facts.

The criteria bar shows every applied filter, its source (you, group, assumed, trip type, dates) and **how many options it hides**. Users can switch criteria off to compare.

## Journey (to-be)

1. **First open:** swipe onboarding.
   - 12 "this or that" scene pairs, each mapped to a dimension.
   - Diet is asked directly, never inferred.
   - The user picks who they usually travel with, a budget and optional dealbreakers.
   - It ends with a **persona card**.
2. **For You** (landing page):
   - A trigger banner (long weekend plus bridge-day leave).
   - **Top 3 intents**, each a row of ≥3 plans.
   - A **"Something different"** card from outside the top 3, so the profile grows.
   - Session dwell re-ranks plans.
3. **Plan with me** (persistent entry):
   - Slot-filling chat. Required slots: when, who, budget. Optional: need state, diet override, trip dealbreakers.
   - At most two question turns.
   - **Create trip plan** is always available; any missing slot is filled from the profile and shown as an assumption.
4. **Explore** (four doors):
   1. **I know where:** a fixed destination, every element ranked for the chosen intent. Switching the party chip shows the flip.
   2. **By intent.**
   3. **Budget-first:** "₹15k and 3 days?"
   4. **From a saved video:** paste a link to a short travel video; the vision step is mocked in the prototype.
5. **Plan page:**
   - The intent switch re-scores everything.
   - Swap any element. Each edit is classified:
     - **violation**: the user removed something that broke a *known* dealbreaker (guardrail).
     - **discovery**: the edit revealed a new preference, which becomes an inferred soft dealbreaker.
   - **Choose this plan** runs contrastive learning on the dimensions. **Reason chips** are asked only when the choice is ambiguous.
   - **Share as template:** visibility private / friends / friends-of-friends / public. Dates stay hidden until the trip is over.
6. **Group trip room:**
   - date poll over long weekends
   - anonymous criteria bar with "hides N"
   - hard criteria: preview hidden options, or **ask to relax** (anonymous request to the owner; only the owner can relax)
   - soft criteria: anyone can toggle
   - like / veto per plan; the organizer confirms
   - fairness weights (whoever picked last time gets less weight)
   - task list
   - invite link for non-users (device share sheet, or copy)
7. **Templates feed:**
   - curated public templates, plus friends and friends-of-friends
   - like / save / **remix**; remix edits are stored as diffs, which are preference signals
8. **Profile:**
   - persona and dimensions
   - dealbreakers panel: confirm inferred ones as soft or "never"; add or remove
   - past trips: **Retake**, a 3-question **post-trip check-in** (repeat / skip / surprise, which feeds dealbreakers and dimensions), visibility
   - nudges and settings: calendar opt-in, personal dates
9. **Nudges:** ranked triggers across calendar, personal (opt-in), social, event, price, behavioural and trip-anniversary. The monthly cap is:
   - **seasonal baseline:** Oct–Dec weekly, Jun–Aug twice a month, else three a month
   - **× personal adjustment:** parents get more in school holidays; the rate halves after 3 ignored nudges
   - **× trigger strength**
10. **Metrics:**
    - **North star:** incremental trips (bookings from users with no travel search in the prior 30 days, vs a holdout).
    - **Guardrails:** violation edit rate (should trend to 0), notification opt-out.
    - **Learning signal:** discovery edit rate.

## Signal hierarchy

| Tier | Sources | Use |
|---|---|---|
| Stated | Onboarding, chat slots, reason chips, check-ins, confirmations | Long-lived |
| Revealed | Plan chosen vs rejected, swaps, remixes, votes, retakes | Medium; contrastive updates |
| Passive | Dwell time on plans | **Within the session only** (re-rank); never long-term profiling |

## Out of scope / later

- **Mentioned in the doc, not built:**
  - multi-origin group trips
  - proxy profiles for non-users
  - beneficiary modifier
  - in-trip companion: re-planning, disruptions, same-day energy swaps, restaurant matching
  - multimodal comparison
  - guest-photo priority
  - creator monetization (adtech angle)
- **Out of scope:** payment splitting, packing lists, cross-OTA price comparison, document entry (the host OTA already handles document OCR).

## Tech

- **Framework:** Next.js 16 (App Router), React 19, Tailwind 4, TypeScript.
- **Layout:** responsive and full screen. Under 768px it is a phone app (bottom tabs, swipeable plan rows); from 768px a left sidebar replaces the tabs and plans sit in 2–3 column grids. Shared pieces live in `components/ui.tsx` (`Shell`, `PLAN_GRID`).
- **No third-party brand names** in the UI or product docs (no OTA, social app, airline or train-service names). Tech-stack names stay only in setup instructions.
- **Database:** Postgres.
  - **Supabase** when `DATABASE_URL` is set (transaction pooler, `prepare:false`).
  - Otherwise an embedded Postgres (**PGlite**) at `./.pglite`, so the app runs with zero setup.
  - The schema and seed apply automatically on first request.
  - Schema file: `supabase/schema.sql`.
- **LLM:** Grok via `XAI_API_KEY` (`XAI_MODEL` overrides the model). Every LLM step has a rule-based fallback, so demos never break.
- **Sessions:** cookie-based.
  - **"Explore as Arjun"** clones an isolated copy of the persona per visitor (profile, dealbreakers, past trips, group room).
  - **"Start fresh"** creates an anonymous user.
- **Privacy:** constraint owners are never sent to other members (enforced in `app/api/trip/[id]`).

## Seed data

- **Catalog:** 12 destinations from Delhi.
  - Per destination: 3 stays, 3 transport options, 4 food spots, 4 activities.
  - **~430 synthetic reviews** written in mixed party voices, from a phrase bank.
- **Persona: Arjun.**
  - 31, Gurugram, non-veg; partner Meera is vegetarian.
  - Budget ₹30k per person.
  - Top intents: Thrill · Friends, Celebrate · Couple, Rest · Solo.
  - Dealbreakers:
    - no road journeys over 6h (hard)
    - avoid fixed-schedule tours (soft)
    - no hostels with Meera (hard, couple trips only)
    - red-eye flights (inferred, awaiting confirmation)
  - Past trips: Rishikesh (check-in pending), Udaipur, Goa.
  - Friends: Rohan (private budget ₹12k), Neha (vegetarian, no early starts), Kabir (avoids crowds), plus Priya as a friend-of-friend.

## Images

Swipe scenes load from `/public/onboarding/p01a.png` … `p12b.png` (4:5). Until those exist, gradient + emoji fallbacks render. Prompts for generating them are in the conversation history.
