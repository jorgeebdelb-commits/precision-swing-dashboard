import { evaluateRecommendation } from "@/lib/intelligence/recommendationEngine";
import type { AnalysisResult, FactorWeight, HorizonKey, MarketContextSnapshot, RiskLevel } from "@/lib/intelligence/types";

const clamp10 = (value: number): number => Math.max(1, Math.min(10, Number(value.toFixed(2))));

export function scoreFromWeights(weights: FactorWeight[], breakdown: Record<string, number>): number {
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const weighted = weights.reduce((sum, entry) => sum + (breakdown[entry.factor] ?? 5) * entry.weight, 0) / total;
  return clamp10(weighted);
}

function toRisk(volatility: number): RiskLevel {
  if (volatility >= 3.4) return "Extreme";
  if (volatility >= 2.4) return "High";
  if (volatility >= 1.5) return "Medium";
  return "Low";
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

  const engine = evaluateRecommendation({
    swingScore: params.horizon === "swing" ? score : clamp10(params.marketContext.technicalScore * 0.9 + 0.8),
    threeMonthScore: params.horizon === "threeMonth" ? score : clamp10(params.marketContext.macroScore * 0.75 + 1.2),
    sixMonthScore: params.horizon === "sixMonth" ? score : clamp10(params.marketContext.macroScore * 0.8 + 1),
    oneYearScore: params.horizon === "oneYear" ? score : clamp10(params.marketContext.macroScore * 0.85 + 0.8),
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
