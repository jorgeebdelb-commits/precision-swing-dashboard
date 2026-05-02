import type { RiskLabel } from "../../types/dashboard";

export type ConfidenceLevel = "High" | "Medium" | "Low";
export type RiskLevel = RiskLabel;

export type StrategyRecommendation =
  | "Buy Shares"
  | "Buy Shares + Calls"
  | "Buy Calls"
  | "Starter Shares"
  | "Watch"
  | "Avoid"
  | "Buy Puts"
  | "None";

export type RatingLabel = "Strong Buy" | "Buy" | "Watch" | "Avoid" | "Insufficient Data";

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
  trendConsistency: number;
  volumeConfirmation: number;
  distanceFromResistance: number;
  volatilityStability: number;
  multiTimeframeAgreement: number;
  sectorStrength: number;
  newsClarity: number;
  criticalInputs?: {
    hasPrice: boolean;
    hasVwapWhenRequired: boolean;
    hasFundamentalsForLongHorizon: boolean;
  };
};

export type RecommendationEngineOutput = {
  rating: RatingLabel;
  confidence: ConfidenceLevel;
  risk: RiskLevel;
  strategy: StrategyRecommendation;
  reason: string;
  warningReason?: string;
};

const clamp100 = (value: number): number => Math.max(0, Math.min(100, value));

const normalizeScore100 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const normalized = value <= 10 ? value * 10 : value;
  return clamp100(normalized);
};

const riskToNumeric: Record<RiskLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Extreme: 4,
};

function scoreToRating(score: number): RatingLabel {
  if (score >= 85) return "Strong Buy";
  if (score >= 74) return "Buy";
  if (score >= 55) return "Watch";
  return "Avoid";
}

function baseConfidence(input: RecommendationEngineInput): ConfidenceLevel {
  const horizonScores = [input.swingScore, input.threeMonthScore, input.sixMonthScore, input.oneYearScore];
  const alignmentMin = Math.min(...horizonScores);
  const alignmentMax = Math.max(...horizonScores);
  const spread = alignmentMax - alignmentMin;
  const confidenceComposite =
    input.trendConsistency * 0.2 +
    input.volumeConfirmation * 0.11 +
    input.distanceFromResistance * 0.11 +
    input.volatilityStability * 0.16 +
    input.multiTimeframeAgreement * 0.17 +
    input.sectorStrength * 0.13 +
    input.newsClarity * 0.12;

  const convictionScore =
    input.swingScore * 0.2 +
    input.threeMonthScore * 0.2 +
    input.sixMonthScore * 0.2 +
    input.oneYearScore * 0.16 +
    input.technicalScore * 0.12 +
    input.fundamentalScore * 0.12;

  const volatilityDrag = input.volatility >= 80 ? 5.5 : input.volatility >= 68 ? 3 : 0;
  const adjustedConviction = convictionScore * 0.56 + confidenceComposite * 0.44 - volatilityDrag;

  if (adjustedConviction >= 81 && spread <= 22 && riskToNumeric[input.riskLevel] <= 3) {
    return "High";
  }
  if (adjustedConviction >= 60 && spread <= 44) {
    return adjustedConviction < 65 && input.multiTimeframeAgreement < 54 ? "Low" : "Medium";
  }
  return "Low";
}

export function evaluateRecommendation(input: RecommendationEngineInput): RecommendationEngineOutput {
  const swing = normalizeScore100(input.swingScore);
  const m3 = normalizeScore100(input.threeMonthScore);
  const m6 = normalizeScore100(input.sixMonthScore);
  const y1 = normalizeScore100(input.oneYearScore);
  const technical = normalizeScore100(input.technicalScore);
  const fundamental = normalizeScore100(input.fundamentalScore);
  const momentum = normalizeScore100(input.momentum);
  const volatility = normalizeScore100(input.volatility);
  const whalesIntel = normalizeScore100(input.whalesIntel);

  const averageScore = swing * 0.34 + m3 * 0.24 + m6 * 0.22 + y1 * 0.2;
  const longTermBullish = m3 >= 71 && m6 >= 72 && y1 >= 73 && fundamental >= 65;
  const allWeak = swing < 55 && m3 < 55 && m6 < 55 && y1 < 55;
  const technicalBreakdown = technical <= 48 || (swing <= 52 && momentum <= 48);
  const momentumBreakout = momentum >= 82 && technical >= 76 && whalesIntel >= 72;
  const riskNumeric = riskToNumeric[input.riskLevel];


  const hasCriticalData =
    input.criticalInputs == null ||
    (input.criticalInputs.hasPrice &&
      input.criticalInputs.hasVwapWhenRequired &&
      input.criticalInputs.hasFundamentalsForLongHorizon);

  if (!hasCriticalData) {
    return {
      rating: "Insufficient Data",
      confidence: "Low",
      risk: input.riskLevel,
      strategy: "None",
      reason: "Insufficient critical inputs (price, VWAP, or long-horizon fundamentals).",
      warningReason: "Insufficient Data",
    };
  }

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
  } else if (swing >= 88 && momentum >= 78 && riskNumeric <= 2) {
    rating = "Strong Buy";
    strategy = momentumBreakout ? "Buy Shares + Calls" : "Buy Shares";
    confidence = "High";
    reason = momentumBreakout
      ? "Strong momentum breakout with controlled risk profile."
      : "Swing strength is exceptional with supportive momentum and manageable risk.";
  } else if (longTermBullish && swing < 65) {
    rating = scoreToRating(Math.max(averageScore, 75));
    strategy = "Buy Shares";
    confidence = confidence === "Low" ? "Medium" : confidence;
    reason = "Good long-term fundamentals, weak short-term setup.";
  } else if (swing >= 75 && momentumBreakout && riskNumeric <= 2) {
    rating = scoreToRating(Math.max(averageScore, 82));
    strategy = "Buy Shares + Calls";
    confidence = confidence === "Low" ? "Medium" : confidence;
    reason = "Bullish swing score plus breakout momentum supports shares and calls.";
  } else if (averageScore >= 81 && riskNumeric <= 3 && volatility <= 72) {
    rating = scoreToRating(averageScore);
    strategy = "Buy Calls";
    confidence = confidence === "Low" ? "Medium" : confidence;
    reason = "High composite score with contained volatility supports call exposure.";
  } else if (averageScore >= 69 && riskNumeric <= 3) {
    rating = scoreToRating(averageScore);
    strategy = riskNumeric <= 2 && input.multiTimeframeAgreement >= 62 ? "Buy Shares" : "Starter Shares";
    reason = strategy === "Buy Shares" ? "Broad score alignment supports share accumulation." : "Bullish score but risk is elevated; size positions carefully.";
  } else if (averageScore >= 55) {
    rating = "Watch";
    strategy = riskNumeric >= 3 && averageScore < 63 ? "Watch" : input.trendConsistency >= 64 ? "Starter Shares" : "Watch";
    confidence = confidence === "High" ? "Medium" : confidence;
    reason = riskNumeric >= 3 ? "Setup needs confirmation before new entries." : "Early setup forming; start small only.";
  } else {
    rating = "Avoid";
    strategy = "Avoid";
    confidence = confidence === "High" ? "Medium" : confidence;
    reason = "Score structure does not support favorable risk/reward.";
  }

  const sentimentPenalty = input.sentiment === "Bearish" ? -15 : input.sentiment === "Neutral" ? -5 : 8;
  const technicalBias = technical >= 70 ? 1 : technical <= 45 ? -1 : 0;
  const sentimentBias = sentimentPenalty >= 0 ? 1 : -1;
  const directionalSpread = Math.abs((technical - fundamental));
  const strongConflict = directionalSpread >= 28 && technicalBias !== sentimentBias;

  if (strongConflict) {
    rating = rating === "Strong Buy" ? "Buy" : rating === "Buy" ? "Watch" : rating;
    confidence = confidence === "High" ? "Medium" : "Low";
    if (["Buy Shares + Calls", "Buy Calls", "Buy Puts"].includes(strategy)) strategy = "Starter Shares";
    reason = "Strong signal conflict detected (technical vs sentiment/fundamentals); conviction and aggressiveness reduced.";
  }

  if (volatility >= 78 && confidence === "High") {
    confidence = "Medium";
    warningReason = "High volatility despite bullish score.";
  }

  if (confidence === "Low") {
    if (averageScore > 70 && riskNumeric <= 2) {
      strategy = "Starter Shares";
      rating = rating === "Strong Buy" ? "Buy" : rating;
      reason = "Low confidence gating allows only a small share starter above score 70.";
    } else {
      strategy = "Watch";
      rating = rating === "Strong Buy" ? "Buy" : rating;
      reason = "Low confidence hard gate blocks calls, puts, and aggressive entries.";
    }
  }

  if (riskNumeric >= 3 && confidence === "Low" && averageScore < 73) {
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
