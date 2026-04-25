create extension if not exists "pgcrypto";

create table if not exists public.performance_logs (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  horizon text not null,
  module_name text not null,
  recommendation text not null,
  score numeric,
  triggered_signals jsonb,
  entry_price numeric,
  exit_price numeric,
  return_pct numeric,
  profitable boolean,
  hold_duration_days integer,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  market_context jsonb
);

create index if not exists performance_logs_symbol_created_at_idx
  on public.performance_logs (symbol, created_at desc);

create index if not exists performance_logs_module_horizon_idx
  on public.performance_logs (module_name, horizon, created_at desc);

create index if not exists performance_logs_closed_at_idx
  on public.performance_logs (closed_at)
  where closed_at is not null;
