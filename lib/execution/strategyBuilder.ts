import type { ExecutionInput, ExecutionStrategyPlan } from "@/lib/execution/types";
import { evaluateCalls } from "@/lib/execution/calls";
import { evaluatePuts } from "@/lib/execution/puts";
import { evaluateShares } from "@/lib/execution/shares";

function deriveRisk(input: ExecutionInput): ExecutionStrategyPlan["risk"] {
  if (input.volatilityRisk >= 8.6) return "Extreme";
  if (input.volatilityRisk >= 7) return "High";
  if (input.volatilityRisk >= 4.8) return "Medium";
  return "Low";
}

export function buildExecutionStrategy(input: ExecutionInput): ExecutionStrategyPlan {
  const sharesPlan = evaluateShares(input);
  const callsPlan = evaluateCalls(input);
  const putsPlan = evaluatePuts(input);
  const risk = deriveRisk(input);

  let finalStrategy: ExecutionStrategyPlan["finalStrategy"] = "Watch";
  let selectedVehicle: ExecutionStrategyPlan["selectedVehicle"] = "none";
  const sequencing: string[] = [];
  const invalidationRules: string[] = [];

  if (sharesPlan.rating === "Strong" && callsPlan.rating === "Strong") {
    finalStrategy = "Buy Shares + Calls";
    selectedVehicle = "combo";
    sequencing.push("Buy shares now.", "Add calls only if price breaks resistance with volume.");
  } else if (sharesPlan.rating !== "Weak" && callsPlan.suggestedAction === "Watch") {
    finalStrategy = "Starter Shares + Calls on Breakout";
    selectedVehicle = "combo";
    sequencing.push("Buy starter shares now.", "Add calls only on confirmed breakout above resistance.");
  } else if (sharesPlan.rating === "Strong") {
    finalStrategy = "Buy Shares";
    selectedVehicle = "shares";
    sequencing.push("Accumulate shares in planned entry zone.");
  } else if (callsPlan.rating === "Strong") {
    finalStrategy = "Buy Calls";
    selectedVehicle = "calls";
    sequencing.push("Take calls only with breakout confirmation.");
  } else if (putsPlan.rating === "Strong") {
    finalStrategy = "Buy Puts";
    selectedVehicle = "puts";
    sequencing.push("Buy puts only after support break confirms.");
  } else if (sharesPlan.rating === "Moderate" && putsPlan.rating === "Moderate" && risk === "High") {
    finalStrategy = "Hedge Only";
    selectedVehicle = "combo";
    sequencing.push("Initiate small share position.", "Layer protective put if support weakens.");
  } else if (sharesPlan.rating === "Weak" && callsPlan.rating === "Weak" && putsPlan.rating === "Weak") {
    finalStrategy = "Avoid";
    selectedVehicle = "none";
    sequencing.push("No trade until cleaner setup emerges.");
  }

  invalidationRules.push(
    `Reduce or exit if stop ${input.stopLoss ?? "level"} is violated.`,
    "Do not add calls while price is below VWAP / trend support.",
    "Only add puts if support breaks with momentum."
  );

  return {
    symbol: input.symbol,
    finalStrategy,
    action: finalStrategy,
    sharesPlan,
    callsPlan,
    putsPlan,
    sequencing,
    confidence: input.confidence,
    risk,
    reason: `Execution strategy selected from independent shares/calls/puts modules for ${input.symbol}.`,
    invalidationRules,
    selectedVehicle,
  };
}
