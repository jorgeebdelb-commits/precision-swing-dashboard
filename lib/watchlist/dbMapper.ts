import type { Item } from "@/types/dashboard";
import { num } from "@/app/lib/helpers";
import type { IntelligenceSymbolSummary } from "@/lib/intelligence/types";
import type { WatchlistInsert, WatchlistRow } from "@/lib/watchlist/schema";

type WatchlistDbRow = Partial<WatchlistRow> & Record<string, unknown>;

function toOptionalNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : num(value);
}

function toBias(value: unknown): Item["bias"] {
  return value === "Bullish" || value === "Bearish" || value === "Watch" ? value : "Watch";
}

export type WatchlistPersistedRow = WatchlistRow;

export type WatchlistRuntimeIntelligence = Partial<
  Pick<
    Item,
    | "price"
    | "swingScore"
    | "threeMonthScore"
    | "sixMonthScore"
    | "oneYearScore"
    | "support"
    | "resistance"
    | "rsi"
    | "volumeRatio"
    | "technicalScore"
    | "whaleScore"
    | "macroScore"
    | "politicalScore"
    | "lr50"
    | "lr50Slope"
    | "lr100"
    | "lr100Slope"
    | "fibSupport"
    | "fibResistance"
    | "atrPercent"
    | "betaProxy"
    | "priceVolatility"
    | "ivPercentile"
    | "earningsDays"
  >
>;

export function mapWatchlistRowToItem(row: WatchlistDbRow, runtime?: WatchlistRuntimeIntelligence): Item {
  const baseNotes = Array.isArray(row.notes)
    ? row.notes.filter((note): note is string => typeof note === "string")
    : [];

  return {
    symbol: typeof row.symbol === "string" ? row.symbol : "",
    bias: toBias(row.bias),
    price: num(runtime?.price, 0),
    swingScore: toOptionalNumber(runtime?.swingScore),
    threeMonthScore: toOptionalNumber(runtime?.threeMonthScore),
    sixMonthScore: toOptionalNumber(runtime?.sixMonthScore),
    oneYearScore: toOptionalNumber(runtime?.oneYearScore),
    support: num(runtime?.support, 0),
    resistance: num(runtime?.resistance, 0),
    rsi: num(runtime?.rsi, 50),
    volumeRatio: num(runtime?.volumeRatio, 1),
    technicalScore: num(runtime?.technicalScore, 70),
    whaleScore: num(runtime?.whaleScore, 60),
    macroScore: num(runtime?.macroScore, 60),
    politicalScore: num(runtime?.politicalScore, 60),
    lr50: toOptionalNumber(runtime?.lr50),
    lr50Slope: toOptionalNumber(runtime?.lr50Slope),
    lr100: toOptionalNumber(runtime?.lr100),
    lr100Slope: toOptionalNumber(runtime?.lr100Slope),
    fibSupport: toOptionalNumber(runtime?.fibSupport),
    fibResistance: toOptionalNumber(runtime?.fibResistance),
    atrPercent: toOptionalNumber(runtime?.atrPercent),
    betaProxy: toOptionalNumber(runtime?.betaProxy),
    priceVolatility: toOptionalNumber(runtime?.priceVolatility),
    ivPercentile: toOptionalNumber(runtime?.ivPercentile),
    earningsDays: toOptionalNumber(runtime?.earningsDays),
    notes: baseNotes,
  };
}

export const WATCHLIST_RUNTIME_ONLY_FIELDS = [
  "lr50",
  "lr50Slope",
  "lr100",
  "lr100Slope",
  "fibSupport",
  "fibResistance",
  "atrPercent",
  "betaProxy",
  "ivPercentile",
] as const;

export function mapItemToWatchlistPersistedRow(row: Item): WatchlistInsert {
  return {
    symbol: row.symbol,
    bias: row.bias,
    notes: row.notes,
  };
}

export function mapIntelligenceSummaryToRuntime(summary: IntelligenceSymbolSummary): WatchlistRuntimeIntelligence {
  const swing = summary.analyses.find((analysis) => analysis.horizon === "swing");
  const threeMonth = summary.analyses.find((analysis) => analysis.horizon === "threeMonth");
  const sixMonth = summary.analyses.find((analysis) => analysis.horizon === "sixMonth");
  const oneYear = summary.analyses.find((analysis) => analysis.horizon === "oneYear");

  return {
    swingScore: swing?.score,
    threeMonthScore: threeMonth?.score,
    sixMonthScore: sixMonth?.score,
    oneYearScore: oneYear?.score,
  };
}

export const WATCHLIST_MARKET_CONTEXT_SELECT = "symbol";
