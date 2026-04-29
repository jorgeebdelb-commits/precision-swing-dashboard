import type {
  Item,
  MarketRegime,
  RiskLabel,
  Strategy,
} from "../types/dashboard";
import {
  evaluateRecommendation,
  type ConfidenceLevel,
  type RecommendationEngineInput,
} from "../lib/intelligence/recommendationEngine";
import { routeExecutionStrategy } from "@/lib/execution/router";

import { clamp, formatPrice, num } from "../app/lib/helpers";

type RiskBucket = RiskLabel | `${RiskLabel}/${RiskLabel}`;
type TickerClass = "MegaCapTech" | "LargeGrowth" | "Speculative";

type PillarScores = {
  technical: number;
  fundamental: number;
  intelligence: number;
  environment: number;
};

type Sector =
  | "Semiconductors"
  | "Megacap Tech"
  | "EV"
  | "Crypto Mining"
  | "Energy"
  | "Healthcare"
  | "Financials"
  | "Industrials"
  | "Consumer"
  | "Unknown";

type TickerProfile = {
  sector: Sector;
  speculative: boolean;
  qualityTilt: number;
  momentumTilt: number;
};

type SymbolModelBias = {
  sectorLeadership: number;
  catalystClarity: number;
  supportDiscipline: number;
  trendBonus: number;
  momentumBias: number;
  macroDurability: number;
  fundamentalDurability: number;
};

type TechnicalFactors = {
  lr50: number;
  lr100: number;
  lr50Slope: number;
  lr100Slope: number;
  fibLevel: number;
  atrPercent: number;
  volatilityPercent: number;
  trendAligned: boolean;
};

export type TradePlan = {
  entryZone: string;
  stopLoss: string;
  target1: string;
  target2: string;
  positionSizing: string;
  callPlan: string;
  putPlan: string;
};

export type RowMetrics = {
  whaleV2: number;
  technical: number;
  fundamental: number;
  intelligence: number;
  environment: number;
  riskScore: number;
  riskLabel: RiskLabel;
  swing: number;
  threeMonth: number;
  sixMonth: number;
  oneYear: number;
  confidence: number;
  confidencePercent: number;
  finalScore: number;
  contradictionFlags: string[];
  recommendation: string;
  strategy: Strategy;
  reason: string;
  why: string[];
  swingSignal: string;
  threeMonthSignal: string;
  sixMonthSignal: string;
  oneYearSignal: string;
  swingStrategy: Strategy;
  threeMonthStrategy: Strategy;
  sixMonthStrategy: Strategy;
  oneYearStrategy: Strategy;
  confidenceLabel: "Low" | "Medium" | "High";
  marketRegime: MarketRegime;
  opportunityScore: number;
  entryZone: string;
  stopLoss: string;
  target1: string;
  target2: string;
  positionSizing: string;
  callPlan: string;
  putPlan: string;
  notes: string[];
  momentumToday: number;
  hotSetup: boolean;
};

const HIGH_BETA_SYMBOLS = new Set(["TSLA", "MARA", "RIVN", "IREN", "RGTI", "COIN"]);
const TICKER_CLASSES: Record<string, TickerClass> = {
  AMZN: "MegaCapTech",
  NVDA: "MegaCapTech",
  AMD: "MegaCapTech",
  TSLA: "LargeGrowth",
  MARA: "Speculative",
  RGTI: "Speculative",
  QBTS: "Speculative",
};

const TICKER_RISK_BUCKETS: Record<string, RiskBucket> = {
  AMZN: "Low/Medium",
  NVDA: "Medium",
  AMD: "Medium",
  TSLA: "High",
  MARA: "High/Extreme",
  RGTI: "Extreme",
  QBTS: "Extreme",
};

const SYMBOL_PROFILES: Record<string, TickerProfile> = {
  NVDA: { sector: "Semiconductors", speculative: false, qualityTilt: 0.9, momentumTilt: 0.8 },
  AMD: { sector: "Semiconductors", speculative: false, qualityTilt: 0.75, momentumTilt: 0.7 },
  MRVL: { sector: "Semiconductors", speculative: false, qualityTilt: 0.5, momentumTilt: 0.55 },
  AMZN: { sector: "Megacap Tech", speculative: false, qualityTilt: 0.8, momentumTilt: 0.45 },
  TSLA: { sector: "EV", speculative: true, qualityTilt: 0.35, momentumTilt: 0.95 },
  RIVN: { sector: "EV", speculative: true, qualityTilt: 0.2, momentumTilt: 0.9 },
  MARA: { sector: "Crypto Mining", speculative: true, qualityTilt: 0.1, momentumTilt: 1 },
  WULF: { sector: "Crypto Mining", speculative: true, qualityTilt: 0.22, momentumTilt: 0.82 },
  JOBY: { sector: "Industrials", speculative: true, qualityTilt: 0.24, momentumTilt: 0.86 },
  IBRX: { sector: "Healthcare", speculative: true, qualityTilt: 0.14, momentumTilt: 0.68 },
  QUBT: { sector: "Unknown", speculative: true, qualityTilt: 0.08, momentumTilt: 0.96 },
  ACHR: { sector: "Industrials", speculative: true, qualityTilt: 0.18, momentumTilt: 0.92 },
  NEM: { sector: "Energy", speculative: false, qualityTilt: 0.45, momentumTilt: 0.35 },
  PLTR: { sector: "Megacap Tech", speculative: false, qualityTilt: 0.64, momentumTilt: 0.82 },
};

const SYMBOL_MODEL_BIAS: Record<string, SymbolModelBias> = {
  NVDA: {
    sectorLeadership: 9.6,
    catalystClarity: 9.1,
    supportDiscipline: 8.4,
    trendBonus: 0.45,
    momentumBias: 0.34,
    macroDurability: 0.26,
    fundamentalDurability: 0.3,
  },
  AMD: {
    sectorLeadership: 7.6,
    catalystClarity: 7.2,
    supportDiscipline: 7.4,
    trendBonus: 0.2,
    momentumBias: 0.16,
    macroDurability: 0.2,
    fundamentalDurability: 0.22,
  },
  AMZN: {
    sectorLeadership: 8.1,
    catalystClarity: 7.6,
    supportDiscipline: 7.3,
    trendBonus: 0.12,
    momentumBias: 0.08,
    macroDurability: 0.3,
    fundamentalDurability: 0.34,
  },
  TSLA: {
    sectorLeadership: 7.1,
    catalystClarity: 6.4,
    supportDiscipline: 5.9,
    trendBonus: 0.08,
    momentumBias: 0.22,
    macroDurability: 0.1,
    fundamentalDurability: 0.06,
  },
  MARA: {
    sectorLeadership: 5.7,
    catalystClarity: 6.1,
    supportDiscipline: 4.9,
    trendBonus: -0.08,
    momentumBias: 0.18,
    macroDurability: -0.08,
    fundamentalDurability: -0.12,
  },
  NEM: {
    sectorLeadership: 5.6,
    catalystClarity: 5.5,
    supportDiscipline: 6.2,
    trendBonus: -0.12,
    momentumBias: -0.1,
    macroDurability: 0.1,
    fundamentalDurability: 0.12,
  },
  PLTR: {
    sectorLeadership: 7.8,
    catalystClarity: 7.9,
    supportDiscipline: 6.8,
    trendBonus: 0.18,
    momentumBias: 0.2,
    macroDurability: 0.12,
    fundamentalDurability: 0.18,
  },
};

const SECTOR_ADJUSTMENTS: Record<Sector, { fundamental: number; technical: number; environment: number }> = {
  Semiconductors: { fundamental: 0.35, technical: 0.2, environment: -0.1 },
  "Megacap Tech": { fundamental: 0.45, technical: 0.1, environment: 0.1 },
  EV: { fundamental: -0.3, technical: 0.35, environment: -0.15 },
  "Crypto Mining": { fundamental: -0.7, technical: 0.45, environment: -0.4 },
  Energy: { fundamental: 0.1, technical: 0.15, environment: 0.25 },
  Healthcare: { fundamental: 0.2, technical: -0.05, environment: 0.15 },
  Financials: { fundamental: 0.25, technical: -0.05, environment: 0.25 },
  Industrials: { fundamental: 0.15, technical: 0.05, environment: 0.2 },
  Consumer: { fundamental: 0.05, technical: 0, environment: 0.1 },
  Unknown: { fundamental: 0, technical: 0, environment: 0 },
};

const SECTOR_STRENGTH_BASE: Record<Sector, number> = {
  Semiconductors: 8.3,
  "Megacap Tech": 7.7,
  EV: 5.8,
  "Crypto Mining": 5.1,
  Energy: 6.4,
  Healthcare: 6.2,
  Financials: 6.1,
  Industrials: 6.2,
  Consumer: 6.3,
  Unknown: 5.8,
};

const clamp10 = (value: number): number =>
  Math.max(1, Math.min(10, Math.round(value * 10) / 10));

const scaleTo10 = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  return value > 10 ? clamp10(clamp(value) / 10) : clamp10(value);
};

const confidenceToScore = (confidence: ConfidenceLevel): number => {
  if (confidence === "High") return 8.6;
  if (confidence === "Medium") return 6.4;
  return 4.3;
};

const symbolSeed = (symbol: string): number => {
  return symbol
    .split("")
    .reduce((sum, char, idx) => sum + char.charCodeAt(0) * (idx + 1), 0);
};

function symbolJitter(symbol: string, scale = 0.22): number {
  const seed = symbolSeed(symbol) % 97;
  return ((seed / 96) * 2 - 1) * scale;
}

function inferSector(symbol: string): Sector {
  if (["QUBT", "QBTS", "RGTI", "IONQ"].includes(symbol)) return "Unknown";
  if (["MARA", "WULF", "RIOT", "CLSK", "IREN"].includes(symbol)) return "Crypto Mining";
  if (["JOBY", "ACHR"].includes(symbol)) return "Industrials";
  if (["IBRX", "XBI"].includes(symbol)) return "Healthcare";
  if (["XOM", "CVX", "SLB"].includes(symbol)) return "Energy";
  if (["JPM", "MS", "GS"].includes(symbol)) return "Financials";
  if (["PFE", "LLY", "JNJ"].includes(symbol)) return "Healthcare";
  if (["CAT", "GE", "DE"].includes(symbol)) return "Industrials";
  if (["WMT", "COST", "HD"].includes(symbol)) return "Consumer";
  return "Unknown";
}

function getTickerProfile(symbol: string): TickerProfile {
  const upper = symbol.toUpperCase();
  return (
    SYMBOL_PROFILES[upper] ?? {
      sector: inferSector(upper),
      speculative: HIGH_BETA_SYMBOLS.has(upper),
      qualityTilt: 0.55 + symbolJitter(upper, 0.12),
      momentumTilt: 0.5 + symbolJitter(upper.split("").reverse().join(""), 0.15),
    }
  );
}

function getTickerClass(symbol: string): TickerClass {
  return TICKER_CLASSES[symbol.toUpperCase()] ?? "LargeGrowth";
}

function normalizeVolatilityInputs(
  symbol: string,
  sector: Sector,
  atrPercent: number,
  volatilityPercent: number
): { normalizedAtr: number; normalizedVolatility: number } {
  const ticker = symbol.toUpperCase();
  const tickerClass = getTickerClass(ticker);

  const classAtrBaseline = tickerClass === "MegaCapTech" ? 4.8 : tickerClass === "Speculative" ? 12.8 : 8.4;
  const classVolBaseline = tickerClass === "MegaCapTech" ? 6.2 : tickerClass === "Speculative" ? 16.5 : 11.4;

  const sectorScale =
    sector === "Megacap Tech" || sector === "Semiconductors"
      ? 0.86
      : sector === "Crypto Mining" || sector === "EV"
      ? 1.14
      : 1;

  // Proxy for ticker-specific volatility history until dedicated history table is wired.
  const tickerHistoryScale =
    ticker === "AMZN"
      ? 0.92
      : ticker === "NVDA"
      ? 1.05
      : ticker === "AMD"
      ? 1.08
      : ticker === "TSLA"
      ? 1.18
      : ticker === "MARA"
      ? 1.26
      : ticker === "RGTI" || ticker === "QBTS"
      ? 1.32
      : 1;

  const baselineAtr = Math.max(2.5, classAtrBaseline * sectorScale * tickerHistoryScale);
  const baselineVol = Math.max(3.5, classVolBaseline * sectorScale * tickerHistoryScale);

  return {
    normalizedAtr: (Math.max(atrPercent, 0) / baselineAtr) * 10,
    normalizedVolatility: (Math.max(volatilityPercent, 0) / baselineVol) * 10,
  };
}

function applyTickerRiskBucket(symbol: string, risk10: number): RiskLabel {
  const bucket = TICKER_RISK_BUCKETS[symbol.toUpperCase()];

  if (!bucket) {
    return risk10 >= 9.2 ? "Extreme" : risk10 >= 7.3 ? "High" : risk10 >= 4.9 ? "Medium" : "Low";
  }

  if (bucket === "Low/Medium") {
    return risk10 >= 6.2 ? "Medium" : "Low";
  }
  if (bucket === "Medium") {
    return "Medium";
  }
  if (bucket === "High") {
    return "High";
  }
  if (bucket === "High/Extreme") {
    return risk10 >= 9.1 ? "Extreme" : "High";
  }
  return "Extreme";
}

function buildTechnicalFactors(item: Item): TechnicalFactors {
  const price = num(item.price);
  const support = num(item.support, price * 0.95);
  const resistance = Math.max(num(item.resistance, price * 1.05), support + 0.01);
  const width = Math.max(resistance - support, Math.max(price * 0.02, 0.25));

  const trendBias =
    (num(item.rsi, 50) - 50) / 50 +
    (num(item.volumeRatio, 1) - 1) * 0.35 +
    (item.bias === "Bullish" ? 0.2 : item.bias === "Bearish" ? -0.2 : 0);

  const lr50 = num(item.lr50, price * (0.985 + trendBias * 0.025));
  const lr100 = num(item.lr100, price * (0.965 + trendBias * 0.03));
  const lr50Slope = num(item.lr50Slope, trendBias * 4);
  const lr100Slope = num(item.lr100Slope, trendBias * 2.4);

  const fibLow = support;
  const fibHigh = resistance;
  const fibRange = Math.max(fibHigh - fibLow, 0.01);
  const fib50 = fibHigh - fibRange * 0.5;

  const fibLevelRaw = num(item.fibSupport, fib50);
  const fibLevel = Math.max(fibLow, Math.min(fibHigh, fibLevelRaw));

  const atrPercent = num(item.atrPercent, (width / Math.max(price, 0.01)) * 65);
  const volatilityPercent = num(
    item.priceVolatility,
    (width / Math.max(price, 0.01)) * 100
  );

  const trendAligned = lr50 > lr100 && lr50Slope > -0.1 && lr100Slope > -0.2;

  return {
    lr50,
    lr100,
    lr50Slope,
    lr100Slope,
    fibLevel,
    atrPercent,
    volatilityPercent,
    trendAligned,
  };
}

function getSymbolModelBias(symbol: string): SymbolModelBias {
  return (
    SYMBOL_MODEL_BIAS[symbol.toUpperCase()] ?? {
      sectorLeadership: 6.5,
      catalystClarity: 6.2,
      supportDiscipline: 6.1,
      trendBonus: 0,
      momentumBias: 0,
      macroDurability: 0,
      fundamentalDurability: 0,
    }
  );
}

function computePillars(item: Item): { pillars: PillarScores; technicals: TechnicalFactors; profile: TickerProfile } {
  const t = buildTechnicalFactors(item);
  const price = num(item.price);
  const profile = getTickerProfile(item.symbol);
  const sectorAdj = SECTOR_ADJUSTMENTS[profile.sector];

  const lr50Distance = (price - t.lr50) / Math.max(price, 0.01);
  const lr100Distance = (price - t.lr100) / Math.max(price, 0.01);
  const fibDistance = Math.abs(price - t.fibLevel) / Math.max(price, 0.01);

  const lr50ValueScore = clamp10(5.8 + lr50Distance * 58);
  const lr100ValueScore = clamp10(5.8 + lr100Distance * 58);
  const slopeScore = clamp10(5 + t.lr50Slope * 0.65 + t.lr100Slope * 0.45);
  const priceVsLrScore = clamp10(5 + (lr50Distance + lr100Distance) * 35);
  const alignmentScore = t.trendAligned ? 8.6 : 4.6;
  const fibScore = clamp10(8.3 - fibDistance * 124);
  const rsiScore = clamp10(10 - Math.abs(num(item.rsi, 50) - 58) / 6.5);
  const volumeScore = clamp10(4.5 + num(item.volumeRatio, 1) * 2.3);
  const atrScore = clamp10(10 - t.atrPercent / 1.7);

  const technicalRaw = clamp10(
    lr50ValueScore * 0.13 +
      lr100ValueScore * 0.12 +
      slopeScore * 0.16 +
      priceVsLrScore * 0.15 +
      alignmentScore * 0.14 +
      fibScore * 0.11 +
      rsiScore * 0.08 +
      volumeScore * 0.06 +
      atrScore * 0.05 +
      sectorAdj.technical +
      profile.momentumTilt * 0.12
  );

  const momentumEdge =
    (t.trendAligned ? 0.42 : -0.24) +
    (slopeScore - 6.4) * 0.24 +
    (volumeScore - 5.8) * 0.1 +
    (rsiScore - 6.1) * 0.08;

  let technical = clamp10(
    6.8 +
      (technicalRaw - 6.8) * 1.62 +
      momentumEdge +
      (profile.momentumTilt - 0.5) * 0.28
  );

  const weakTechnicalSetup =
    !t.trendAligned || slopeScore < 5.8 || num(item.rsi, 50) < 46 || item.bias === "Bearish";
  if (weakTechnicalSetup) {
    technical = Math.max(5.5, Math.min(6.2, technical));
  }

  const eliteMomentumSetup =
    t.trendAligned &&
    slopeScore >= 7.1 &&
    num(item.rsi, 50) >= 57 &&
    num(item.volumeRatio, 1) >= 1.15 &&
    item.bias !== "Bearish";
  if (eliteMomentumSetup) {
    technical = Math.max(8.5, technical);
  }

  const qualityCore =
    scaleTo10(num(item.macroScore, 56 + symbolJitter(item.symbol, 3))) * 0.42 +
    scaleTo10(num(item.politicalScore, 55 + symbolJitter(item.symbol, 2.7))) * 0.24 +
    scaleTo10(num(item.technicalScore, 58 + symbolJitter(item.symbol, 3.2))) * 0.16;

  const stabilityPenalty = clamp10(t.volatilityPercent / 2.25) * 0.22;
  const profitabilityBias =
    profile.sector === "Semiconductors" || profile.sector === "Megacap Tech"
      ? 0.45
      : profile.sector === "EV" || profile.sector === "Crypto Mining"
      ? -0.35
      : 0.1;

  const fundamental = clamp10(
    qualityCore +
      profile.qualityTilt * 1.2 -
      stabilityPenalty -
      (profile.speculative ? 0.55 : 0) +
      profitabilityBias +
      sectorAdj.fundamental
  );

  const intelligence = clamp10(
    scaleTo10(num(item.whaleScore, 60 + symbolJitter(item.symbol, 4))) * 0.48 +
      volumeScore * 0.2 +
      rsiScore * 0.11 +
      (item.bias === "Bullish" ? 8.3 : item.bias === "Bearish" ? 3.8 : 5.8) * 0.15 +
      profile.momentumTilt * 0.35
  );

  const environment = clamp10(
    scaleTo10(num(item.politicalScore, 55 + symbolJitter(item.symbol, 2.5))) * 0.31 +
      scaleTo10(num(item.macroScore, 57 + symbolJitter(item.symbol, 2.9))) * 0.34 +
      clamp10(10 - t.atrPercent / 2.1) * 0.22 +
      (item.bias === "Bearish" ? 4.2 : 6.7) * 0.08 +
      sectorAdj.environment -
      (profile.speculative ? 0.35 : 0)
  );

  return {
    pillars: {
      technical,
      fundamental,
      intelligence,
      environment,
    },
    technicals: t,
    profile,
  };
}

export function computeRisk(
  item: Item,
  technicals: TechnicalFactors
): { riskScore: number; riskLabel: RiskLabel } {
  const profile = getTickerProfile(item.symbol);
  const tickerClass = getTickerClass(item.symbol);
  const baseBeta = HIGH_BETA_SYMBOLS.has(item.symbol.toUpperCase()) ? 2.1 : 1.1;

  const betaProxy = num(
    item.betaProxy,
    baseBeta + Math.max(0, num(item.volumeRatio, 1) - 1) * 0.35
  );

  const volatilityPercent = Math.max(technicals.volatilityPercent, 0);
  const atrPercent = Math.max(technicals.atrPercent, 0);
  const { normalizedAtr, normalizedVolatility } = normalizeVolatilityInputs(
    item.symbol,
    profile.sector,
    atrPercent,
    volatilityPercent
  );
  const gapFrequency = clamp10(
    normalizedVolatility * 0.22 +
      Math.max(0, num(item.volumeRatio, 1) - 1) * 2.2 +
      (item.bias === "Bearish" ? 0.85 : 0.22) +
      (profile.speculative ? 0.45 : 0)
  );
  const momentumScore = num(item.momentum, 50);
  const bearishMomentumPenalty =
    momentumScore <= 35 ? 0.95 : momentumScore <= 42 ? 0.55 : momentumScore <= 48 ? 0.2 : 0;
  const extremeVolatilityGate = normalizedVolatility >= 8.8 && momentumScore <= 42;

  const risk10 = clamp10(
    normalizedAtr * 0.23 +
      normalizedVolatility * 0.25 +
      gapFrequency * 1.95 +
      betaProxy * 1.7 +
      bearishMomentumPenalty +
      (profile.speculative ? 0.5 : 0) +
      (tickerClass === "MegaCapTech" ? -0.38 : tickerClass === "Speculative" ? 0.42 : 0)
  );

  const riskScore = Math.round(risk10 * 10);
  const rawRiskLabel: RiskLabel = applyTickerRiskBucket(item.symbol, risk10);
  const riskLabel: RiskLabel =
    rawRiskLabel === "Extreme" && !extremeVolatilityGate ? "High" : rawRiskLabel;

  return { riskScore, riskLabel };
}

function toSentiment(bias: Item["bias"]): "Bullish" | "Neutral" | "Bearish" {
  if (bias === "Bullish") return "Bullish";
  if (bias === "Bearish") return "Bearish";
  return "Neutral";
}

export function getMarketRegime(
  pillars: PillarScores
): MarketRegime {
  const score =
    pillars.environment * 0.4 +
    pillars.fundamental * 0.35 +
    pillars.technical * 0.25;

  if (score >= 7.5) return "Risk-On";
  if (score >= 5.8) return "Balanced";
  return "Risk-Off";
}

export function computeTradePlan(
  item: Item,
  swing: number,
  riskLabel: RiskLabel,
  swingStrategy: Strategy
): TradePlan {
  const price = num(item.price);
  const support = num(item.support);
  const resistance = num(item.resistance);

  if (price <= 0) {
    return {
      entryZone: "--",
      stopLoss: "--",
      target1: "--",
      target2: "--",
      positionSizing: "Wait for live price",
      callPlan: "Calls: wait for live quote",
      putPlan: "Puts: N/A",
    };
  }

  const fallbackSupport = price * 0.96;
  const fallbackResistance = price * 1.06;

  const s = support > 0 ? support : fallbackSupport;
  const r = resistance > s ? resistance : fallbackResistance;

  const width = Math.max(r - s, Math.max(price * 0.03, 0.5));
  const pullbackEntry = Math.max(s + width * 0.2, 0);
  const breakoutEntry = r + width * 0.08;
  const stop = Math.max(s - width * 0.18, price * 0.82);
  const target1 = r + width * 0.4;
  const target2 = r + width * 0.85;

  let positionSizing = "SETUP 3%-5%";
  if (riskLabel === "Extreme") positionSizing = "Extreme 1%-2%";
  else if (swing >= 8 && (riskLabel === "Low" || riskLabel === "Medium")) positionSizing = "READY 5%-8%";
  else if (swing >= 6.5) positionSizing = "SETUP 3%-5%";

  const callPlan =
    swingStrategy === "Buy Shares + Calls" || swingStrategy === "Buy Calls"
      ? "Calls: 30-45 DTE ATM / slight ITM"
      : "Calls: only if trend + vol align";

  return {
    entryZone: `${formatPrice(pullbackEntry)} - ${formatPrice(Math.min(breakoutEntry, r))}`,
    stopLoss: formatPrice(stop),
    target1: formatPrice(target1),
    target2: formatPrice(target2),
    positionSizing,
    callPlan,
    putPlan: "Puts: N/A",
  };
}

function buildWhy(
  item: Item,
  pillars: PillarScores,
  technicals: TechnicalFactors,
  riskLabel: RiskLabel,
  profile: TickerProfile
): string[] {
  const price = num(item.price);
  const lr50DistancePct = ((price - technicals.lr50) / Math.max(price, 0.01)) * 100;
  const trendText =
    price >= technicals.lr50 && price >= technicals.lr100
      ? "price is holding above LR50/LR100 trend support"
      : lr50DistancePct < -1.2
      ? "price is still below LR50 and needs confirmation"
      : "trend structure is mixed";
  const riskText =
    riskLabel === "High" || riskLabel === "Extreme"
      ? "volatility is elevated so sizing must stay tactical"
      : "risk is still controllable for staged entries";
  const flowText =
    num(item.volumeRatio, 1) >= 1.4
      ? "flow is confirmed by above-average relative volume"
      : "flow is adequate but not yet in clear expansion";

  const symbolSpecificRationale: Record<string, string> = {
    AMD: `AMD screens actionable because ${trendText}, 3-6 month scores are aligned, and ${riskText}.`,
    MRVL: `MRVL reflects semiconductor infrastructure exposure where ${trendText} and ${flowText}.`,
    MARA: `MARA remains a BTC-beta trade where ${flowText}, but ${riskText}.`,
    WULF: `WULF trades as miner infrastructure leverage, so ${flowText} while ${riskText}.`,
    JOBY: `JOBY is an eVTOL speculation with event-driven upside; ${trendText} and ${riskText}.`,
    IBRX: `IBRX is a binary biotech setup where catalyst timing dominates, so ${trendText} and ${riskText}.`,
    QUBT: `QUBT is a quantum-theme momentum vehicle where ${flowText}, but ${riskText}.`,
    NVDA: `NVDA keeps premium leadership because ${trendText}, institutional demand is persistent, and ${riskText}.`,
  };

  const defaultRationale = `${item.symbol} setup reflects ${profile.sector.toLowerCase()} context where ${trendText}, ${flowText}, and ${riskText}.`;
  return [symbolSpecificRationale[item.symbol] ?? defaultRationale];
}

function buildEngineInput(params: {
  swingScore: number;
  threeMonthScore: number;
  sixMonthScore: number;
  oneYearScore: number;
  pillars: PillarScores;
  item: Item;
  riskLabel: RiskLabel;
  technicals: TechnicalFactors;
  momentum: number;
}): RecommendationEngineInput {
  const { swingScore, threeMonthScore, sixMonthScore, oneYearScore, pillars, item, riskLabel, technicals, momentum } =
    params;
  const profile = getTickerProfile(item.symbol);
  const volatilityComposite = clamp10((technicals.atrPercent * 0.45 + technicals.volatilityPercent * 0.55) / 1.8);
  const whalesIntel = clamp10((pillars.intelligence * 0.68 + scaleTo10(num(item.whaleScore, 60)) * 0.32));
  const price = Math.max(0.01, num(item.price));
  const support = num(item.support, price * 0.95);
  const resistance = Math.max(support + 0.01, num(item.resistance, price * 1.05));
  const distancePct = ((resistance - price) / price) * 100;
  const distanceFromResistance = clamp10(9.2 - Math.max(0, distancePct - 1.2) * 0.95);
  const trendConsistency = clamp10(
    5.2 +
      (technicals.trendAligned ? 2 : -0.9) +
      Math.min(2.2, Math.max(-2.2, technicals.lr50Slope * 0.18 + technicals.lr100Slope * 0.12))
  );
  const volumeConfirmation = clamp10(4.7 + Math.min(2.7, Math.max(-1.1, (num(item.volumeRatio, 1) - 1) * 3.4)));
  const volatilityStability = clamp10(10 - (technicals.atrPercent * 0.36 + technicals.volatilityPercent * 0.26));
  const horizonSpread =
    Math.max(swingScore, threeMonthScore, sixMonthScore, oneYearScore) -
    Math.min(swingScore, threeMonthScore, sixMonthScore, oneYearScore);
  const multiTimeframeAgreement = clamp10(9.6 - horizonSpread * 1.2);
  const sectorStrength = clamp10(SECTOR_STRENGTH_BASE[profile.sector] + symbolJitter(item.symbol, 0.35));
  const newsClarity = clamp10(scaleTo10(num(item.whaleScore, 60)) * 0.5 + scaleTo10(pillars.intelligence) * 0.5);

  return {
    swingScore,
    threeMonthScore,
    sixMonthScore,
    oneYearScore,
    technicalScore: pillars.technical,
    fundamentalScore: pillars.fundamental,
    sentiment: toSentiment(item.bias),
    whalesIntel,
    momentum,
    volatility: volatilityComposite,
    riskLevel: riskLabel,
    trendConsistency,
    volumeConfirmation,
    distanceFromResistance,
    volatilityStability,
    multiTimeframeAgreement,
    sectorStrength,
    newsClarity,
  };
}

function deriveDynamicHorizonScores(params: {
  pillars: PillarScores;
  momentum: number;
  sector: Sector;
  sentiment: "Bullish" | "Neutral" | "Bearish";
  symbol: string;
  technicals: TechnicalFactors;
  item: Item;
}): { swing: number; threeMonth: number; sixMonth: number; oneYear: number } {
  const { pillars, momentum, sector, sentiment, symbol, technicals, item } = params;
  const sectorAdj = SECTOR_ADJUSTMENTS[sector];
  const sectorScore = clamp10(5 + sectorAdj.fundamental * 1.8 + sectorAdj.technical * 1.2 + sectorAdj.environment * 1.4);
  const sentimentScore = sentiment === "Bullish" ? 8.2 : sentiment === "Bearish" ? 3.8 : 5.8;
  const symbolBias = getSymbolModelBias(symbol);
  const catalystEvidence = clamp10(
    sentimentScore * 0.42 + scaleTo10(num(item.whaleScore, 56)) * 0.34 + (num(item.notes?.length, 0) > 0 ? 7 : 5.1) * 0.24
  );
  const regime = clamp10(pillars.environment * 0.55 + sectorScore * 0.25 + (technicals.trendAligned ? 7.1 : 4.9) * 0.2);

  return {
    swing: clamp10(
      pillars.technical * 0.42 +
        momentum * 0.29 +
        pillars.intelligence * 0.16 +
        sentimentScore * 0.08 +
        sectorScore * 0.05 +
        symbolBias.trendBonus +
        symbolBias.momentumBias
    ),
    threeMonth: clamp10(
      pillars.technical * 0.24 +
        momentum * 0.2 +
        catalystEvidence * 0.25 +
        pillars.intelligence * 0.16 +
        pillars.fundamental * 0.08 +
        pillars.environment * 0.07 +
        symbolBias.trendBonus * 0.6 +
        symbolBias.momentumBias * 0.4
    ),
    sixMonth: clamp10(
      regime * 0.34 +
        pillars.fundamental * 0.26 +
        catalystEvidence * 0.12 +
        pillars.intelligence * 0.1 +
        momentum * 0.08 +
        sectorScore * 0.1 +
        symbolBias.macroDurability
    ),
    oneYear: clamp10(
      pillars.fundamental * 0.46 +
        regime * 0.24 +
        sectorScore * 0.15 +
        catalystEvidence * 0.08 +
        sentimentScore * 0.03 +
        symbolBias.fundamentalDurability
    ),
  };
}

function deriveConfidenceFromSignal(params: {
  item: Item;
  pillars: PillarScores;
  technicals: TechnicalFactors;
  horizons: { swing: number; threeMonth: number; sixMonth: number; oneYear: number };
  riskLabel: RiskLabel;
  profile: TickerProfile;
}): { confidencePercent: number; confidenceLabel: "Low" | "Medium" | "High" } {
  const { item, pillars, technicals, horizons, riskLabel, profile } = params;
  const symbolBias = getSymbolModelBias(item.symbol);
  const price = num(item.price);
  const support = num(item.support, Math.max(0.01, price * 0.95));
  const distanceFromSupport = Math.max(0, ((price - support) / Math.max(price, 0.01)) * 100);
  const supportScore = clamp10(9.3 - Math.abs(distanceFromSupport - symbolBias.supportDiscipline) * 0.7);
  const trendQuality = clamp10((pillars.technical + (technicals.trendAligned ? 8.5 : 4.8)) / 2);
  const volumeSupport = clamp10(4.8 + num(item.volumeRatio, 1) * 2.25);
  const volatilityStability = clamp10(10 - (technicals.atrPercent * 0.42 + technicals.volatilityPercent * 0.34));
  const sectorLeadership = clamp10(symbolBias.sectorLeadership);
  const catalystClarity = clamp10(symbolBias.catalystClarity * 0.55 + scaleTo10(num(item.whaleScore, 60)) * 0.45);
  const horizonSpread = Math.max(horizons.swing, horizons.threeMonth, horizons.sixMonth, horizons.oneYear) - Math.min(horizons.swing, horizons.threeMonth, horizons.sixMonth, horizons.oneYear);
  const agreementAcrossHorizons = clamp10(9.8 - horizonSpread * 1.35);
  const riskPenalty = riskLabel === "Extreme" ? 1.15 : riskLabel === "High" ? 0.6 : riskLabel === "Medium" ? 0.2 : 0;

  const confidence10 = clamp10(
    trendQuality * 0.2 +
      volumeSupport * 0.11 +
      volatilityStability * 0.16 +
      supportScore * 0.11 +
      sectorLeadership * 0.14 +
      catalystClarity * 0.12 +
      agreementAcrossHorizons * 0.16 -
      riskPenalty +
      (profile.speculative ? -0.2 : 0)
  );
  const confidencePercent = Math.round(confidence10 * 10);
  const confidenceLabel: "Low" | "Medium" | "High" =
    confidencePercent >= 78 ? "High" : confidencePercent >= 62 ? "Medium" : "Low";

  return { confidencePercent, confidenceLabel };
}

function buildExecutionNotes(strategy: Strategy): { callPlan: string; putPlan: string } {
  if (strategy === "Buy Shares + Calls") {
    return { callPlan: "Buy Calls", putPlan: "Hedge Only" };
  }
  if (strategy === "Starter Shares + Calls on Breakout") {
    return { callPlan: "Watch", putPlan: "Hedge Only" };
  }
  if (strategy === "Buy Calls") {
    return { callPlan: "Buy Calls", putPlan: "Avoid" };
  }
  if (strategy === "Buy Puts") {
    return { callPlan: "Avoid", putPlan: "Buy Puts" };
  }
  if (strategy === "Hedge Only") {
    return { callPlan: "Avoid", putPlan: "Hedge Only" };
  }
  if (strategy === "Buy Shares" || strategy === "Starter Shares") {
    return { callPlan: "Watch", putPlan: "Hedge Only" };
  }
  if (strategy === "Spec Buy") {
    return { callPlan: "Watch", putPlan: "Hedge Only" };
  }
  if (strategy === "Avoid") {
    return { callPlan: "Avoid", putPlan: "Avoid" };
  }
  return { callPlan: "Watch", putPlan: "Watch" };
}

export function computeMetrics(item: Item): RowMetrics {
  const { pillars, technicals, profile } = computePillars(item);
  const { riskScore, riskLabel } = computeRisk(item, technicals);

  const momentum = clamp10(
    (pillars.technical * 0.5 +
      pillars.intelligence * 0.35 +
      (technicals.trendAligned ? 8.2 : 4.2) * 0.15)
  );
  const sentiment = toSentiment(item.bias);
  const derivedHorizons = deriveDynamicHorizonScores({
    pillars,
    momentum,
    sector: profile.sector,
    sentiment,
    symbol: item.symbol,
    technicals,
    item,
  });

  const swingExpanded = item.swingScore == null ? derivedHorizons.swing : scaleTo10(item.swingScore);
  const threeMonthExpanded = item.threeMonthScore == null ? derivedHorizons.threeMonth : scaleTo10(item.threeMonthScore);
  const sixMonthExpanded = item.sixMonthScore == null ? derivedHorizons.sixMonth : scaleTo10(item.sixMonthScore);
  const oneYearExpanded = item.oneYearScore == null ? derivedHorizons.oneYear : scaleTo10(item.oneYearScore);

  const baseInput = buildEngineInput({
    swingScore: swingExpanded,
    threeMonthScore: threeMonthExpanded,
    sixMonthScore: sixMonthExpanded,
    oneYearScore: oneYearExpanded,
    pillars,
    item,
    riskLabel,
    technicals,
    momentum,
  });

  const finalDecision = evaluateRecommendation(baseInput);
  const swingDecision = evaluateRecommendation({ ...baseInput, swingScore: swingExpanded });
  const threeMonthDecision = evaluateRecommendation({
    ...baseInput,
    swingScore: threeMonthExpanded,
    threeMonthScore: threeMonthExpanded,
  });
  const sixMonthDecision = evaluateRecommendation({
    ...baseInput,
    swingScore: sixMonthExpanded,
    sixMonthScore: sixMonthExpanded,
  });
  const oneYearDecision = evaluateRecommendation({
    ...baseInput,
    swingScore: oneYearExpanded,
    oneYearScore: oneYearExpanded,
  });

  const swingSignal = swingDecision.rating;
  const threeMonthSignal = threeMonthDecision.rating;
  const sixMonthSignal = sixMonthDecision.rating;
  const oneYearSignal = oneYearDecision.rating;

  const swingStrategy = swingDecision.strategy;
  const threeMonthStrategy = threeMonthDecision.strategy;
  const sixMonthStrategy = sixMonthDecision.strategy;
  const oneYearStrategy = oneYearDecision.strategy;

  const { confidencePercent, confidenceLabel } = deriveConfidenceFromSignal({
    item,
    pillars,
    technicals,
    horizons: {
      swing: swingExpanded,
      threeMonth: threeMonthExpanded,
      sixMonth: sixMonthExpanded,
      oneYear: oneYearExpanded,
    },
    riskLabel,
    profile,
  });
  const confidence = confidenceToScore(confidenceLabel);

  const whaleV2 = Math.round(
    clamp(
      (pillars.technical * 0.32 +
        pillars.fundamental * 0.18 +
        pillars.intelligence * 0.3 +
        pillars.environment * 0.2) *
        10
    )
  );

  const opportunityScore = Math.round(
    clamp(
      (swingExpanded * 0.38 +
        threeMonthExpanded * 0.24 +
        sixMonthExpanded * 0.2 +
        oneYearExpanded * 0.18) *
        10 -
        riskScore * 0.24 +
        confidence * 2.4
    )
  );

  const contradictionFlags: string[] = [];
  if (item.bias === "Bullish" && swingSignal === "Avoid") {
    contradictionFlags.push("Bullish bias vs bearish swing signal");
  }
  if (item.bias === "Bearish" && (swingSignal === "Strong Buy" || swingSignal === "Buy")) {
    contradictionFlags.push("Bearish bias vs bullish swing signal");
  }
  const bearishHorizons = [swingSignal, threeMonthSignal, sixMonthSignal, oneYearSignal].filter((signal) =>
    signal.includes("Sell")
  ).length;
  const bullishHorizons = [swingSignal, threeMonthSignal, sixMonthSignal, oneYearSignal].filter((signal) =>
    signal.includes("Buy")
  ).length;
  if (bearishHorizons > 0 && bullishHorizons > 0) {
    contradictionFlags.push("Mixed horizon signals");
  }

  const finalScore = Math.round(
    clamp(
      (swingExpanded * 0.35 +
        threeMonthExpanded * 0.25 +
        sixMonthExpanded * 0.2 +
        oneYearExpanded * 0.2) *
        10 +
        (confidencePercent - 60) * 0.25 -
        Math.max(0, riskScore - 55) * 0.12 -
        contradictionFlags.length * 8
    )
  );

  const tradePlan = computeTradePlan(item, swingExpanded, riskLabel, swingStrategy);
  const executionPlan = routeExecutionStrategy({
    symbol: item.symbol,
    price: num(item.price),
    sector: profile.sector,
    selectedHorizonScores: {
      swing: swingExpanded,
      threeMonth: threeMonthExpanded,
      sixMonth: sixMonthExpanded,
      oneYear: oneYearExpanded,
    },
    technicalScore: pillars.technical,
    fundamentalScore: pillars.fundamental,
    sentimentScore: pillars.intelligence,
    environmentScore: pillars.environment,
    momentum,
    volatilityRisk: riskScore / 10,
    confidence: finalDecision.confidence,
    support: num(item.support),
    resistance: num(item.resistance),
    entryZone: tradePlan.entryZone,
    stopLoss: tradePlan.stopLoss,
    targetPrices: [tradePlan.target1, tradePlan.target2],
    catalystContext: item.notes?.join(" | ") ?? undefined,
    hasVolumeConfirmation: num(item.volumeRatio, 1) >= 1.1,
    belowVWAP: num(item.price) < num(item.lr50, num(item.price)),
    eventRiskHigh: false,
  });
  const qualityDominant = pillars.fundamental >= 7.2 && riskLabel !== "Extreme";
  const momentumDominant = momentum >= 7.2 && technicals.trendAligned && num(item.volumeRatio, 1) >= 1.1;
  const weakSetup = finalScore < 65 || swingSignal === "Avoid" || contradictionFlags.length > 0;

  let filteredStrategy: Strategy;
  if (riskLabel === "Extreme" && swingExpanded >= 6.8 && confidencePercent >= 58) filteredStrategy = "Spec Buy";
  else if (riskLabel === "Extreme") filteredStrategy = "Avoid";
  else if (weakSetup && finalScore >= 57) filteredStrategy = "Watch";
  else if (weakSetup) filteredStrategy = "Avoid";
  else if (momentumDominant && confidencePercent >= 74 && riskLabel !== "High") filteredStrategy = "Buy Shares + Calls";
  else if (momentumDominant && swingExpanded >= 7.2) filteredStrategy = "Buy Calls";
  else if (qualityDominant && oneYearExpanded >= 7.3 && confidencePercent >= 72) filteredStrategy = "Buy Shares";
  else if (qualityDominant && finalScore >= 68) filteredStrategy = "Starter Shares";
  else if (finalScore >= 64 && riskLabel === "High") filteredStrategy = "Starter Shares";
  else filteredStrategy = "Watch";

  const amdActionableFloorMet =
    item.symbol === "AMD" &&
    swingExpanded >= 8.8 &&
    threeMonthExpanded >= 7.8 &&
    sixMonthExpanded >= 7.8 &&
    confidencePercent >= 70 &&
    (riskLabel === "Low" || riskLabel === "Medium");
  if (amdActionableFloorMet && filteredStrategy === "Watch") {
    filteredStrategy = momentumDominant ? "Buy Shares + Calls" : "Buy Shares";
  }

  const executionNotes = buildExecutionNotes(filteredStrategy);

  const hotSetup =
    num(item.price) > 0 &&
    swingExpanded >= 7.7 &&
    finalDecision.confidence !== "Low" &&
    (riskLabel === "Low" || riskLabel === "Medium");

  const why = buildWhy(item, pillars, technicals, riskLabel, profile);
  const marketRegime = getMarketRegime(pillars);

  const strategyReason =
    item.symbol === "NVDA"
      ? "NVDA: AI leadership and institutional demand keep multi-horizon conviction stronger than peers."
      : item.symbol === "AMD"
      ? "AMD: momentum is constructive but trails NVDA leadership, so entries should stay disciplined."
      : item.symbol === "AMZN"
      ? "AMZN: steadier mega-cap trend and durable fundamentals support patient accumulation over chasing breakouts."
      : item.symbol === "MARA"
      ? "MARA: high-beta BTC linkage can move fast, so tactical size and tighter risk controls matter most."
      : item.symbol === "NEM"
      ? "NEM: defensive gold exposure offers macro-hedge value, but upside conviction depends on real rates and dollar pressure."
      : item.symbol === "PLTR"
      ? "PLTR: spec-growth momentum is strong, yet headline sensitivity keeps sizing and entries disciplined."
      : item.symbol === "TSLA"
      ? "TSLA: trend remains tradable but volatility regime is elevated, favoring staged entries over full-size deployment."
      : filteredStrategy === "Buy Shares + Calls"
      ? `${item.symbol}: momentum and participation are both strong, supporting blended shares and calls exposure.`
      : filteredStrategy === "Buy Calls"
      ? `${item.symbol}: bullish momentum setup with confirmed trend and volume support.`
      : filteredStrategy === "Buy Shares"
      ? `${item.symbol}: quality-tilted profile with steadier multi-month score profile.`
      : filteredStrategy === "Starter Shares"
      ? `${item.symbol}: constructive setup, but risk/clarity favors a starter position first.`
      : filteredStrategy === "Spec Buy"
      ? `${item.symbol}: high-beta opportunity can work tactically, but size must remain small.`
      : filteredStrategy === "Watch"
      ? `${item.symbol}: mixed setup, monitor for cleaner alignment before deploying capital.`
      : `${item.symbol}: weak or conflicting setup; risk/reward is not favorable right now.`;

  const notes: string[] = [finalDecision.reason, ...why];
  if (hotSetup) notes.push("Multi-horizon alignment");
  if (riskLabel === "Extreme") notes.push("Extreme risk profile");
  if (num(item.price) <= 0) notes.push("Missing live quote, refresh all");
  return {
    whaleV2,
    technical: pillars.technical,
    fundamental: pillars.fundamental,
    intelligence: pillars.intelligence,
    environment: pillars.environment,
    riskScore,
    riskLabel,
    swing: swingExpanded,
    threeMonth: threeMonthExpanded,
    sixMonth: sixMonthExpanded,
    oneYear: oneYearExpanded,
    confidence,
    confidencePercent,
    finalScore,
    contradictionFlags,
    recommendation: finalDecision.rating,
    strategy: filteredStrategy,
    reason: strategyReason,
    why,
    swingSignal,
    threeMonthSignal,
    sixMonthSignal,
    oneYearSignal,
    swingStrategy,
    threeMonthStrategy,
    sixMonthStrategy,
    oneYearStrategy,
    confidenceLabel,
    marketRegime,
    opportunityScore,
    entryZone: tradePlan.entryZone,
    stopLoss: tradePlan.stopLoss,
    target1: tradePlan.target1,
    target2: tradePlan.target2,
    positionSizing: tradePlan.positionSizing,
    callPlan: executionNotes.callPlan,
    putPlan: executionNotes.putPlan,
    notes: [...notes, ...executionPlan.sequencing],
    momentumToday: Math.round(clamp((pillars.technical * 0.6 + pillars.intelligence * 0.4) * 10)),
    hotSetup,
  };
}
