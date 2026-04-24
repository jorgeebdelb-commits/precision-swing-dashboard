import type {
  HorizonKey,
  Item,
  MarketRegime,
  Strategy,
} from "../types/dashboard";

import { clamp, formatPrice, num } from "../app/lib/helpers";

export type RiskLabel = "Unknown" | "Low" | "Medium" | "High" | "Extreme";

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
  why: string[];
  swingSignal: string;
  threeMonthSignal: string;
  sixMonthSignal: string;
  oneYearSignal: string;
  swingStrategy: Strategy;
  threeMonthStrategy: Strategy;
  sixMonthStrategy: Strategy;
  oneYearStrategy: Strategy;
  bestStrategy: Strategy;
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
  redFlag: boolean;
  hotSetup: boolean;
};

const HIGH_BETA_SYMBOLS = new Set(["TSLA", "MARA", "RIVN", "IREN", "RGTI", "COIN"]);

const SYMBOL_PROFILES: Record<string, TickerProfile> = {
  NVDA: { sector: "Semiconductors", speculative: false, qualityTilt: 0.9, momentumTilt: 0.8 },
  AMD: { sector: "Semiconductors", speculative: false, qualityTilt: 0.75, momentumTilt: 0.7 },
  MRVL: { sector: "Semiconductors", speculative: false, qualityTilt: 0.5, momentumTilt: 0.55 },
  AMZN: { sector: "Megacap Tech", speculative: false, qualityTilt: 0.8, momentumTilt: 0.45 },
  TSLA: { sector: "EV", speculative: true, qualityTilt: 0.35, momentumTilt: 0.95 },
  RIVN: { sector: "EV", speculative: true, qualityTilt: 0.2, momentumTilt: 0.9 },
  MARA: { sector: "Crypto Mining", speculative: true, qualityTilt: 0.1, momentumTilt: 1 },
  ACHR: { sector: "Industrials", speculative: true, qualityTilt: 0.18, momentumTilt: 0.92 },
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

const clamp10 = (value: number): number =>
  Math.max(1, Math.min(10, Math.round(value * 10) / 10));

const scaleTo10 = (value: number): number => clamp10(clamp(value) / 10);

const scoreLabel = (score: number): string => {
  if (score >= 8.8) return "Strong Buy";
  if (score >= 7.1) return "Buy";
  if (score >= 5.5) return "Watch";
  return "Avoid";
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

  const technical = clamp10(
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
  const price = Math.max(num(item.price), 0.01);
  const profile = getTickerProfile(item.symbol);
  const baseBeta = HIGH_BETA_SYMBOLS.has(item.symbol.toUpperCase()) ? 2.1 : 1.1;

  const betaProxy = num(
    item.betaProxy,
    baseBeta + Math.max(0, num(item.volumeRatio, 1) - 1) * 0.35
  );

  const volatilityPercent = Math.max(technicals.volatilityPercent, 0);
  const atrPercent = Math.max(technicals.atrPercent, 0);

  const seed = symbolSeed(item.symbol);
  const earningsDays = num(item.earningsDays, (seed % 36) + 5);
  const earningsRisk = earningsDays <= 5 ? 9.5 : earningsDays <= 10 ? 7.3 : 4.1;

  const ivPercentile = num(
    item.ivPercentile,
    Math.min(100, 35 + volatilityPercent * 6 + Math.max(0, betaProxy - 1) * 12)
  );

  const rangeMid = (num(item.support, price * 0.96) + num(item.resistance, price * 1.05)) / 2;
  const gapProxyPct = Math.abs(price - rangeMid) / Math.max(price, 0.01);
  const gapRisk = clamp10(
    gapProxyPct * 60 +
      Math.max(0, num(item.volumeRatio, 1) - 1.15) * 2.4 +
      (item.bias === "Bearish" ? 0.8 : 0)
  );

  const risk10 = clamp10(
    atrPercent * 0.15 +
      volatilityPercent * 0.25 +
      betaProxy * 1.5 +
      gapRisk * 0.95 +
      earningsRisk * 0.9 +
      ivPercentile * 0.027 +
      (price < 5 ? 0.7 : 0) +
      (profile.speculative ? 0.55 : 0)
  );

  const riskScore = Math.round(risk10 * 10);
  const riskLabel: RiskLabel =
    risk10 >= 8.8
      ? "Extreme"
      : risk10 >= 7.1
      ? "High"
      : risk10 >= 4.8
      ? "Medium"
      : "Low";

  return { riskScore, riskLabel };
}

function weightedHorizonScore(horizon: HorizonKey, pillars: PillarScores, profile: TickerProfile): number {
  if (horizon === "swing") {
    return clamp10(
      pillars.technical * 0.5 +
        pillars.intelligence * 0.26 +
        pillars.environment * 0.14 +
        pillars.fundamental * 0.1 +
        profile.momentumTilt * 0.18
    );
  }

  if (horizon === "threeMonth") {
    return clamp10(
      pillars.technical * 0.3 +
        pillars.fundamental * 0.31 +
        pillars.intelligence * 0.24 +
        pillars.environment * 0.15
    );
  }

  if (horizon === "sixMonth") {
    return clamp10(
      pillars.fundamental * 0.42 +
        pillars.technical * 0.23 +
        pillars.environment * 0.22 +
        pillars.intelligence * 0.13 +
        profile.qualityTilt * 0.12
    );
  }

  return clamp10(
    pillars.fundamental * 0.47 +
      pillars.environment * 0.26 +
      pillars.technical * 0.18 +
      pillars.intelligence * 0.09 +
      profile.qualityTilt * 0.16
  );
}

function callsAllowed(
  score: number,
  riskLabel: RiskLabel,
  technicals: TechnicalFactors
): boolean {
  return (
    score >= 8 &&
    riskLabel !== "High" &&
    riskLabel !== "Extreme" &&
    technicals.atrPercent <= 7.5 &&
    technicals.volatilityPercent <= 9 &&
    technicals.trendAligned
  );
}

export function getStrategy(
  horizon: HorizonKey,
  score: number,
  riskLabel: RiskLabel,
  technicals: TechnicalFactors
): Strategy {
  const allowCalls = callsAllowed(score, riskLabel, technicals);

  if (horizon === "swing" && score >= 8.8 && riskLabel === "Low" && technicals.lr50Slope > 0.35) {
    return "Buy Calls";
  }

  if (score >= 8.05 && riskLabel !== "High" && riskLabel !== "Extreme") {
    return allowCalls ? "Buy Shares + Calls" : "Buy Shares";
  }

  if (score >= 7.25 && riskLabel !== "Extreme") return "Buy Shares";
  if (score >= 6.1) return "Watch / Starter";
  return "Watch / Avoid";
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

  let positionSizing = "2% starter";
  if (riskLabel === "Low" && swing >= 8) positionSizing = "6%-8% full";
  else if (riskLabel === "Low" && swing >= 7) positionSizing = "5%-6% core";
  else if (riskLabel === "Medium" && swing >= 7) positionSizing = "3%-5% starter";
  else if ((riskLabel === "High" || riskLabel === "Extreme") && swing >= 7)
    positionSizing = "1%-3% tactical";

  const callPlan =
    swingStrategy === "Buy Shares + Calls"
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
  const reasons: string[] = [];
  const lr50DistancePct = ((price - technicals.lr50) / Math.max(price, 0.01)) * 100;
  const volText = `${technicals.volatilityPercent.toFixed(1)}% vol / ${technicals.atrPercent.toFixed(1)}% ATR`;

  reasons.push(
    `${item.symbol}: ${profile.sector} context, fundamentals ${pillars.fundamental.toFixed(1)}/10, technicals ${pillars.technical.toFixed(1)}/10`
  );

  if (price >= technicals.lr50 && price >= technicals.lr100) reasons.push("Above LR50/LR100 trend");
  else if (lr50DistancePct < -1.2) reasons.push("Below LR50 trend, momentum still repairing");
  if (Math.abs(price - technicals.fibLevel) / Math.max(price, 0.01) <= 0.02)
    reasons.push("Holding key fib retracement");
  if (num(item.volumeRatio, 1) >= 1.4) reasons.push("Relative volume expansion");

  if (profile.speculative) {
    reasons.push("Speculative beta requires tighter risk");
  } else if (pillars.fundamental >= 7.4) {
    reasons.push("Institutional-quality fundamentals");
  }

  if (pillars.fundamental <= 5.9) reasons.push("Fundamentals lag peers");
  if (riskLabel === "High" || riskLabel === "Extreme") reasons.push(`Volatility risk elevated (${volText})`);
  else reasons.push(`Risk controlled (${volText})`);

  return reasons.slice(0, 3);
}

function computeConfidence(
  horizons: number[],
  item: Item,
  technicals: TechnicalFactors,
  riskLabel: RiskLabel
): number {
  const mean = horizons.reduce((sum, x) => sum + x, 0) / horizons.length;
  const variance = horizons.reduce((sum, x) => sum + (x - mean) ** 2, 0) / horizons.length;
  const spread = Math.sqrt(variance);
  const spreadPenalty = spread * 1.15;

  const qualitySignals = [
    num(item.price) > 0,
    item.support !== undefined,
    item.resistance !== undefined,
    item.rsi !== undefined,
    item.volumeRatio !== undefined,
    item.technicalScore !== undefined,
    item.whaleScore !== undefined,
    item.macroScore !== undefined,
    item.politicalScore !== undefined,
    item.atrPercent !== undefined,
    item.priceVolatility !== undefined,
    item.ivPercentile !== undefined,
  ];

  const completeness = qualitySignals.filter(Boolean).length / qualitySignals.length;
  const volatilityPenalty = clamp10((technicals.atrPercent * 0.42 + technicals.volatilityPercent * 0.33) / 2.6);
  const unknownPenalty = riskLabel === "Unknown" ? 0.45 : 0;
  const avgScore = mean;

  return clamp10(
    4.2 +
      completeness * 4.1 +
      Math.max(0, avgScore - 6.5) * 0.55 -
      spreadPenalty -
      volatilityPenalty * 0.42 -
      unknownPenalty
  );
}

function diversifyBestStrategy(
  horizons: Array<{ horizon: HorizonKey; strategy: Strategy; score: number }>,
  riskLabel: RiskLabel,
  profile: TickerProfile
): Strategy {
  const sorted = [...horizons].sort((a, b) => b.score - a.score);
  const leader = sorted[0];
  const runnerUp = sorted[1];

  if (!leader) return "Watch / Avoid";

  if (riskLabel === "High" || riskLabel === "Extreme") {
    return leader.score >= 7.4 ? "Watch / Starter" : "Watch / Avoid";
  }

  if (profile.speculative) {
    if (leader.horizon === "swing" && leader.score >= 8.6) return "Buy Calls";
    if (leader.score >= 8.2 && (runnerUp?.score ?? 0) >= 7.7) return "Buy Shares";
    return leader.score >= 6.8 ? "Watch / Starter" : "Watch / Avoid";
  }

  if (leader.horizon === "oneYear" || leader.horizon === "sixMonth") {
    if (leader.score >= 8.55 && (runnerUp?.score ?? 0) >= 7.9) return "Buy Shares + Calls";
    return leader.score >= 8 ? "Buy Shares" : "Watch / Starter";
  }

  if (leader.horizon === "swing" && leader.score >= 8.5) {
    return "Buy Shares + Calls";
  }

  return leader.strategy;
}

function expandScoreRange(score: number, riskScore: number, profile: TickerProfile): number {
  const centered = score - 6.6;
  const amplified = 6.7 + centered * 1.45;
  const riskDrag = (riskScore - 55) * 0.012;
  const qualityBoost = profile.speculative ? -0.16 : 0.18;
  return clamp10(amplified - riskDrag + qualityBoost);
}

export function computeMetrics(item: Item): RowMetrics {
  const { pillars, technicals, profile } = computePillars(item);
  const { riskScore, riskLabel } = computeRisk(item, technicals);

  const swing = weightedHorizonScore("swing", pillars, profile);
  const threeMonth = weightedHorizonScore("threeMonth", pillars, profile);
  const sixMonth = weightedHorizonScore("sixMonth", pillars, profile);
  const oneYear = weightedHorizonScore("oneYear", pillars, profile);

  const swingExpanded = expandScoreRange(swing, riskScore, profile);
  const threeMonthExpanded = expandScoreRange(threeMonth, riskScore, profile);
  const sixMonthExpanded = expandScoreRange(sixMonth, riskScore, profile);
  const oneYearExpanded = expandScoreRange(oneYear, riskScore, profile);

  const swingSignal = scoreLabel(swingExpanded);
  const threeMonthSignal = scoreLabel(threeMonthExpanded);
  const sixMonthSignal = scoreLabel(sixMonthExpanded);
  const oneYearSignal = scoreLabel(oneYearExpanded);

  const swingStrategy = getStrategy("swing", swingExpanded, riskLabel, technicals);
  const threeMonthStrategy = getStrategy("threeMonth", threeMonthExpanded, riskLabel, technicals);
  const sixMonthStrategy = getStrategy("sixMonth", sixMonthExpanded, riskLabel, technicals);
  const oneYearStrategy = getStrategy("oneYear", oneYearExpanded, riskLabel, technicals);

  const horizonRanked = [
    { horizon: "swing" as HorizonKey, strategy: swingStrategy, score: swingExpanded },
    { horizon: "threeMonth" as HorizonKey, strategy: threeMonthStrategy, score: threeMonthExpanded },
    { horizon: "sixMonth" as HorizonKey, strategy: sixMonthStrategy, score: sixMonthExpanded },
    { horizon: "oneYear" as HorizonKey, strategy: oneYearStrategy, score: oneYearExpanded },
  ];

  const bestStrategy = diversifyBestStrategy(horizonRanked, riskLabel, profile);
  const confidence = computeConfidence(
    [swingExpanded, threeMonthExpanded, sixMonthExpanded, oneYearExpanded],
    item,
    technicals,
    riskLabel
  );

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

  const tradePlan = computeTradePlan(item, swingExpanded, riskLabel, swingStrategy);

  const hotSetup =
    num(item.price) > 0 &&
    swingExpanded >= 7.7 &&
    confidence >= 6.8 &&
    (riskLabel === "Low" || riskLabel === "Medium");

  const redFlag =
    num(item.price) <= 0 ||
    riskLabel === "Extreme" ||
    (riskLabel === "High" && swingExpanded < 6.9) ||
    item.bias === "Bearish";

  const why = buildWhy(item, pillars, technicals, riskLabel, profile);
  const marketRegime = getMarketRegime(pillars);

  const notes: string[] = [...why];
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
    why,
    swingSignal,
    threeMonthSignal,
    sixMonthSignal,
    oneYearSignal,
    swingStrategy,
    threeMonthStrategy,
    sixMonthStrategy,
    oneYearStrategy,
    bestStrategy,
    marketRegime,
    opportunityScore,
    entryZone: tradePlan.entryZone,
    stopLoss: tradePlan.stopLoss,
    target1: tradePlan.target1,
    target2: tradePlan.target2,
    positionSizing: tradePlan.positionSizing,
    callPlan: tradePlan.callPlan,
    putPlan: tradePlan.putPlan,
    notes,
    momentumToday: Math.round(clamp((pillars.technical * 0.6 + pillars.intelligence * 0.4) * 10)),
    redFlag,
    hotSetup,
  };
}
