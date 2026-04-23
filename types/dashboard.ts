import type { WatchlistItem } from "../app/lib/watchlist";

export type Item = WatchlistItem;

export type QuoteResponse = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  stale?: boolean;
  session?: string;
  trend?: string;
  dayRangePercent?: number;
  error?: string;
};

export type SentimentResponse = {
  symbol: string;
  sentimentScore: number;
  newsCount: number;
  sentimentLabel?: string;
  rawScore?: number;
  topHeadlines?: {
    headline: string;
    source?: string;
    score?: number;
  }[];
  error?: string;
};

export type Strategy =
  | "Buy Calls"
  | "Buy Puts"
  | "Buy Shares"
  | "Buy Shares + Calls"
  | "Watch";

export type HorizonKey =
  | "swing"
  | "threeMonth"
  | "sixMonth"
  | "oneYear";

export type SortKey =
  | "symbol"
  | "price"
  | "whaleV2"
  | "swing"
  | "threeMonth"
  | "sixMonth"
  | "oneYear"
  | "riskScore"
  | "opportunityScore"
  | "percentChange";

export type MarketRegime =
  | "Risk-On"
  | "Balanced"
  | "Risk-Off";