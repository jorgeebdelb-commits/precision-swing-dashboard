import type { ExecutionInput, PutsDecision } from "@/lib/execution/types";

const clampScore = (value: number) => Math.max(0, Math.min(10, Number(value.toFixed(2))));

export function evaluatePuts(input: ExecutionInput): PutsDecision {
  const swing = input.selectedHorizonScores.swing ?? input.swingOutput?.score ?? 5;
  const bearishTech = 10 - input.technicalScore;
  const bearishFundamental = 10 - input.fundamentalScore;
  const bearishSentiment = 10 - input.sentimentScore;
  const supportBroken = input.price < (input.support ?? input.price * 0.97);
  const bullishTrendGuard = input.selectedHorizonScores.sixMonth && input.selectedHorizonScores.sixMonth > 7.4 ? -1.3 : 0;

  const score = clampScore(
    bearishTech * 0.3 + bearishFundamental * 0.22 + bearishSentiment * 0.2 + (10 - input.environmentScore) * 0.12 + (10 - swing) * 0.12 + (supportBroken ? 0.9 : -0.45) + bullishTrendGuard
  );

  const rating = score >= 7.2 ? "Strong" : score >= 5.4 ? "Moderate" : "Weak";
  let suggestedAction: PutsDecision["suggestedAction"] = "Avoid Puts";
  if (rating === "Strong") suggestedAction = supportBroken ? "Buy Puts Now" : "Add Puts Only Below Support";
  if (rating === "Moderate") suggestedAction = supportBroken ? "Add Puts Only Below Support" : "Hedge Only";

  return {
    vehicle: "puts",
    score,
    rating,
    suggestedAction,
    breakdownTrigger: `Only trigger if price breaks ${input.support ? `$${input.support.toFixed(2)}` : "key support"} with downside follow-through.`,
    expirationGuidance: "Use 21-60 DTE for tactical downside; avoid overpaying in volatility spikes.",
    strikeGuidance: "Favor ATM to slight OTM puts when breakdown confirms.",
    riskPlan: "Treat as tactical unless trend regime turns fully bearish.",
    reason: "Puts are prioritized when breakdowns, bearish momentum, and weak internals align.",
  };
}
