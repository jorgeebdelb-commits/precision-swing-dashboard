import { buildReasonText, buildTopReasons } from "@/lib/intelligence/explain";
import { buildHorizonDecisionScore, deriveLayerScores } from "@/lib/intelligence/scoring";
import { recommendStrategy } from "@/lib/intelligence/strategy";
import type { AnalysisResult, FactorWeight, HorizonKey, MarketContextSnapshot, RiskLevel } from "@/lib/intelligence/types";
import { validateDecision } from "@/lib/intelligence/validator";

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

function confidenceFromLayers(params: {
  layerScores: ReturnType<typeof deriveLayerScores>;
  marketContext: MarketContextSnapshot;
  factorBreakdown: Record<string, number>;
  risk: RiskLevel;
}): AnalysisResult["confidence"] {
  const { layerScores, marketContext, factorBreakdown, risk } = params;

  const trendAlignment = ((layerScores.technicalScore + layerScores.flowScore) / 2) * 0.35;
  const volumeConfirmation = Math.min(100, marketContext.volumeRatio * 70) * 0.14;
  const volatilityStability = Math.max(0, 100 - marketContext.volatility * 18) * 0.16;
  const sectorStrength = (factorBreakdown.sectorTrend ?? factorBreakdown.industryLeadership ?? marketContext.macroScore) * 10 * 0.14;
  const signalAgreement =
    (100 -
      (Math.max(
        layerScores.technicalScore,
        layerScores.sentimentScore,
        layerScores.flowScore,
        layerScores.macroScore,
        layerScores.fundamentalScore
      ) -
        Math.min(
          layerScores.technicalScore,
          layerScores.sentimentScore,
          layerScores.flowScore,
          layerScores.macroScore,
          layerScores.fundamentalScore
        ))) * 0.12;
  const newsClarity = layerScores.sentimentScore * 0.09;

  const riskPenalty = risk === "Extreme" ? 9 : risk === "High" ? 5 : risk === "Medium" ? 2 : 0;
  const confidenceScore =
    trendAlignment + volumeConfirmation + volatilityStability + sectorStrength + signalAgreement + newsClarity - riskPenalty;

  if (confidenceScore >= 72) return "High";
  if (confidenceScore >= 52) return "Medium";
  return "Low";
}

export function finalizePipeline(params: {
  symbol: string;
  horizon: HorizonKey;
  marketContext: MarketContextSnapshot;
  factorWeights: FactorWeight[];
  factorBreakdown: Record<string, number>;
}): AnalysisResult {
  const risk = toRisk(params.marketContext.volatility);
  const layerScores = deriveLayerScores({ marketContext: params.marketContext, factorBreakdown: params.factorBreakdown });
  const decision = buildHorizonDecisionScore(params.horizon, layerScores);

  const rawStrategy = recommendStrategy({
    horizon: params.horizon,
    rating: decision.rating,
    finalScore: decision.finalScore,
    layerScores,
  });

  const validated = validateDecision({
    rating: decision.rating,
    strategy: rawStrategy,
    layerScores,
    finalScore: decision.finalScore,
  });

  const topReasons = buildTopReasons({
    symbol: params.symbol,
    horizon: params.horizon,
    rating: validated.rating,
    layerScores,
  });

  return {
    symbol: params.symbol,
    horizon: params.horizon,
    score: decision.finalScore,
    rating: validated.rating,
    strategy: validated.strategy,
    confidence: confidenceFromLayers({
      layerScores,
      marketContext: params.marketContext,
      factorBreakdown: params.factorBreakdown,
      risk,
    }),
    risk,
    reason: `${buildReasonText({ symbol: params.symbol, horizon: params.horizon, rating: validated.rating, reasons: topReasons })}${
      validated.warningReason ? ` ${validated.warningReason}` : ""
    }`,
    topReasons,
    layerScores,
    factorWeights: params.factorWeights,
    factorBreakdown: params.factorBreakdown,
  };
}
