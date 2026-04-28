import type { HorizonKey, StrategyRecommendation } from "@/lib/intelligence/types";
import type { LayerScores } from "@/lib/intelligence/scoring";

export function recommendStrategy(params: {
  horizon: HorizonKey;
  rating: string;
  finalScore: number;
  layerScores: LayerScores;
}): StrategyRecommendation {
  const { horizon, rating, finalScore, layerScores } = params;
  const momentum = (layerScores.technicalScore + layerScores.flowScore) / 2;
  const longTermStrength = (layerScores.fundamentalScore + layerScores.macroScore) / 2;
  const bearishShortTerm = momentum < 40 && layerScores.sentimentScore < 45;

  if (rating === "Strong Avoid") return "Avoid";
  if (rating === "Avoid") return bearishShortTerm ? "Buy Puts" : "Watchlist Only";

  if (horizon === "swing") {
    if (momentum >= 80 && layerScores.sentimentScore >= 65 && finalScore >= 80) return "Buy Calls";
    if (momentum >= 68 && finalScore >= 60 && finalScore < 74 && layerScores.macroScore < 58) return "Speculative Buy";
    if (momentum >= 75 && finalScore >= 85) return "Buy Shares + Calls";
    if (finalScore >= 75) return "Buy Shares";
    if (bearishShortTerm) return "Buy Puts";
    return "Watchlist Only";
  }

  if (horizon === "threeMonth") {
    if (finalScore >= 85 && momentum >= 70) return "Buy Shares + Calls";
    if (finalScore >= 80) return "Buy Shares";
    if (momentum >= 75 && layerScores.sentimentScore >= 65) return "Buy Calls";
    return "Watchlist Only";
  }

  if (horizon === "sixMonth") {
    if (finalScore >= 86 && longTermStrength >= 78) return "Buy Shares + Calls";
    if (finalScore >= 78) return "Buy Shares";
    if (finalScore >= 70 && momentum >= 72) return "Buy LEAPS";
    return "Watchlist Only";
  }

  if (finalScore >= 85 && longTermStrength >= 80) return "Buy Shares";
  if (finalScore >= 75) return "Buy LEAPS";
  if (bearishShortTerm) return "Buy Puts";
  return "Watchlist Only";
}
