import type { RatingLabel, StrategyRecommendation } from "@/lib/intelligence/types";
import type { LayerScores } from "@/lib/intelligence/scoring";

export function validateDecision(params: {
  rating: RatingLabel;
  strategy: StrategyRecommendation;
  layerScores: LayerScores;
  finalScore: number;
}): { rating: RatingLabel; strategy: StrategyRecommendation; warningReason?: string } {
  let { rating, strategy } = params;
  let warningReason: string | undefined;

  if ((rating === "Strong Buy" || rating === "Buy") && strategy === "Avoid") {
    strategy = "Watchlist Only";
    warningReason = "Contradiction filter adjusted strategy from Avoid to Watchlist Only.";
  }

  if (rating === "Strong Buy" && params.layerScores.technicalScore < 60) {
    rating = "Buy";
    warningReason = "Contradiction filter lowered Strong Buy due to weak technical layer.";
  }

  if ((rating === "Strong Avoid" || rating === "Avoid") && ["Buy Shares", "Buy Calls", "Buy LEAPS", "Buy Shares + Calls"].includes(strategy)) {
    strategy = rating === "Strong Avoid" ? "Avoid" : "Watchlist Only";
    warningReason = "Contradiction filter removed bullish strategy from bearish rating.";
  }

  if (params.finalScore < 50 && strategy === "Buy Shares + Calls") {
    strategy = "Watchlist Only";
    warningReason = "Contradiction filter downgraded aggressive strategy for weak score.";
  }

  return { rating, strategy, warningReason };
}
