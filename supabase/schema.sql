-- TripGenie schema (also applied automatically by the app)

create table if not exists profiles (
  id text primary key,
  name text not null,
  home_city text default 'Delhi',
  diet text default 'none',
  budget_pp int default 15000,
  default_party text default 'friends',
  persona text,
  dims jsonb default '{}'::jsonb,
  need_affinity jsonb default '{}'::jsonb,
  intents jsonb default '[]'::jsonb,
  companions jsonb default '[]'::jsonb,
  personal_dates jsonb default '[]'::jsonb,
  segment text default 'professional',
  onboarded boolean default false,
  is_demo boolean default false,
  calendar_opt_in boolean default false,
  ignored_nudges int default 0,
  created_at timestamptz default now()
);

create table if not exists friendships (
  user_id text not null,
  friend_id text not null,
  primary key (user_id, friend_id)
);

create table if not exists onboarding_responses (
  id bigserial primary key,
  user_id text not null,
  pair_id text not null,
  choice text not null,
  ms int,
  created_at timestamptz default now()
);

create table if not exists dealbreakers (
  id text primary key,
  user_id text not null,
  attribute text not null,
  label text not null,
  kind text not null default 'soft',
  context_party text,
  context_need text,
  confidence real default 0.5,
  source text default 'stated',
  status text default 'confirmed',
  created_at timestamptz default now()
);

create table if not exists signals (
  id bigserial primary key,
  user_id text not null,
  session_id text,
  type text not null,
  tier text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists items (
  id text primary key,
  kind text not null,
  dest_id text,
  name text not null,
  data jsonb not null
);

create table if not exists reviews (
  id text primary key,
  item_id text not null,
  party text,
  text text not null,
  rating int,
  date date
);

create table if not exists review_extractions (
  id bigserial primary key,
  review_id text not null,
  item_id text not null,
  party text,
  aspect text not null,
  level real not null,
  sentiment int not null,
  snippet text,
  extractor text default 'rules'
);

create table if not exists item_aspect_scores (
  item_id text not null,
  lens text not null,
  aspects jsonb not null,
  confidence real,
  computed_at timestamptz default now(),
  primary key (item_id, lens)
);

create table if not exists plan_sets (
  id text primary key,
  user_id text not null,
  request jsonb,
  plan_ids jsonb,
  context text,
  created_at timestamptz default now()
);

create table if not exists plans (
  id text primary key,
  set_id text,
  user_id text not null,
  plan jsonb not null,
  source text,
  created_at timestamptz default now()
);

create table if not exists plan_choices (
  id bigserial primary key,
  user_id text not null,
  set_id text,
  chosen_plan_id text,
  rejected jsonb,
  reason_chips jsonb,
  created_at timestamptz default now()
);

create table if not exists plan_edits (
  id bigserial primary key,
  user_id text not null,
  plan_id text,
  template_id text,
  element text,
  removed_id text,
  added_id text,
  edit_type text,
  dealbreaker_attr text,
  created_at timestamptz default now()
);

create table if not exists trips (
  id text primary key,
  owner_id text not null,
  name text not null,
  kind text not null,
  need text,
  secondary_need text,
  party text,
  dest_id text,
  start_date date,
  days int,
  items jsonb,
  plan_id text,
  visibility text default 'private',
  status text default 'planning',
  fairness jsonb default '{}'::jsonb,
  last_picked_by text,
  template_id text,
  created_at timestamptz default now()
);

create table if not exists trip_members (
  trip_id text not null,
  user_id text not null,
  role text default 'member',
  primary key (trip_id, user_id)
);

create table if not exists date_poll_options (
  id text primary key,
  trip_id text not null,
  label text,
  start_date date,
  days int
);

create table if not exists date_poll_votes (
  option_id text not null,
  user_id text not null,
  primary key (option_id, user_id)
);

-- owner_id is never returned to other members (enforced in the API; add RLS when using Supabase client-side).
create table if not exists trip_constraints (
  id text primary key,
  trip_id text not null,
  owner_id text not null,
  attribute text not null,
  label text not null,
  kind text not null,
  value jsonb default '{}'::jsonb,
  enabled boolean default true
);

create table if not exists relax_requests (
  id text primary key,
  trip_id text not null,
  constraint_id text not null,
  requested_by text,
  message text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists trip_votes (
  trip_id text not null,
  user_id text not null,
  dest_id text not null,
  vote text not null,
  primary key (trip_id, user_id, dest_id)
);

create table if not exists trip_tasks (
  id text primary key,
  trip_id text not null,
  label text not null,
  assignee_id text,
  done boolean default false
);

create table if not exists post_trip_checkins (
  trip_id text not null,
  user_id text not null,
  repeat_items jsonb,
  skip_items jsonb,
  surprise text,
  created_at timestamptz default now(),
  primary key (trip_id, user_id)
);

create table if not exists templates (
  id text primary key,
  author_id text,
  author_name text,
  title text not null,
  blurb text,
  need text,
  party text,
  dest_id text,
  days int,
  items jsonb,
  visibility text default 'public',
  trip_completed boolean default true,
  trip_start date,
  likes int default 0,
  saves int default 0,
  remixes int default 0,
  stock boolean default false,
  created_at timestamptz default now()
);

create table if not exists template_remixes (
  id bigserial primary key,
  template_id text not null,
  user_id text not null,
  plan_id text,
  diff jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists template_likes (
  template_id text not null,
  user_id text not null,
  kind text not null,
  primary key (template_id, user_id, kind)
);

create table if not exists holiday_calendar (
  date date not null,
  name text not null,
  region text default 'IN',
  primary key (date, region)
);

create table if not exists notifications (
  id bigserial primary key,
  user_id text not null,
  trigger_key text not null,
  title text,
  status text default 'sent',
  created_at timestamptz default now()
);

create table if not exists reel_imports (
  id bigserial primary key,
  user_id text not null,
  url text not null,
  detected jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_signals_user on signals(user_id, created_at);
create index if not exists idx_extractions_item on review_extractions(item_id);
create index if not exists idx_plans_user on plans(user_id);
create index if not exists idx_trips_owner on trips(owner_id);
