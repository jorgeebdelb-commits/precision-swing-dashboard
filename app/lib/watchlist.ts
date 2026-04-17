export type Bias = "Bullish" | "Bearish" | "Watch";
export type WatchlistItem = {
  symbol: string;
  bias: Bias;
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

export const watchlist: WatchlistItem[] = [
  {
    symbol: "NVDA",
    bias: "Bullish",
    price: 188.63,
    support: 184.3,
    resistance: 190,
    rsi: 61,
    volumeRatio: 1.8,
    technicalScore: 91,
    whaleScore: 84,
    macroScore: 70,
    politicalScore: 58,
    notes: ["AI leadership", "Strong participation", "Export-control sensitivity"],
  },
  {
    symbol: "MRVL",
    bias: "Bullish",
    price: 78.4,
    support: 76.8,
    resistance: 80.2,
    rsi: 58,
    volumeRatio: 1.6,
    technicalScore: 84,
    whaleScore: 76,
    macroScore: 68,
    politicalScore: 60,
    notes: ["Semi tailwind", "Needs clean breakout"],
  },
  {
    symbol: "MARA",
    bias: "Bullish",
    price: 20.8,
    support: 19.9,
    resistance: 21.7,
    rsi: 66,
    volumeRatio: 2.2,
    technicalScore: 88,
    whaleScore: 79,
    macroScore: 82,
    politicalScore: 64,
    notes: ["BTC-linked", "Liquidity tailwind if crypto strong"],
  },
  {
    symbol: "SMCI",
    bias: "Watch",
    price: 91.1,
    support: 88.4,
    resistance: 94.5,
    rsi: 49,
    volumeRatio: 1.3,
    technicalScore: 67,
    whaleScore: 61,
    macroScore: 65,
    politicalScore: 57,
    notes: ["Needs confirmation", "Choppier structure"],
  },
  {
    symbol: "CLSK",
    bias: "Watch",
    price: 15.6,
    support: 14.9,
    resistance: 16.4,
    rsi: 53,
    volumeRatio: 1.5,
    technicalScore: 72,
    whaleScore: 66,
    macroScore: 78,
    politicalScore: 63,
    notes: ["Miner sympathy", "BTC trend matters"],
  },
  {
    symbol: "AVGO",
    bias: "Bearish",
    price: 143.5,
    support: 141.2,
    resistance: 146.0,
    rsi: 42,
    volumeRatio: 1.7,
    technicalScore: 79,
    whaleScore: 64,
    macroScore: 66,
    politicalScore: 59,
    notes: ["Mixed tape", "Needs stronger directional confirmation"],
  },
];