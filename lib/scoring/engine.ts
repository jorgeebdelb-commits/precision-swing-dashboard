import type {
  IntelligenceFactors,
  IntelligenceScoreResult,
} from "@/types/intelligence";
import { computeBaseScores } from "./base-scores";
import { computeHorizonScores } from "./horizon-scores";
import {
  pickBestStrategy,
  scoreToConfidencePct,
  scoreToLabel,
  scoreToRiskLevel,
} from "./outcomes";
import { averageScores, clampScore } from "./scale";

export function scoreSymbolIntelligence(
  factors: IntelligenceFactors,
  generatedAt: string = new Date().toISOString()
): IntelligenceScoreResult {
  const baseScores = computeBaseScores(factors);
  const horizonScores = computeHorizonScores(baseScores);

  const overallScore = clampScore(
    averageScores([
      horizonScores.swing,
      horizonScores.threeMonth,
      horizonScores.sixMonth,
      horizonScores.oneYear,
    ])
  );

  const riskLevel = scoreToRiskLevel(overallScore);

  return {
    symbol: factors.symbol,
    baseScores,
    horizonScores,
    overallScore,
    label: scoreToLabel(overallScore),
    bestStrategy: pickBestStrategy(overallScore, riskLevel),
    confidencePct: scoreToConfidencePct(overallScore),
    riskLevel,
    generatedAt,
  };
}
