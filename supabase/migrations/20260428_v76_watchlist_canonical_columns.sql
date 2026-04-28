-- Canonicalize public.watchlist to snake_case column names used by the app.
-- This permanently resolves runtime mismatches such as missing macro_score.

alter table if exists public.watchlist
  add column if not exists symbol text,
  add column if not exists bias text,
  add column if not exists price numeric,
  add column if not exists swing_score numeric,
  add column if not exists three_month_score numeric,
  add column if not exists six_month_score numeric,
  add column if not exists one_year_score numeric,
  add column if not exists support numeric,
  add column if not exists resistance numeric,
  add column if not exists rsi numeric,
  add column if not exists volume_ratio numeric,
  add column if not exists technical_score numeric,
  add column if not exists whale_score numeric,
  add column if not exists macro_score numeric,
  add column if not exists political_score numeric,
  add column if not exists lr_50 numeric,
  add column if not exists lr_50_slope numeric,
  add column if not exists lr_100 numeric,
  add column if not exists lr_100_slope numeric,
  add column if not exists fib_support numeric,
  add column if not exists fib_resistance numeric,
  add column if not exists atr_percent numeric,
  add column if not exists beta_proxy numeric,
  add column if not exists price_volatility numeric,
  add column if not exists iv_percentile numeric,
  add column if not exists earnings_days numeric,
  add column if not exists sector text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'watchlist'
      and column_name = 'macroScore'
  ) then
    execute 'update public.watchlist set macro_score = coalesce(macro_score, "macroScore")';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'watchlist'
      and column_name = 'technicalScore'
  ) then
    execute 'update public.watchlist set technical_score = coalesce(technical_score, "technicalScore")';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'watchlist'
      and column_name = 'politicalScore'
  ) then
    execute 'update public.watchlist set political_score = coalesce(political_score, "politicalScore")';
  end if;
end $$;
