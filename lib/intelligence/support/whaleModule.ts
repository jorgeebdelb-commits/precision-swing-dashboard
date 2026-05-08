import type { WhaleModuleOutput } from "@/lib/intelligence/types/battlefield";
import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";

export function runWhaleModule(input: NormalizedSymbolInput): WhaleModuleOutput {
  const trapRisk = input.volumeRatio > 1.9 && input.rsi > 70 ? "High" : input.volumeRatio > 1.4 ? "Moderate" : "Low";
  return {
    trapRisk,
    exhaustionRisk: input.rsi > 72 ? "High" : input.rsi > 64 ? "Moderate" : "Low",
    distributionDetected: input.price > input.resistance && input.flowScore < 5.5,
    unusualFlow: input.flowScore > 7.4 ? "Call Heavy" : input.flowScore < 4.5 ? "Put Heavy" : "Balanced",
    liquidityWarning: input.atrPercent > 6,
    squeezePotential: input.flowScore > 7 && input.volumeRatio > 1.3 ? "High" : "Moderate",
    interpretation: trapRisk === "High" ? "Elevated exhaustion risk after vertical move." : "No major smart-money trap detected.",
  };
}
