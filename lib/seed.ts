// Seeds the catalog, the "offline" review pipeline output, the demo persona and social data.
import { ALL_ITEMS, ITEM_BY_ID } from "./data/catalog";
import { aggregate, extractHeuristic, generateReviews, PHRASES, type Extraction } from "./data/reviews";
import {
  DEMO_DEALBREAKERS, DEMO_ID, DEMO_PAST_TRIPS, FRIENDSHIPS, GROUP_TRIP, HOLIDAYS, PROFILES, TEMPLATES,
} from "./data/people";
import { bulkInsert, type Driver } from "./db";

export function computeReviewPipeline() {
  const reviews = generateReviews();
  const byId = new Map(reviews.map((r) => [r.id, r]));
  const extractions: Extraction[] = reviews.flatMap((r) => extractHeuristic(r));
  const byItem = new Map<string, Extraction[]>();
  for (const e of extractions) {
    if (!byItem.has(e.item_id)) byItem.set(e.item_id, []);
    byItem.get(e.item_id)!.push(e);
  }
  const scores: { item_id: string; lens: string; aspects: Record<string, number>; confidence: number }[] = [];
  for (const item of ALL_ITEMS) {
    const agg = aggregate(item, byItem.get(item.id) ?? [], byId);
    for (const [lens, v] of Object.entries(agg)) scores.push({ item_id: item.id, lens, aspects: v.aspects, confidence: v.confidence });
  }
  return { reviews, extractions, scores };
}

/** Changes whenever the catalog or the review phrase bank changes; stored in app_meta (see lib/db.ts). */
export const CATALOG_VERSION = (() => {
  const s = JSON.stringify({ items: ALL_ITEMS, phrases: PHRASES });
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${ALL_ITEMS.length}-${(h >>> 0).toString(36)}`;
})();

async function insertCatalog(d: Driver) {
  const { reviews, extractions, scores } = computeReviewPipeline();
  await bulkInsert(d, "items", ALL_ITEMS.map((i) => ({ id: i.id, kind: i.kind, dest_id: "destId" in i ? i.destId : i.id, name: i.name, data: i })));
  await bulkInsert(d, "reviews", reviews);
  await bulkInsert(d, "review_extractions", extractions.map((e) => ({ ...e, extractor: "rules" })));
  await bulkInsert(d, "item_aspect_scores", scores);
}

/** Rebuild only the catalog and review tables (items, reviews, extractions, scores). User data is untouched. */
export async function refreshCatalog(d: Driver) {
  for (const t of ["item_aspect_scores", "review_extractions", "reviews", "items"]) await d.query(`delete from ${t}`);
  await insertCatalog(d);
}

export async function seedAll(d: Driver) {
  await insertCatalog(d);
  await bulkInsert(d, "holiday_calendar", HOLIDAYS.map((h) => ({ date: h.date, name: h.name, region: "IN" })));

  await bulkInsert(d, "profiles", PROFILES.map((p) => ({ ...p, onboarded: true, is_demo: p.id === DEMO_ID, calendar_opt_in: p.id === DEMO_ID })));
  await bulkInsert(d, "friendships", FRIENDSHIPS.flatMap(([a, b]) => [{ user_id: a, friend_id: b }, { user_id: b, friend_id: a }]));
  await seedPersonaRows(d, DEMO_ID);
  await bulkInsert(d, "templates", TEMPLATES);
}

/** Persona-owned rows. Called for the base persona and again for every "Explore as Arjun" visitor (isolated copy). */
export async function seedPersonaRows(d: Driver, uid: string) {
  const sfx = uid === DEMO_ID ? "" : `-${uid}`;
  await bulkInsert(d, "dealbreakers", DEMO_DEALBREAKERS.map((b, i) => ({
    id: `db${i + 1}${sfx}`, user_id: uid, attribute: b.attribute, label: b.label, kind: b.kind,
    context_party: b.context_party ?? null, context_need: null, confidence: b.confidence, source: b.source, status: b.status,
  })));
  await bulkInsert(d, "trips", DEMO_PAST_TRIPS.map((t) => ({
    id: `${t.id}${sfx}`, owner_id: uid, name: t.name, kind: "past", need: t.need, party: t.party, dest_id: t.dest_id,
    start_date: t.start, days: t.days, items: t.items, visibility: t.visibility, status: "completed",
  })));
  await bulkInsert(d, "post_trip_checkins", DEMO_PAST_TRIPS.filter((t) => t.checkin_done).map((t) => ({
    trip_id: `${t.id}${sfx}`, user_id: uid, repeat_items: t.items.activities.slice(0, 1), skip_items: [], surprise: "",
  })));
  for (const t of DEMO_PAST_TRIPS) {
    await bulkInsert(d, "trip_members", [{ trip_id: `${t.id}${sfx}`, user_id: uid, role: "owner" }]);
  }

  const g = GROUP_TRIP;
  const gid = `${g.id}${sfx}`;
  const map = (u: string) => (u === DEMO_ID ? uid : u);
  await bulkInsert(d, "trips", [{
    id: gid, owner_id: uid, name: g.name, kind: "group", need: g.need, secondary_need: g.secondary, party: g.party,
    visibility: "friends", status: "planning", fairness: Object.fromEntries(Object.entries(g.fairness).map(([k, v]) => [map(k), v])),
    last_picked_by: g.lastPickedBy, days: 3, start_date: "2026-12-25",
  }]);
  await bulkInsert(d, "trip_members", g.members.map((m) => ({ trip_id: gid, user_id: map(m), role: m === g.organizer ? "organizer" : "member" })));
  await bulkInsert(d, "date_poll_options", g.pollOptions.map((o) => ({ id: `${o.id}${sfx}`, trip_id: gid, label: o.label, start_date: o.start, days: o.days })));
  await bulkInsert(d, "date_poll_votes", Object.entries(g.votes).flatMap(([opt, us]) => us.map((u) => ({ option_id: `${opt}${sfx}`, user_id: map(u) }))));
  await bulkInsert(d, "trip_constraints", g.constraints.map((c) => ({ id: `${c.id}${sfx}`, trip_id: gid, owner_id: map(c.owner), attribute: c.attribute, label: c.label, kind: c.kind, value: c.value, enabled: true })));
  await bulkInsert(d, "relax_requests", g.relaxRequests.map((r) => ({ id: `${r.id}${sfx}`, trip_id: gid, constraint_id: `${r.constraint}${sfx}`, requested_by: "rohan", message: r.message, status: "pending" })));
  await bulkInsert(d, "trip_votes", g.tripVotes.map((v) => ({ trip_id: gid, user_id: map(v.user), dest_id: v.dest, vote: v.vote })));
  await bulkInsert(d, "trip_tasks", g.tasks.map((t) => ({ id: `${t.id}${sfx}`, trip_id: gid, label: t.label, assignee_id: t.assignee ? map(t.assignee) : null, done: t.done })));
}

export function itemName(id: string) {
  return ITEM_BY_ID.get(id)?.name ?? id;
}
