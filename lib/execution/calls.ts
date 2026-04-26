import type { CallsDecision, ExecutionInput } from "@/lib/execution/types";

const clampScore = (value: number) => Math.max(0, Math.min(10, Number(value.toFixed(2))));

export function evaluateCalls(input: ExecutionInput): CallsDecision {
  const swing = input.selectedHorizonScores.swing ?? input.swingOutput?.score ?? 5;
  const breakoutBias = input.price >= (input.resistance ?? input.price * 1.03) ? 1 : 0;
  const volumeOk = input.hasVolumeConfirmation ?? input.momentum >= 6;
  const setupPenalty = input.belowVWAP ? -1.2 : 0;
  const riskPenalty = input.eventRiskHigh || input.volatilityRisk > 8.7 ? -1.5 : input.volatilityRisk > 7.5 ? -0.8 : 0;
  const confidencePenalty = input.confidence === "Low" ? -1.1 : 0;

  const score = clampScore(
    swing * 0.34 + input.momentum * 0.26 + input.technicalScore * 0.16 + input.sentimentScore * 0.12 + breakoutBias * 0.8 + (volumeOk ? 0.55 : -0.75) + setupPenalty + riskPenalty + confidencePenalty
  );

  const rating = score >= 7.5 ? "Strong" : score >= 5.5 ? "Moderate" : "Weak";

  let suggestedAction: CallsDecision["suggestedAction"] = "Avoid Calls";
  if (rating === "Strong") suggestedAction = breakoutBias && volumeOk ? "Buy Calls Now" : "Add Calls Only on Breakout";
  if (rating === "Moderate") suggestedAction = input.volatilityRisk > 8 ? "Calls Too Risky" : "Add Calls Only on Breakout";
  if (rating === "Weak" && score >= 4.5 && input.volatilityRisk < 8.7) suggestedAction = "Lotto Only";

  return {
    vehicle: "calls",
    score,
    rating,
    suggestedAction,
    entryTrigger: `Trigger only above ${input.resistance ? `$${input.resistance.toFixed(2)}` : "resistance"} with volume confirmation.`,
    expirationGuidance: "Prefer 30-90 DTE; avoid front-week unless catalyst timing is high-confidence.",
    strikeGuidance: "Favor near-ATM to slight ITM strikes for better delta and less decay.",
    riskPlan: "Cap premium at predefined risk budget; exit if breakout fails or trend loses VWAP.",
    reason: `Calls score reflects swing strength (${swing.toFixed(1)}/10), momentum, and breakout quality.`,
  };
}
