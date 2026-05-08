import type { LongEngineOutput, SymbolInput } from "@/lib/intelligence/types/battlefield";

export function runLongEngine(input: SymbolInput): LongEngineOutput {
  const quality = input.fundamentalsScore >= 7.2 ? "Strong" : input.fundamentalsScore >= 5.6 ? "Moderate" : "Weak";
  let bias: LongEngineOutput["bias"] = "Long Watch";
  if (quality === "Strong") bias = input.macroScore >= 6 ? "Long Buy" : "Shares Preferred";
  if (quality === "Moderate" && input.fundamentalsScore >= 6.4) bias = "LEAP Candidate";
  if (quality === "Weak") bias = "Long Avoid";
  return {
    symbol: input.symbol,
    bias,
    confidence: Math.max(35, Math.min(90, Math.round(input.fundamentalsScore * 10 + input.macroScore * 2))),
    longTermQuality: quality,
    accumulationZone: `${(input.support * 0.98).toFixed(2)} - ${(input.support * 1.04).toFixed(2)}`,
    expected3M: "4% to 9%",
    expected6M: "8% to 16%",
    expected1Y: "12% to 28%",
    leapSuitability: bias === "LEAP Candidate" || bias === "Long Buy" ? "High" : quality === "Moderate" ? "Moderate" : "Low",
    institutionalStrength: input.flowScore >= 7 ? "Strong" : input.flowScore >= 5.8 ? "Moderate" : "Weak",
    fundamentalDrivers: ["Revenue durability", "Margin trajectory", "Sector leadership context"],
  };
}
