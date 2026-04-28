-- Enforce watchlist as user-persistence only. Runtime intelligence fields are not persisted.

alter table if exists public.watchlist
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists symbol text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists notes text[] default '{}'::text[],
  add column if not exists manual_bias text,
  add column if not exists favorite boolean default false,
  add column if not exists user_tags text[] default '{}'::text[];

alter table if exists public.watchlist
  alter column symbol set not null;

-- Remove runtime/system analytics columns from persistence.
alter table if exists public.watchlist
  drop column if exists bias,
  drop column if exists price,
  drop column if exists swing_score,
  drop column if exists three_month_score,
  drop column if exists six_month_score,
  drop column if exists one_year_score,
  drop column if exists support,
  drop column if exists resistance,
  drop column if exists rsi,
  drop column if exists volume_ratio,
  drop column if exists technical_score,
  drop column if exists whale_score,
  drop column if exists macro_score,
  drop column if exists political_score,
  drop column if exists lr_50,
  drop column if exists lr_50_slope,
  drop column if exists lr_100,
  drop column if exists lr_100_slope,
  drop column if exists fib_support,
  drop column if exists fib_resistance,
  drop column if exists atr_percent,
  drop column if exists beta_proxy,
  drop column if exists price_volatility,
  drop column if exists iv_percentile,
  drop column if exists earnings_days,
  drop column if exists sector,
  drop column if exists updated_at;

create unique index if not exists watchlist_symbol_key on public.watchlist(symbol);
