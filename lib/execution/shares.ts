import type { ExecutionInput, SharesDecision } from "@/lib/execution/types";

const clampScore = (value: number) => Math.max(0, Math.min(10, Number(value.toFixed(2))));

export function evaluateShares(input: ExecutionInput): SharesDecision {
  const threeMonth = input.selectedHorizonScores.threeMonth ?? input.threeMonthOutput?.score ?? 5;
  const sixMonth = input.selectedHorizonScores.sixMonth ?? input.sixMonthOutput?.score ?? 5;
  const oneYear = input.selectedHorizonScores.oneYear ?? input.oneYearOutput?.score ?? 5;
  const longTermStrength = (threeMonth + sixMonth + oneYear) / 3;

  const confidenceBoost = input.confidence === "High" ? 0.9 : input.confidence === "Medium" ? 0.35 : -0.65;
  const volatilityPenalty = input.volatilityRisk >= 8.5 ? -0.75 : input.volatilityRisk <= 4 ? 0.35 : 0;
  const base = longTermStrength * 0.52 + input.fundamentalScore * 0.26 + input.technicalScore * 0.12 + input.environmentScore * 0.1;
  const score = clampScore(base + confidenceBoost + volatilityPenalty);

  const rating = score >= 7.4 ? "Strong" : score >= 5.6 ? "Moderate" : "Weak";

  let suggestedAction: SharesDecision["suggestedAction"] = "Avoid Shares";
  if (rating === "Strong") suggestedAction = input.volatilityRisk > 7 ? "Starter Shares Only" : "Buy Shares Now";
  if (rating === "Moderate") suggestedAction = input.volatilityRisk > 7.8 ? "Wait for Pullback" : "Starter Shares Only";

  return {
    vehicle: "shares",
    score,
    rating,
    suggestedAction,
    entryPlan:
      suggestedAction === "Wait for Pullback"
        ? `Wait for retest toward ${input.support ? `$${input.support.toFixed(2)}` : "support"} before adding shares.`
        : `Use staged entries around ${input.entryZone ?? "current zone"}.`,
    stopPlan: `Risk against ${input.stopLoss ?? "planned stop"}; reduce size if close below support.`,
    scalePlan: score >= 7.4 ? "Scale 40/30/30 into strength and constructive pullbacks." : "Keep size light until trend confirms.",
    reason: `Shares favorability is driven by long-horizon strength (${longTermStrength.toFixed(1)}/10) and fundamental quality.`,
  };
}
