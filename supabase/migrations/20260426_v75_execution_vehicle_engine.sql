create extension if not exists "pgcrypto";

create table if not exists public.execution_signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  sector text,
  horizon text,
  final_strategy text,
  shares_score numeric,
  calls_score numeric,
  puts_score numeric,
  shares_action text,
  calls_action text,
  puts_action text,
  selected_vehicle text,
  entry_price numeric,
  stop_price numeric,
  target_price numeric,
  confidence text,
  risk text,
  reason text,
  refresh_session text,
  created_at timestamptz not null default now(),
  evaluated_at timestamptz,
  outcome_return numeric,
  outcome_status text,
  model_version text not null default 'execution_v1'
);

create unique index if not exists execution_signals_symbol_refresh_session_idx
  on public.execution_signals(symbol, refresh_session)
  where refresh_session is not null;

create index if not exists execution_signals_symbol_created_at_idx
  on public.execution_signals(symbol, created_at desc);

create table if not exists public.execution_adaptive_weights (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  sector text not null default '',
  weights jsonb not null,
  model_version text not null default 'execution_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists execution_adaptive_weights_symbol_sector_idx
  on public.execution_adaptive_weights(symbol, sector);
