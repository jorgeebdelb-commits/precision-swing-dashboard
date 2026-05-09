import type { WhaleModuleOutput } from "@/lib/intelligence/types/battlefield";
import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";

export function runWhaleModule(input: NormalizedSymbolInput): WhaleModuleOutput {
  const trapRisk = input.volumeRatio > 1.9 && input.rsi > 70 ? "High" : input.volumeRatio > 1.4 ? "Moderate" : "Low";
  const speculativeCallChasing = input.flowScore > 7.6 && input.rsi > 68 && input.atrPercent > 4.8;
  const institutionalAccumulation = input.flowScore > 6.8 && input.volumeRatio >= 1.1 && input.rsi >= 48 && input.rsi <= 65;
  return {
    trapRisk,
    exhaustionRisk: input.rsi > 72 ? "High" : input.rsi > 64 ? "Moderate" : "Low",
    distributionDetected: input.price > input.resistance && input.flowScore < 5.5,
    unusualFlow: input.flowScore > 7.4 ? "Call Heavy" : input.flowScore < 4.5 ? "Put Heavy" : "Balanced",
    liquidityWarning: input.atrPercent > 6,
    squeezePotential: input.flowScore > 7 && input.volumeRatio > 1.3 ? "High" : "Moderate",
    interpretation: speculativeCallChasing
      ? "Options flow appears chase-heavy and tactical, not durable accumulation."
      : institutionalAccumulation
      ? "Flow profile is consistent with measured institutional accumulation."
      : trapRisk === "High"
      ? "Elevated exhaustion risk after vertical move."
      : "No major smart-money trap detected.",
    flowCharacter: speculativeCallChasing
      ? "Speculative Call Chasing"
      : institutionalAccumulation
      ? "Institutional Accumulation"
      : input.flowScore < 4.6
      ? "Distribution / Hedge Flow"
      : "Mixed",
  };
}
