export type Bias = "Bullish" | "Bearish" | "Watch";

export type WatchlistItem = {
  symbol: string;
  bias: Bias;
  price: number;
  swingScore?: number;
  threeMonthScore?: number;
  sixMonthScore?: number;
  oneYearScore?: number;
  support: number;
  resistance: number;
  rsi: number;
  volumeRatio: number;
  momentum?: number;
  technicalScore: number;
  whaleScore: number;
  macroScore: number;
  politicalScore: number;
  lr50?: number;
  lr50Slope?: number;
  lr100?: number;
  lr100Slope?: number;
  fibSupport?: number;
  fibResistance?: number;
  atrPercent?: number;
  betaProxy?: number;
  priceVolatility?: number;
  ivPercentile?: number;
  earningsDays?: number;
  notes: string[];
};

export const watchlist: WatchlistItem[] = [
  {
    symbol: "NVDA",
    bias: "Bullish",
    price: 188.63,
    swingScore: 8.1,
    threeMonthScore: 7.8,
    sixMonthScore: 7.6,
    oneYearScore: 7.4,
    support: 184.3,
    resistance: 190,
    rsi: 61,
    volumeRatio: 1.8,
    technicalScore: 91,
    whaleScore: 84,
    macroScore: 70,
    politicalScore: 58,
    notes: ["AI leadership"]
  },
  {
    symbol: "MARA",
    bias: "Bullish",
    price: 20.8,
    swingScore: 7.6,
    threeMonthScore: 7.1,
    sixMonthScore: 6.9,
    oneYearScore: 6.6,
    support: 19.9,
    resistance: 21.7,
    rsi: 66,
    volumeRatio: 2.2,
    technicalScore: 88,
    whaleScore: 79,
    macroScore: 82,
    politicalScore: 64,
    notes: ["BTC linked"]
  },
  {
    symbol: "MRVL",
    bias: "Watch",
    price: 78.4,
    swingScore: 6.7,
    threeMonthScore: 6.5,
    sixMonthScore: 6.4,
    oneYearScore: 6.3,
    support: 76.8,
    resistance: 80.2,
    rsi: 58,
    volumeRatio: 1.6,
    technicalScore: 84,
    whaleScore: 76,
    macroScore: 68,
    politicalScore: 60,
    notes: ["Semi setup"]
  }
];
