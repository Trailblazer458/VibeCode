// Trigger engine: "why now". Decides when the app speaks; intent decides what it says.
import { DEST_EVENTS, HOLIDAYS } from "../data/people";
import { DEST_BY_ID } from "../data/catalog";

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");
const fmt = (s: string) => parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const wd = (s: string) => parse(s).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });

export interface LongWeekend {
  holiday: string;
  date: string;
  start: string;
  days: number;
  leaveDays: string[];
  label: string;
  inDays: number;
}

/** Long weekends from the holiday calendar, including bridge days (take 1 leave, get 4 days). */
export function longWeekends(today = new Date(), holidays = HOLIDAYS): LongWeekend[] {
  const t0 = parse(iso(today)).getTime();
  const out: LongWeekend[] = [];
  for (const h of holidays) {
    const d = parse(h.date);
    const dow = d.getUTCDay(); // 0 Sun
    let start = d.getTime();
    let days = 1;
    const leave: string[] = [];
    if (dow === 5) { days = 3; }
    else if (dow === 1) { start -= 2 * DAY; days = 3; }
    else if (dow === 4) { days = 4; leave.push(iso(new Date(d.getTime() + DAY))); }
    else if (dow === 2) { start -= 3 * DAY; days = 4; leave.push(iso(new Date(d.getTime() - DAY))); }
    else if (dow === 3) { start -= 4 * DAY; days = 5; leave.push(iso(new Date(d.getTime() - 2 * DAY)), iso(new Date(d.getTime() - DAY))); }
    else continue; // falls on a weekend
    const inDays = Math.round((start - t0) / DAY);
    if (inDays < 2) continue;
    const s = iso(new Date(start));
    out.push({
      holiday: h.name, date: h.date, start: s, days, leaveDays: leave, inDays,
      label: `${h.name}: ${wd(s)} ${fmt(s)} – ${wd(iso(new Date(start + (days - 1) * DAY)))} ${fmt(iso(new Date(start + (days - 1) * DAY)))}`,
    });
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/** Next window to plan for: a long weekend with enough lead time, else the coming weekend. */
export function nextWindow(today = new Date()) {
  const lw = longWeekends(today).find((w) => w.inDays >= 7);
  if (lw) return { start: lw.start, days: lw.days, label: lw.label, leaveDays: lw.leaveDays, inDays: lw.inDays, holiday: lw.holiday };
  const t = parse(iso(today));
  const toSat = (6 - t.getUTCDay() + 7) % 7 || 7;
  const s = iso(new Date(t.getTime() + toSat * DAY));
  return { start: s, days: 2, label: `This weekend: ${fmt(s)}`, leaveDays: [] as string[], inDays: toSat, holiday: null as string | null };
}

export interface Trigger {
  key: string;
  type: "calendar" | "personal" | "social" | "event" | "price" | "behavioural" | "school";
  title: string;
  body: string;
  strength: number;
  when: string;
  inDays: number;
  cta?: string;
}

/** Monthly nudge budget: seasonal baseline × personal adjustment (segment, responsiveness). */
export function monthlyCap(month: number, segment: string, ignored: number) {
  let base = month >= 9 && month <= 11 ? 4 : month >= 5 && month <= 7 ? 2 : 3; // Oct–Dec weekly, Jun–Aug twice
  if (segment === "parent" && month >= 3 && month <= 5) base = 4; // school vacations
  if (ignored >= 3) base = Math.max(1, Math.floor(base / 2));
  return base;
}

export function buildTriggers(opts: {
  today?: Date;
  personalDates?: { label: string; date: string }[];
  calendarOptIn?: boolean;
  segment?: string;
  ignored?: number;
  groupInvites?: { tripName: string; from: string }[];
  searchedNotBooked?: string[];
  pastTrips?: { name: string; start: string }[];
}) {
  const today = opts.today ?? new Date();
  const t0 = parse(iso(today)).getTime();
  const horizon = 45;
  const list: Trigger[] = [];
  for (const w of longWeekends(today)) {
    if (w.inDays > 70) continue;
    const lead = w.inDays >= 21 && w.inDays <= 35 ? 0.95 : w.inDays < 21 ? 0.8 : 0.7;
    list.push({
      key: `lw-${w.date}`, type: "calendar", title: `${w.holiday} long weekend in ${w.inDays} days`,
      body: w.leaveDays.length ? `Take ${w.leaveDays.length} day off (${w.leaveDays.map((d) => `${wd(d)} ${fmt(d)}`).join(", ")}) and get ${w.days} days.` : `${w.days} days off without using leave.`,
      strength: lead, when: w.start, inDays: w.inDays, cta: "See plans",
    });
  }
  if (opts.calendarOptIn) {
    for (const p of opts.personalDates ?? []) {
      const d = parse(p.date);
      let next = Date.UTC(today.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      if (next < t0) next = Date.UTC(today.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate());
      const inDays = Math.round((next - t0) / DAY);
      if (inDays <= 60) list.push({ key: `pd-${p.label}`, type: "personal", title: `${p.label} in ${inDays} days`, body: "Plan something special while good stays are still available.", strength: 0.85, when: iso(new Date(next)), inDays, cta: "Plan a celebration" });
    }
  }
  for (const g of opts.groupInvites ?? []) list.push({ key: `inv-${g.tripName}`, type: "social", title: `${g.from} added you to “${g.tripName}”`, body: "Vote on dates and plans in the trip room.", strength: 0.95, when: iso(today), inDays: 0, cta: "Open trip room" });
  for (const e of DEST_EVENTS) {
    const inDays = Math.round((parse(e.start).getTime() - t0) / DAY);
    if (inDays < 3 || inDays > 75) continue;
    list.push({ key: `ev-${e.dest}-${e.start}`, type: "event", title: `${e.name}`, body: `${DEST_BY_ID.get(e.dest)?.name}, from ${fmt(e.start)}.`, strength: 0.65, when: e.start, inDays, cta: "See plans" });
  }
  for (const s of opts.searchedNotBooked ?? []) list.push({ key: `bh-${s}`, type: "behavioural", title: `Still thinking about ${DEST_BY_ID.get(s)?.name}?`, body: "Fresh plans that fit your profile, with prices for the next long weekend.", strength: 0.5, when: iso(today), inDays: 1, cta: "Resume" });
  list.push({ key: "price-goa", type: "price", title: "Delhi → Goa fares down 18%", body: "On dates around the Christmas weekend, a route you browsed.", strength: 0.55, when: iso(new Date(t0 + 2 * DAY)), inDays: 2, cta: "See Goa plans" });
  for (const p of opts.pastTrips ?? []) {
    const d = parse(p.start);
    let next = Date.UTC(today.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (next < t0) next = Date.UTC(today.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate());
    const inDays = Math.round((next - t0) / DAY);
    if (inDays <= horizon) list.push({ key: `ann-${p.name}`, type: "social", title: `One year since “${p.name}”`, body: "Get the gang together again?", strength: 0.45, when: iso(new Date(next)), inDays, cta: "Retake" });
  }

  const month = today.getUTCMonth();
  const cap = monthlyCap(month, opts.segment ?? "professional", opts.ignored ?? 0);
  const ranked = [...list].sort((a, b) => b.strength - a.strength);
  const sendable = ranked.filter((t) => t.inDays <= 40 && t.strength >= 0.6);
  const sent = new Set(sendable.slice(0, cap).map((t) => t.key));
  const why = (t: Trigger) =>
    sent.has(t.key) ? "send" : t.strength < 0.6 ? "held: weak trigger" : t.inDays > 40 ? "held: too early (goes out ~4 weeks before)" : "held: monthly cap reached";
  return {
    cap,
    season: month >= 9 && month <= 11 ? "Holiday season (Oct–Dec): about one nudge a week" : month >= 5 && month <= 7 ? "Peak work season (Jun–Aug): two nudges a month" : "Regular months: three nudges a month",
    triggers: ranked.map((t) => ({
      ...t,
      status: why(t),
    })),
  };
}
