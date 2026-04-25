export type ConfidenceLevel = "High" | "Medium" | "Low";
export type RiskLevel = "Low" | "Medium" | "High" | "Extreme";

export type StrategyRecommendation =
  | "Buy Shares"
  | "Buy Shares + Calls"
  | "Buy Calls"
  | "Starter Size Only"
  | "Watch"
  | "Avoid"
  | "Buy Puts";

export type RatingLabel = "Strong Buy" | "Buy" | "Watch" | "Avoid";

export type RecommendationEngineInput = {
  swingScore: number;
  threeMonthScore: number;
  sixMonthScore: number;
  oneYearScore: number;
  technicalScore: number;
  fundamentalScore: number;
  sentiment: "Bullish" | "Neutral" | "Bearish";
  whalesIntel: number;
  momentum: number;
  volatility: number;
  riskLevel: RiskLevel;
};

export type RecommendationEngineOutput = {
  rating: RatingLabel;
  confidence: ConfidenceLevel;
  risk: RiskLevel;
  strategy: StrategyRecommendation;
  reason: string;
  warningReason?: string;
};

const clamp10 = (value: number): number => Math.max(1, Math.min(10, value));

const riskToNumeric: Record<RiskLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Extreme: 4,
};

function scoreToRating(score: number): RatingLabel {
  if (score >= 8.8) return "Strong Buy";
  if (score >= 7.1) return "Buy";
  if (score >= 5.5) return "Watch";
  return "Avoid";
}

function baseConfidence(input: RecommendationEngineInput): ConfidenceLevel {
  const alignmentMin = Math.min(
    input.swingScore,
    input.threeMonthScore,
    input.sixMonthScore,
    input.oneYearScore
  );
  const alignmentMax = Math.max(
    input.swingScore,
    input.threeMonthScore,
    input.sixMonthScore,
    input.oneYearScore
  );
  const spread = alignmentMax - alignmentMin;

  const convictionScore =
    input.swingScore * 0.3 +
    input.threeMonthScore * 0.22 +
    input.sixMonthScore * 0.22 +
    input.oneYearScore * 0.16 +
    input.technicalScore * 0.06 +
    input.fundamentalScore * 0.04;

  if (convictionScore >= 8.2 && spread <= 1.8 && riskToNumeric[input.riskLevel] <= 2) return "High";
  if (convictionScore >= 6.2 && spread <= 3.1) return "Medium";
  return "Low";
}

export function evaluateRecommendation(input: RecommendationEngineInput): RecommendationEngineOutput {
  const swing = clamp10(input.swingScore);
  const m3 = clamp10(input.threeMonthScore);
  const m6 = clamp10(input.sixMonthScore);
  const y1 = clamp10(input.oneYearScore);
  const technical = clamp10(input.technicalScore);
  const fundamental = clamp10(input.fundamentalScore);
  const momentum = clamp10(input.momentum);
  const volatility = clamp10(input.volatility);
  const whalesIntel = clamp10(input.whalesIntel);

  const averageScore = swing * 0.34 + m3 * 0.24 + m6 * 0.22 + y1 * 0.2;
  const longTermBullish = m3 >= 7.1 && m6 >= 7.1 && fundamental >= 6.6;
  const allWeak = swing < 5.5 && m3 < 5.5 && m6 < 5.5 && y1 < 5.5;
  const technicalBreakdown = technical <= 4.8 || (swing <= 5.2 && momentum <= 4.8);
  const momentumBreakout = momentum >= 8.2 && technical >= 7.6 && whalesIntel >= 7.2;
  const riskNumeric = riskToNumeric[input.riskLevel];

  let rating = scoreToRating(averageScore);
  let confidence = baseConfidence(input);
  let strategy: StrategyRecommendation = "Watch";
  let reason = "Mixed setup; wait for cleaner confirmation.";
  let warningReason: string | undefined;

  if (allWeak) {
    rating = "Avoid";
    strategy = "Avoid";
    confidence = "Medium";
    reason = "All horizons are weak with no clear edge.";
  } else if (technicalBreakdown && input.sentiment === "Bearish") {
    rating = "Avoid";
    strategy = "Buy Puts";
    confidence = confidence === "High" ? "Medium" : confidence;
    reason = "Technical breakdown with bearish sentiment increases downside risk.";
  } else if (swing >= 9 && momentum >= 8 && riskNumeric <= 2) {
    rating = "Strong Buy";
    strategy = momentumBreakout ? "Buy Shares + Calls" : "Buy Shares";
    confidence = "High";
    reason = momentumBreakout
      ? "Strong momentum breakout with controlled risk profile."
      : "Swing strength is exceptional with supportive momentum and manageable risk.";
  } else if (longTermBullish && swing < 6.4) {
    rating = scoreToRating(Math.max(averageScore, 7.2));
    strategy = "Buy Shares";
    confidence = confidence === "Low" ? "Medium" : confidence;
    reason = "Good long-term fundamentals, weak short-term setup.";
  } else if (swing >= 7.5 && momentumBreakout && riskNumeric <= 2) {
    rating = scoreToRating(Math.max(averageScore, 8));
    strategy = "Buy Shares + Calls";
    confidence = confidence === "Low" ? "Medium" : confidence;
    reason = "Bullish swing score plus breakout momentum supports shares and calls.";
  } else if (averageScore >= 8.1 && riskNumeric <= 2 && volatility <= 6.4) {
    rating = scoreToRating(averageScore);
    strategy = "Buy Calls";
    confidence = confidence === "Low" ? "Medium" : confidence;
    reason = "High composite score with contained volatility supports call exposure.";
  } else if (averageScore >= 7.1 && riskNumeric <= 3) {
    rating = scoreToRating(averageScore);
    strategy = riskNumeric <= 2 ? "Buy Shares" : "Starter Size Only";
    reason = strategy === "Buy Shares" ? "Broad score alignment supports share accumulation." : "Bullish score but risk is elevated; size positions carefully.";
  } else if (averageScore >= 5.5) {
    rating = "Watch";
    strategy = riskNumeric >= 3 ? "Watch" : "Starter Size Only";
    confidence = confidence === "High" ? "Medium" : confidence;
    reason = riskNumeric >= 3 ? "Setup needs confirmation before new entries." : "Early setup forming; start small only.";
  } else {
    rating = "Avoid";
    strategy = "Avoid";
    confidence = confidence === "High" ? "Medium" : confidence;
    reason = "Score structure does not support favorable risk/reward.";
  }

  if (volatility >= 7.2 && confidence === "High") {
    confidence = "Medium";
    warningReason = "High volatility despite bullish score.";
  }

  if (riskNumeric >= 3 && confidence === "Low") {
    strategy = "Watch";
    rating = rating === "Strong Buy" ? "Buy" : rating;
    reason = "Risk is elevated while conviction is low; stay on watchlist.";
  }

  if (rating === "Strong Buy" && confidence === "Low") {
    if (warningReason) {
      confidence = "Medium";
    } else {
      confidence = "High";
    }
  }

  return {
    rating,
    confidence,
    risk: input.riskLevel,
    strategy,
    reason: warningReason ? `${reason} ${warningReason}` : reason,
    warningReason,
  };
}
