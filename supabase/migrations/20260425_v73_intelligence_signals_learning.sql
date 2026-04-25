create extension if not exists "pgcrypto";

create table if not exists public.intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  sector text,
  horizon text not null,
  rating text not null,
  strategy text,
  confidence text,
  risk text,
  score numeric,
  entry_price numeric,
  target_price numeric,
  stop_price numeric,
  factor_weights jsonb,
  factor_breakdown jsonb,
  reason text,
  created_at timestamptz not null default now(),
  evaluated_at timestamptz,
  outcome_return numeric,
  outcome_status text,
  model_version text not null default 'v1'
);

create index if not exists intelligence_signals_symbol_horizon_created_at_idx
  on public.intelligence_signals (symbol, horizon, created_at desc);

create index if not exists intelligence_signals_evaluated_at_idx
  on public.intelligence_signals (evaluated_at)
  where evaluated_at is not null;

create table if not exists public.intelligence_adaptive_weights (
  symbol text not null,
  sector text,
  horizon text not null,
  weights jsonb not null,
  model_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (symbol, horizon)
);
