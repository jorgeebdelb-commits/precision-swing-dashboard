import { evaluateRecommendation } from "@/lib/intelligence/recommendationEngine";
import type { AnalysisResult, FactorWeight, HorizonKey, MarketContextSnapshot, RiskLevel } from "@/lib/intelligence/types";

const clamp10 = (value: number): number => Math.max(1, Math.min(10, Number(value.toFixed(2))));

export function scoreFromWeights(weights: FactorWeight[], breakdown: Record<string, number>): number {
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const weighted = weights.reduce((sum, entry) => sum + (breakdown[entry.factor] ?? 5) * entry.weight, 0) / total;
  return clamp10(weighted);
}

function toRisk(volatility: number): RiskLevel {
  if (volatility >= 4.1) return "Extreme";
  if (volatility >= 3.1) return "High";
  if (volatility >= 2.0) return "Medium";
  return "Low";
}

function deriveHorizonScores(params: {
  horizon: HorizonKey;
  score: number;
  marketContext: MarketContextSnapshot;
}): { swingScore: number; threeMonthScore: number; sixMonthScore: number; oneYearScore: number } {
  const baseSwing = clamp10(params.marketContext.technicalScore * 0.95 + params.marketContext.trendSlope * 11 + 0.45);
  const base3m = clamp10(
    params.marketContext.macroScore * 0.74 + params.marketContext.newsSentiment * 0.18 + params.marketContext.flowScore * 0.08
  );
  const base6m = clamp10(params.marketContext.macroScore * 0.88 + params.marketContext.politicalScore * 0.12 - 0.2);
  const base1y = clamp10(params.marketContext.macroScore * 0.94 + params.marketContext.politicalScore * 0.2 - 0.55);

  const horizonBumps: Record<HorizonKey, { swing: number; m3: number; m6: number; y1: number }> = {
    swing: { swing: 0.55, m3: -0.05, m6: -0.2, y1: -0.35 },
    threeMonth: { swing: -0.2, m3: 0.5, m6: 0.18, y1: 0.05 },
    sixMonth: { swing: -0.3, m3: 0.05, m6: 0.55, y1: 0.22 },
    oneYear: { swing: -0.45, m3: -0.1, m6: 0.15, y1: 0.6 },
  };

  const bump = horizonBumps[params.horizon];
  return {
    swingScore: params.horizon === "swing" ? params.score : clamp10(baseSwing + bump.swing),
    threeMonthScore: params.horizon === "threeMonth" ? params.score : clamp10(base3m + bump.m3),
    sixMonthScore: params.horizon === "sixMonth" ? params.score : clamp10(base6m + bump.m6),
    oneYearScore: params.horizon === "oneYear" ? params.score : clamp10(base1y + bump.y1),
  };
}

export function finalizePipeline(params: {
  symbol: string;
  horizon: HorizonKey;
  marketContext: MarketContextSnapshot;
  factorWeights: FactorWeight[];
  factorBreakdown: Record<string, number>;
}): AnalysisResult {
  const score = scoreFromWeights(params.factorWeights, params.factorBreakdown);
  const risk = toRisk(params.marketContext.volatility);
  const horizonScores = deriveHorizonScores({ horizon: params.horizon, score, marketContext: params.marketContext });

  const engine = evaluateRecommendation({
    swingScore: horizonScores.swingScore,
    threeMonthScore: horizonScores.threeMonthScore,
    sixMonthScore: horizonScores.sixMonthScore,
    oneYearScore: horizonScores.oneYearScore,
    technicalScore: clamp10(params.marketContext.technicalScore),
    fundamentalScore: clamp10((params.marketContext.macroScore + params.marketContext.politicalScore) / 2),
    sentiment:
      params.marketContext.newsSentiment >= 6.4
        ? "Bullish"
        : params.marketContext.newsSentiment <= 4.6
        ? "Bearish"
        : "Neutral",
    whalesIntel: clamp10(params.marketContext.flowScore),
    momentum: clamp10(5 + params.marketContext.trendSlope * 10 + (params.marketContext.rsi - 50) * 0.05),
    volatility: clamp10(params.marketContext.volatility * 2.2),
    riskLevel: risk,
  });

  return {
    symbol: params.symbol,
    horizon: params.horizon,
    score,
    rating: engine.rating,
    strategy: engine.strategy,
    confidence: engine.confidence,
    risk,
    reason: engine.reason,
    factorWeights: params.factorWeights,
    factorBreakdown: params.factorBreakdown,
  };
}
