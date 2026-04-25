-- Repair legacy watchlist schema to match fields written/read by the dashboard app.
-- Backward compatible: only adds nullable columns when missing.

alter table if exists public.watchlist
  add column if not exists "swingScore" numeric,
  add column if not exists "threeMonthScore" numeric,
  add column if not exists "sixMonthScore" numeric,
  add column if not exists "oneYearScore" numeric,
  add column if not exists "swingStrategy" text,
  add column if not exists "threeMonthStrategy" text,
  add column if not exists "sixMonthStrategy" text,
  add column if not exists "oneYearStrategy" text,
  add column if not exists confidence text,
  add column if not exists risk text,
  add column if not exists reason text,
  add column if not exists notes text[];
