import type { Item } from "@/types/dashboard";
import { num } from "@/app/lib/helpers";

type WatchlistDbRow = Record<string, unknown>;

const WATCHLIST_DB_FIELD_MAP = {
  symbol: ["symbol"],
  bias: ["bias"],
  price: ["price", "last_price"],
  swingScore: ["swing_score", "swingScore"],
  threeMonthScore: ["three_month_score", "threeMonthScore"],
  sixMonthScore: ["six_month_score", "sixMonthScore"],
  oneYearScore: ["one_year_score", "oneYearScore"],
  support: ["support"],
  resistance: ["resistance"],
  rsi: ["rsi"],
  volumeRatio: ["volume_ratio", "volumeRatio"],
  technicalScore: ["technical_score", "technicalScore", "tech"],
  whaleScore: ["whale_score", "whaleScore", "intel"],
  macroScore: ["macro_score", "macroScore"],
  politicalScore: ["political_score", "politicalScore", "env"],
  lr50: ["lr_50", "lr50"],
  lr50Slope: ["lr_50_slope", "lr50Slope"],
  lr100: ["lr_100", "lr100"],
  lr100Slope: ["lr_100_slope", "lr100Slope"],
  fibSupport: ["fib_support", "fibSupport"],
  fibResistance: ["fib_resistance", "fibResistance"],
  atrPercent: ["atr_percent", "atrPercent"],
  betaProxy: ["beta_proxy", "betaProxy"],
  priceVolatility: ["price_volatility", "priceVolatility"],
  ivPercentile: ["iv_percentile", "ivPercentile"],
  earningsDays: ["earnings_days", "earningsDays"],
  notes: ["notes"],
} as const;

function pickFirst(row: WatchlistDbRow, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : num(value);
}

export function mapWatchlistRowToItem(row: WatchlistDbRow): Item {
  const rawSymbol = pickFirst(row, WATCHLIST_DB_FIELD_MAP.symbol);
  const rawBias = pickFirst(row, WATCHLIST_DB_FIELD_MAP.bias);
  const bias: Item["bias"] =
    rawBias === "Bullish" || rawBias === "Bearish" || rawBias === "Watch" ? rawBias : "Watch";

  return {
    symbol: typeof rawSymbol === "string" ? rawSymbol : "",
    bias,
    price: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.price)),
    swingScore: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.swingScore)),
    threeMonthScore: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.threeMonthScore)),
    sixMonthScore: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.sixMonthScore)),
    oneYearScore: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.oneYearScore)),
    support: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.support)),
    resistance: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.resistance)),
    rsi: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.rsi), 50),
    volumeRatio: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.volumeRatio), 1),
    technicalScore: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.technicalScore), 70),
    whaleScore: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.whaleScore), 60),
    macroScore: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.macroScore), 60),
    politicalScore: num(pickFirst(row, WATCHLIST_DB_FIELD_MAP.politicalScore), 60),
    lr50: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.lr50)),
    lr50Slope: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.lr50Slope)),
    lr100: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.lr100)),
    lr100Slope: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.lr100Slope)),
    fibSupport: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.fibSupport)),
    fibResistance: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.fibResistance)),
    atrPercent: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.atrPercent)),
    betaProxy: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.betaProxy)),
    priceVolatility: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.priceVolatility)),
    ivPercentile: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.ivPercentile)),
    earningsDays: toOptionalNumber(pickFirst(row, WATCHLIST_DB_FIELD_MAP.earningsDays)),
    notes: Array.isArray(pickFirst(row, WATCHLIST_DB_FIELD_MAP.notes))
      ? (pickFirst(row, WATCHLIST_DB_FIELD_MAP.notes) as unknown[]).filter(
          (note): note is string => typeof note === "string"
        )
      : [],
  };
}

export function mapItemToWatchlistRow(row: Item) {
  return {
    symbol: row.symbol,
    bias: row.bias,
    price: row.price,
    swing_score: row.swingScore,
    three_month_score: row.threeMonthScore,
    six_month_score: row.sixMonthScore,
    one_year_score: row.oneYearScore,
    support: row.support,
    resistance: row.resistance,
    rsi: row.rsi,
    volume_ratio: row.volumeRatio,
    technical_score: row.technicalScore,
    whale_score: row.whaleScore,
    macro_score: row.macroScore,
    political_score: row.politicalScore,
    lr_50: row.lr50,
    lr_50_slope: row.lr50Slope,
    lr_100: row.lr100,
    lr_100_slope: row.lr100Slope,
    fib_support: row.fibSupport,
    fib_resistance: row.fibResistance,
    atr_percent: row.atrPercent,
    beta_proxy: row.betaProxy,
    price_volatility: row.priceVolatility,
    iv_percentile: row.ivPercentile,
    earnings_days: row.earningsDays,
    notes: row.notes,
  };
}

export const WATCHLIST_MARKET_CONTEXT_SELECT =
  "symbol, technical_score, macro_score, political_score, rsi, volume_ratio, price_volatility, earnings_days, price, sector";
