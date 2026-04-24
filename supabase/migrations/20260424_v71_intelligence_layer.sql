create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  name text not null default 'Default',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists watchlists_profile_default_uniq
  on public.watchlists (profile_id, is_default)
  where is_default = true;

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  symbol text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  snapshot_at timestamptz not null default now(),
  price numeric(14,4),
  change_pct numeric(8,4),
  volume_ratio numeric(8,4),
  rsi numeric(8,4),
  source text,
  created_at timestamptz not null default now()
);

create index if not exists market_snapshots_symbol_snapshot_at_idx
  on public.market_snapshots (symbol, snapshot_at desc);

create table if not exists public.intelligence_scores (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  generated_at timestamptz not null default now(),
  overall_score numeric(4,2) not null check (overall_score between 1 and 10),
  technical_score numeric(4,2) not null check (technical_score between 1 and 10),
  fundamentals_score numeric(4,2) not null check (fundamentals_score between 1 and 10),
  flow_score numeric(4,2) not null check (flow_score between 1 and 10),
  news_score numeric(4,2) not null check (news_score between 1 and 10),
  macro_score numeric(4,2) not null check (macro_score between 1 and 10),
  crowd_score numeric(4,2) not null check (crowd_score between 1 and 10),
  swing_score numeric(4,2) not null check (swing_score between 1 and 10),
  three_month_score numeric(4,2) not null check (three_month_score between 1 and 10),
  six_month_score numeric(4,2) not null check (six_month_score between 1 and 10),
  one_year_score numeric(4,2) not null check (one_year_score between 1 and 10),
  label text not null,
  best_strategy text not null,
  confidence_pct integer not null check (confidence_pct between 0 and 100),
  risk_level text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_cache (
  symbol text primary key,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz generated always as (generated_at + interval '1 hour') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intelligence_cache_expires_at_idx
  on public.intelligence_cache (expires_at);

create table if not exists public.news_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  headline text not null,
  sentiment_score numeric(4,2) not null check (sentiment_score between 1 and 10),
  source text,
  event_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists news_events_symbol_event_at_idx
  on public.news_events (symbol, event_at desc);

create table if not exists public.flow_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  score numeric(4,2) not null check (score between 1 and 10),
  event_type text,
  metadata jsonb,
  event_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists flow_events_symbol_event_at_idx
  on public.flow_events (symbol, event_at desc);

create table if not exists public.scoring_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'refresh',
  symbols text[] not null,
  result_count integer not null default 0,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
