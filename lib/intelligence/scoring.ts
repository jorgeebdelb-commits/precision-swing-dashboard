import type { HorizonKey, MarketContextSnapshot } from "@/lib/intelligence/types";

export interface LayerScores {
  technicalScore: number;
  sentimentScore: number;
  flowScore: number;
  macroScore: number;
  fundamentalScore: number;
}

export interface HorizonDecisionScore {
  finalScore: number;
  rating: "Strong Buy" | "Buy" | "Watch" | "Neutral" | "Avoid" | "Strong Avoid";
  weights: Record<keyof LayerScores, number>;
}

const HORIZON_WEIGHTS: Record<HorizonKey, Record<keyof LayerScores, number>> = {
  swing: {
    technicalScore: 0.45,
    flowScore: 0.25,
    sentimentScore: 0.15,
    macroScore: 0.1,
    fundamentalScore: 0.05,
  },
  threeMonth: {
    technicalScore: 0.25,
    flowScore: 0.15,
    sentimentScore: 0.15,
    macroScore: 0.2,
    fundamentalScore: 0.25,
  },
  sixMonth: {
    technicalScore: 0.15,
    flowScore: 0.1,
    sentimentScore: 0.1,
    macroScore: 0.25,
    fundamentalScore: 0.4,
  },
  oneYear: {
    technicalScore: 0.05,
    flowScore: 0.05,
    sentimentScore: 0.1,
    macroScore: 0.3,
    fundamentalScore: 0.5,
  },
};

const clamp100 = (value: number): number => Math.max(0, Math.min(100, Number(value.toFixed(2))));
const from10 = (value: number): number => clamp100(value * 10);

function avg(values: number[], fallback = 50): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function deriveLayerScores(params: {
  marketContext: MarketContextSnapshot;
  factorBreakdown: Record<string, number>;
}): LayerScores {
  const { factorBreakdown, marketContext } = params;

  const technicalScore = clamp100(
    avg([
      from10(marketContext.technicalScore),
      from10(factorBreakdown.technicals ?? factorBreakdown.technicalStructure ?? marketContext.technicalScore),
      from10(factorBreakdown.momentum ?? marketContext.technicalScore),
      from10(factorBreakdown.sectorTrend ?? marketContext.flowScore),
    ])
  );

  const sentimentScore = clamp100(
    avg([
      from10(marketContext.newsSentiment),
      from10(factorBreakdown.sentiment ?? marketContext.newsSentiment),
      from10(factorBreakdown.nearTermCatalysts ?? factorBreakdown.catalystCalendar ?? marketContext.newsSentiment),
    ])
  );

  const flowScore = clamp100(
    avg([
      from10(marketContext.flowScore),
      from10(factorBreakdown.volume ?? marketContext.volumeRatio * 2.2),
      from10(factorBreakdown.whalesOptions ?? factorBreakdown.institutionalBehavior ?? marketContext.flowScore),
    ])
  );

  const macroScore = clamp100(
    avg([
      from10(marketContext.macroScore),
      from10(marketContext.politicalScore),
      from10(factorBreakdown.macroPressure ?? factorBreakdown.macroTrend ?? factorBreakdown.macroCycle ?? marketContext.macroScore),
      from10(
        factorBreakdown.politicalRegulatoryExposure ?? factorBreakdown.geopoliticalPolicyExposure ?? marketContext.politicalScore
      ),
    ])
  );

  const fundamentalScore = clamp100(
    avg([
      from10(factorBreakdown.earningsTrend ?? marketContext.macroScore),
      from10(factorBreakdown.fundamentals ?? factorBreakdown.longTermFundamentals ?? marketContext.macroScore),
      from10(factorBreakdown.earningsQuality ?? factorBreakdown.balanceSheetQuality ?? marketContext.macroScore),
      from10(factorBreakdown.valuationRisk ?? factorBreakdown.competitiveMoat ?? marketContext.macroScore),
    ])
  );

  return {
    technicalScore,
    sentimentScore,
    flowScore,
    macroScore,
    fundamentalScore,
  };
}

export function toRating(finalScore: number): HorizonDecisionScore["rating"] {
  if (finalScore >= 90) return "Strong Buy";
  if (finalScore >= 80) return "Buy";
  if (finalScore >= 65) return "Watch";
  if (finalScore >= 50) return "Neutral";
  if (finalScore >= 35) return "Avoid";
  return "Strong Avoid";
}

export function buildHorizonDecisionScore(horizon: HorizonKey, layerScores: LayerScores): HorizonDecisionScore {
  const weights = HORIZON_WEIGHTS[horizon];
  const finalScore = clamp100(
    layerScores.technicalScore * weights.technicalScore +
      layerScores.flowScore * weights.flowScore +
      layerScores.sentimentScore * weights.sentimentScore +
      layerScores.macroScore * weights.macroScore +
      layerScores.fundamentalScore * weights.fundamentalScore
  );

  return {
    finalScore,
    rating: toRating(finalScore),
    weights,
  };
}
