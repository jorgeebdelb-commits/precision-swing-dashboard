import type {
  HorizonKey,
  Item,
  MarketRegime,
  Strategy,
} from "../types/dashboard";

import { clamp, formatPrice, num } from "../app/lib/helpers";

export type RiskLabel = "Low" | "Medium" | "High" | "Extreme";

type PillarScores = {
  technical: number;
  fundamental: number;
  intelligence: number;
  environment: number;
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

const HIGH_BETA_SYMBOLS = new Set(["TSLA", "MARA", "IREN", "RGTI"]);

const clamp10 = (value: number): number =>
  Math.max(1, Math.min(10, Math.round(value * 10) / 10));

const scaleTo10 = (value: number): number => clamp10(clamp(value) / 10);

const scoreLabel = (score: number): string => {
  if (score >= 8.5) return "Strong Buy";
  if (score >= 7) return "Buy";
  if (score >= 6) return "Watch";
  return "Avoid";
};

const symbolSeed = (symbol: string): number => {
  return symbol
    .split("")
    .reduce((sum, char, idx) => sum + char.charCodeAt(0) * (idx + 1), 0);
};

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

function computePillars(item: Item): { pillars: PillarScores; technicals: TechnicalFactors } {
  const t = buildTechnicalFactors(item);
  const price = num(item.price);

  const lr50Distance = (price - t.lr50) / Math.max(price, 0.01);
  const lr100Distance = (price - t.lr100) / Math.max(price, 0.01);
  const fibDistance = Math.abs(price - t.fibLevel) / Math.max(price, 0.01);

  const lr50ValueScore = clamp10(6 + lr50Distance * 55);
  const lr100ValueScore = clamp10(6 + lr100Distance * 55);
  const slopeScore = clamp10(5 + t.lr50Slope * 0.65 + t.lr100Slope * 0.45);
  const priceVsLrScore = clamp10(5 + (lr50Distance + lr100Distance) * 35);
  const alignmentScore = t.trendAligned ? 8.4 : 4.9;
  const fibScore = clamp10(8.4 - fibDistance * 120);
  const rsiScore = clamp10(10 - Math.abs(num(item.rsi, 50) - 58) / 6.5);
  const volumeScore = clamp10(4.6 + num(item.volumeRatio, 1) * 2.25);
  const atrScore = clamp10(10 - t.atrPercent / 1.8);

  const technical = clamp10(
    lr50ValueScore * 0.13 +
      lr100ValueScore * 0.12 +
      slopeScore * 0.15 +
      priceVsLrScore * 0.15 +
      alignmentScore * 0.14 +
      fibScore * 0.12 +
      rsiScore * 0.08 +
      volumeScore * 0.06 +
      atrScore * 0.05
  );

  const fundamental = clamp10(
    scaleTo10(num(item.macroScore, 58)) * 0.45 +
      scaleTo10(num(item.politicalScore, 55)) * 0.25 +
      scaleTo10(num(item.technicalScore, 60)) * 0.2 +
      clamp10(10 - t.volatilityPercent / 2.7) * 0.1
  );

  const intelligence = clamp10(
    scaleTo10(num(item.whaleScore, 60)) * 0.5 +
      volumeScore * 0.2 +
      rsiScore * 0.1 +
      (item.bias === "Bullish" ? 8.2 : item.bias === "Bearish" ? 3.9 : 5.9) * 0.2
  );

  const environment = clamp10(
    scaleTo10(num(item.politicalScore, 55)) * 0.35 +
      scaleTo10(num(item.macroScore, 58)) * 0.35 +
      clamp10(10 - t.atrPercent / 2.2) * 0.2 +
      (item.bias === "Bearish" ? 4.4 : 6.6) * 0.1
  );

  return {
    pillars: {
      technical,
      fundamental,
      intelligence,
      environment,
    },
    technicals: t,
  };
}

export function computeRisk(
  item: Item,
  technicals: TechnicalFactors
): { riskScore: number; riskLabel: RiskLabel } {
  const price = Math.max(num(item.price), 0.01);
  const baseBeta = HIGH_BETA_SYMBOLS.has(item.symbol.toUpperCase()) ? 2.1 : 1.1;
  const betaProxy = num(item.betaProxy, baseBeta + Math.max(0, num(item.volumeRatio, 1) - 1) * 0.35);

  const volatilityPercent = Math.max(technicals.volatilityPercent, 0);
  const atrPercent = Math.max(technicals.atrPercent, 0);

  const seed = symbolSeed(item.symbol);
  const earningsDays = num(item.earningsDays, (seed % 36) + 5);
  const earningsRisk = earningsDays <= 5 ? 9.5 : earningsDays <= 10 ? 7.3 : 4.1;

  const ivPercentile = num(
    item.ivPercentile,
    Math.min(100, 35 + volatilityPercent * 6 + Math.max(0, betaProxy - 1) * 12)
  );

  const risk10 = clamp10(
    atrPercent * 0.16 +
      volatilityPercent * 0.24 +
      betaProxy * 1.45 +
      earningsRisk * 0.9 +
      ivPercentile * 0.028 +
      (price < 5 ? 0.8 : 0)
  );

  const riskScore = Math.round(risk10 * 10);
  const riskLabel: RiskLabel =
    risk10 >= 8.8 ? "Extreme" : risk10 >= 7.1 ? "High" : risk10 >= 4.8 ? "Medium" : "Low";

  return { riskScore, riskLabel };
}

function weightedHorizonScore(horizon: HorizonKey, pillars: PillarScores): number {
  if (horizon === "swing") {
    return clamp10(
      pillars.technical * 0.5 +
        pillars.intelligence * 0.25 +
        pillars.environment * 0.15 +
        pillars.fundamental * 0.1
    );
  }

  if (horizon === "threeMonth") {
    return clamp10(
      pillars.technical * 0.3 +
        pillars.fundamental * 0.3 +
        pillars.intelligence * 0.25 +
        pillars.environment * 0.15
    );
  }

  if (horizon === "sixMonth") {
    return clamp10(
      pillars.fundamental * 0.4 +
        pillars.technical * 0.25 +
        pillars.environment * 0.2 +
        pillars.intelligence * 0.15
    );
  }

  return clamp10(
    pillars.fundamental * 0.45 +
      pillars.environment * 0.25 +
      pillars.technical * 0.2 +
      pillars.intelligence * 0.1
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
  _horizon: HorizonKey,
  score: number,
  riskLabel: RiskLabel,
  technicals: TechnicalFactors
): Strategy {
  const allowCalls = callsAllowed(score, riskLabel, technicals);

  if (score >= 8 && riskLabel !== "High" && riskLabel !== "Extreme") {
    return allowCalls ? "Buy Shares + Calls" : "Buy Shares";
  }

  if (score >= 7) return "Buy Shares";
  if (score >= 6) return "Watch / Starter";
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
  riskLabel: RiskLabel
): string[] {
  const price = num(item.price);
  const reasons: string[] = [];

  if (price >= technicals.lr50 && price >= technicals.lr100) reasons.push("Above LR50/LR100");
  if (Math.abs(price - technicals.fibLevel) / Math.max(price, 0.01) <= 0.02)
    reasons.push("Holding 0.5 Fib");
  if (num(item.volumeRatio, 1) >= 1.4) reasons.push("Strong volume");
  if (pillars.fundamental <= 5.8) reasons.push("Weak fundamentals");
  if (riskLabel === "High" || riskLabel === "Extreme") reasons.push("High volatility risk");

  if (!reasons.length) reasons.push("Mixed setup");

  return reasons.slice(0, 3);
}

function computeConfidence(
  horizons: number[],
  item: Item
): number {
  const mean = horizons.reduce((sum, x) => sum + x, 0) / horizons.length;
  const variance = horizons.reduce((sum, x) => sum + (x - mean) ** 2, 0) / horizons.length;
  const spreadPenalty = Math.sqrt(variance) * 0.9;

  const qualitySignals = [
    num(item.price) > 0,
    num(item.support) > 0,
    num(item.resistance) > 0,
    num(item.rsi) > 0,
    num(item.volumeRatio) > 0,
    num(item.technicalScore) > 0,
    num(item.whaleScore) > 0,
    num(item.macroScore) > 0,
    num(item.politicalScore) > 0,
  ];

  const completeness = qualitySignals.filter(Boolean).length / qualitySignals.length;

  return clamp10(5.2 + completeness * 3.8 - spreadPenalty);
}

export function computeMetrics(item: Item): RowMetrics {
  const { pillars, technicals } = computePillars(item);
  const { riskScore, riskLabel } = computeRisk(item, technicals);

  const swing = weightedHorizonScore("swing", pillars);
  const threeMonth = weightedHorizonScore("threeMonth", pillars);
  const sixMonth = weightedHorizonScore("sixMonth", pillars);
  const oneYear = weightedHorizonScore("oneYear", pillars);

  const swingSignal = scoreLabel(swing);
  const threeMonthSignal = scoreLabel(threeMonth);
  const sixMonthSignal = scoreLabel(sixMonth);
  const oneYearSignal = scoreLabel(oneYear);

  const swingStrategy = getStrategy("swing", swing, riskLabel, technicals);
  const threeMonthStrategy = getStrategy("threeMonth", threeMonth, riskLabel, technicals);
  const sixMonthStrategy = getStrategy("sixMonth", sixMonth, riskLabel, technicals);
  const oneYearStrategy = getStrategy("oneYear", oneYear, riskLabel, technicals);

  const horizonRanked = [
    { strategy: swingStrategy, score: swing },
    { strategy: threeMonthStrategy, score: threeMonth },
    { strategy: sixMonthStrategy, score: sixMonth },
    { strategy: oneYearStrategy, score: oneYear },
  ].sort((a, b) => b.score - a.score);

  const bestStrategy = horizonRanked[0]?.strategy ?? "Watch / Avoid";
  const confidence = computeConfidence([swing, threeMonth, sixMonth, oneYear], item);

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
      (swing * 0.35 +
        threeMonth * 0.25 +
        sixMonth * 0.2 +
        oneYear * 0.2) *
        10 -
        riskScore * 0.18 +
        confidence * 2
    )
  );

  const tradePlan = computeTradePlan(item, swing, riskLabel, swingStrategy);

  const hotSetup =
    num(item.price) > 0 &&
    swing >= 7.6 &&
    confidence >= 7 &&
    (riskLabel === "Low" || riskLabel === "Medium");

  const redFlag =
    num(item.price) <= 0 ||
    riskLabel === "Extreme" ||
    (riskLabel === "High" && swing < 6.8) ||
    item.bias === "Bearish";

  const why = buildWhy(item, pillars, technicals, riskLabel);
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
    swing,
    threeMonth,
    sixMonth,
    oneYear,
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
