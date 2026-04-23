export type Bias = "Bullish" | "Bearish" | "Watch";
export type Risk = "Low" | "Medium" | "High";

export type WatchlistItem = {
  symbol: string;
  bias: Bias;
  sector: string;
  risk: Risk;
  bestFor: string;
  price: number;
  support: number;
  resistance: number;
  rsi: number;
  volumeRatio: number;
  technicalScore: number;
  whaleScore: number;
  macroScore: number;
  politicalScore: number;
  notes: string[];
};