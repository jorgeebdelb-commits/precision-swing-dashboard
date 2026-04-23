import type {
  HorizonKey,
  Item,
  MarketRegime,
  Strategy,
} from "../types/dashboard";

import { clamp, formatPrice, num } from "../app/lib/helpers";

import {
  computeWhaleV2,
  getBaseSignal,
  getPricePositionScore,
  getRSIMomentumScore,
  normalizeVolumeRatio,
} from "./scoring";

export type RiskLabel = "Low" | "Medium" | "High";

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
  riskScore: number;
  riskLabel: RiskLabel;
  swing: number;
  threeMonth: number;
  sixMonth: number;
  oneYear: number;
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

export function computeRisk(
  item: Item,
  whaleV2: number
): { riskScore: number; riskLabel: RiskLabel } {
  const volumeRisk = Math.min(
    100,
    Math.max(0, num(item.volumeRatio, 1) * 24)
  );

  const structureRisk = Math.max(
    0,
    100 - (clamp(item.technicalScore) * 0.55 + whaleV2 * 0.45)
  );

  const biasRisk =
    item.bias === "Bearish"
      ? 18
      : item.bias === "Watch"
      ? 8
      : 0;

  const zeroPriceRisk = num(item.price) <= 0 ? 20 : 0;

  const riskScore = Math.round(
    clamp(
      volumeRisk * 0.38 +
        structureRisk * 0.42 +
        biasRisk +
        zeroPriceRisk
    )
  );

  const riskLabel: RiskLabel =
    riskScore >= 67 ? "High" : riskScore >= 45 ? "Medium" : "Low";

  return { riskScore, riskLabel };
}

export function getStrategy(
  horizon: HorizonKey,
  score: number,
  riskLabel: RiskLabel,
  bias: Item["bias"],
  whaleV2: number
): Strategy {
  const bearish = bias === "Bearish";

  if (horizon === "swing") {
    if (bearish && score <= 55) return "Buy Puts";
    if (score >= 84 && riskLabel !== "High") return "Buy Calls";
    if (score >= 72 && whaleV2 >= 68) return "Buy Shares + Calls";
    if (score >= 62) return "Buy Shares";
    if (score < 50) return "Buy Puts";
    return "Watch";
  }

  if (horizon === "threeMonth") {
    if (bearish && score < 52) return "Buy Puts";
    if (score >= 82 && riskLabel === "Low") return "Buy Shares + Calls";
    if (score >= 72) return "Buy Shares";
    if (score < 48) return "Buy Puts";
    return "Watch";
  }

  if (horizon === "sixMonth") {
    if (bearish && score < 45) return "Buy Puts";
    if (score >= 80 && riskLabel !== "High") return "Buy Shares";
    if (score >= 70) return "Buy Shares + Calls";
    if (score < 45) return "Buy Puts";
    return "Watch";
  }

  if (bearish && score < 42) return "Buy Puts";
  if (score >= 78) return "Buy Shares";
  if (score >= 68 && riskLabel === "Low") return "Buy Shares + Calls";
  if (score < 42) return "Buy Puts";
  return "Watch";
}

export function getMarketRegime(
  item: Item,
  whaleV2: number
): MarketRegime {
  const score =
    clamp(item.macroScore) * 0.35 +
    clamp(item.technicalScore) * 0.3 +
    whaleV2 * 0.2 +
    getRSIMomentumScore(num(item.rsi, 50)) * 0.15;

  if (score >= 74) return "Risk-On";
  if (score >= 56) return "Balanced";
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
      putPlan: "Puts: wait for live quote",
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

  const entryZone =
    swingStrategy === "Buy Puts"
      ? `${formatPrice(r - width * 0.08)} - ${formatPrice(r + width * 0.08)}`
      : `${formatPrice(pullbackEntry)} - ${formatPrice(
          Math.min(breakoutEntry, r)
        )}`;

  let positionSizing = "2% starter";
  if (riskLabel === "Low" && swing >= 82) positionSizing = "6%-8% full";
  else if (riskLabel === "Low" && swing >= 72) positionSizing = "5%-6% core";
  else if (riskLabel === "Medium" && swing >= 72) positionSizing = "3%-5% starter";
  else if (riskLabel === "High" && swing >= 72) positionSizing = "2%-3% tactical";

  const callPlan =
    swingStrategy === "Buy Calls" || swingStrategy === "Buy Shares + Calls"
      ? "Calls: 30-45 DTE ATM or 1 strike ITM"
      : "Calls: not preferred";

  const putPlan =
    swingStrategy === "Buy Puts"
      ? "Puts: 21-45 DTE ATM or slight ITM"
      : "Puts: not preferred";

  return {
    entryZone,
    stopLoss: formatPrice(stop),
    target1: formatPrice(target1),
    target2: formatPrice(target2),
    positionSizing,
    callPlan,
    putPlan,
  };
}

export function computeMetrics(item: Item): RowMetrics {
  const whaleV2 = computeWhaleV2(item);
  const { riskScore, riskLabel } = computeRisk(item, whaleV2);

  const technical = clamp(item.technicalScore);
  const macro = clamp(item.macroScore);
  const political = clamp(item.politicalScore);
  const rsiScore = getRSIMomentumScore(num(item.rsi, 50));
  const volumeScore = normalizeVolumeRatio(num(item.volumeRatio, 1));
  const pricePosition = getPricePositionScore(item);
  const priceAlivePenalty = num(item.price) > 0 ? 0 : -18;

  const momentumToday = Math.round(
    clamp(
      rsiScore * 0.35 +
        volumeScore * 0.35 +
        pricePosition * 0.2 +
        (item.bias === "Bullish" ? 8 : item.bias === "Bearish" ? -8 : 0) +
        priceAlivePenalty
    )
  );

  const riskAdjustment =
    riskLabel === "Low" ? 4 : riskLabel === "Medium" ? 0 : -7;

  const swing = Math.round(
    clamp(
      technical * 0.22 +
        whaleV2 * 0.24 +
        rsiScore * 0.18 +
        volumeScore * 0.16 +
        pricePosition * 0.12 +
        momentumToday * 0.08 +
        riskAdjustment +
        priceAlivePenalty * 0.3
    )
  );

  const threeMonth = Math.round(
    clamp(
      technical * 0.24 +
        whaleV2 * 0.22 +
        macro * 0.2 +
        political * 0.12 +
        pricePosition * 0.08 +
        rsiScore * 0.08 +
        momentumToday * 0.06 +
        riskAdjustment +
        priceAlivePenalty * 0.15
    )
  );

  const sixMonth = Math.round(
    clamp(
      macro * 0.28 +
        whaleV2 * 0.22 +
        technical * 0.18 +
        political * 0.16 +
        pricePosition * 0.06 +
        rsiScore * 0.05 +
        momentumToday * 0.05 +
        riskAdjustment +
        priceAlivePenalty * 0.08
    )
  );

  const oneYear = Math.round(
    clamp(
      macro * 0.3 +
        political * 0.2 +
        technical * 0.16 +
        whaleV2 * 0.18 +
        pricePosition * 0.04 +
        rsiScore * 0.06 +
        momentumToday * 0.06 +
        riskAdjustment +
        priceAlivePenalty * 0.05
    )
  );

  const swingSignal = getBaseSignal(swing);
  const threeMonthSignal = getBaseSignal(threeMonth);
  const sixMonthSignal = getBaseSignal(sixMonth);
  const oneYearSignal = getBaseSignal(oneYear);

  const swingStrategy = getStrategy(
    "swing",
    swing,
    riskLabel,
    item.bias,
    whaleV2
  );

  const threeMonthStrategy = getStrategy(
    "threeMonth",
    threeMonth,
    riskLabel,
    item.bias,
    whaleV2
  );

  const sixMonthStrategy = getStrategy(
    "sixMonth",
    sixMonth,
    riskLabel,
    item.bias,
    whaleV2
  );

  const oneYearStrategy = getStrategy(
    "oneYear",
    oneYear,
    riskLabel,
    item.bias,
    whaleV2
  );

  const bestHorizon = [
    { strategy: swingStrategy, score: swing },
    { strategy: threeMonthStrategy, score: threeMonth },
    { strategy: sixMonthStrategy, score: sixMonth },
    { strategy: oneYearStrategy, score: oneYear },
  ].sort((a, b) => b.score - a.score)[0];

  const marketRegime = getMarketRegime(item, whaleV2);

  const opportunityScore = Math.round(
    clamp(
      swing * 0.34 +
        threeMonth * 0.2 +
        sixMonth * 0.18 +
        oneYear * 0.12 +
        whaleV2 * 0.1 +
        momentumToday * 0.12 -
        riskScore * 0.12
    )
  );

  const tradePlan = computeTradePlan(item, swing, riskLabel, swingStrategy);

  const hotSetup =
    num(item.price) > 0 &&
    swing >= 74 &&
    whaleV2 >= 68 &&
    momentumToday >= 65 &&
    riskLabel !== "High";

  const redFlag =
    num(item.price) <= 0 ||
    (riskLabel === "High" && swing < 62) ||
    item.bias === "Bearish";

  const notes: string[] = [];
  if (hotSetup) notes.push("Hot setup today");
  if (whaleV2 >= 78) notes.push("Strong accumulation profile");
  if (riskLabel === "High") notes.push("Size smaller due to elevated volatility");
  if (marketRegime === "Risk-On") notes.push("Macro backdrop supports upside");
  if (swingStrategy === "Buy Puts") notes.push("Downside expression preferred");
  if (threeMonth >= 75 && oneYear >= 75) notes.push("Trend aligns across horizons");
  if (num(item.price) <= 0) notes.push("Missing live quote, refresh all");

  return {
    whaleV2,
    riskScore,
    riskLabel,
    swing,
    threeMonth,
    sixMonth,
    oneYear,
    swingSignal,
    threeMonthSignal,
    sixMonthSignal,
    oneYearSignal,
    swingStrategy,
    threeMonthStrategy,
    sixMonthStrategy,
    oneYearStrategy,
    bestStrategy: bestHorizon?.strategy ?? "Watch",
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
    momentumToday,
    redFlag,
    hotSetup,
  };
}