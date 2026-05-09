import type { LongEngineOutput } from "@/lib/intelligence/types/battlefield";
import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";

export function runLongEngine(input: NormalizedSymbolInput): LongEngineOutput {
  const symbol = input.symbol.toUpperCase();
  const compounders = new Set(["MSFT", "AMZN", "GOOGL", "META"]);
  const speculative = new Set(["ACHR", "JOBY", "QBTS", "QUBT", "IONQ"]);
  const cyclical = new Set(["MARA", "RIOT", "MP"]);
  const aiLeaders = new Set(["NVDA", "PLTR"]);
  const assetCharacterClass: LongEngineOutput["assetCharacterClass"] = compounders.has(symbol)
    ? "Institutional Compounder"
    : speculative.has(symbol)
    ? "High-Growth Speculative"
    : cyclical.has(symbol)
    ? "Cyclical Momentum"
    : aiLeaders.has(symbol)
    ? "AI Momentum Leader"
    : input.atrPercent > 7 || input.volatility > 7.5
    ? "Distressed / High Volatility"
    : "Institutional Compounder";

  const quality = input.fundamentalsScore >= 7.2 ? "Strong" : input.fundamentalsScore >= 5.6 ? "Moderate" : "Weak";
  const speculativeRiskScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.atrPercent * 7 +
          Math.max(0, input.rsi - 60) * 1.4 +
          Math.max(0, (input.volumeRatio - 1) * 18) +
          (assetCharacterClass === "High-Growth Speculative" ? 24 : 0) +
          (assetCharacterClass === "Cyclical Momentum" ? 16 : 0) +
          (assetCharacterClass === "Distressed / High Volatility" ? 22 : 0) +
          (quality === "Weak" ? 14 : 0)
      )
    )
  );
  let bias: LongEngineOutput["bias"] = "Long Watch";
  if (quality === "Strong") bias = input.macroScore >= 6 ? "Long Buy" : "Shares Preferred";
  if (quality === "Moderate" && input.fundamentalsScore >= 6.4) bias = "LEAP Candidate";
  if (quality === "Weak") bias = "Long Avoid";
  const institutionalStrength = input.flowScore >= 7 ? "Strong" : input.flowScore >= 5.8 ? "Moderate" : "Weak";
  const eliteConvictionEligible =
    assetCharacterClass === "Institutional Compounder" &&
    quality === "Strong" &&
    institutionalStrength === "Strong" &&
    input.macroScore >= 6 &&
    speculativeRiskScore <= 42;
  const durationConfidence = Math.max(35, Math.min(92, Math.round(input.fundamentalsScore * 9 + input.macroScore * 2 - speculativeRiskScore * 0.18)));
  const swingConfidence = Math.max(25, Math.min(90, Math.round(input.technicalScore * 8 + input.sentimentScore * 2 - speculativeRiskScore * 0.14)));
  const longDurationClass: LongEngineOutput["longDurationClass"] =
    assetCharacterClass === "Institutional Compounder" && quality === "Strong"
      ? "Institutional Accumulation"
      : assetCharacterClass === "High-Growth Speculative"
      ? "High-Risk Growth"
      : assetCharacterClass === "Cyclical Momentum"
      ? "Cyclical Recovery"
      : assetCharacterClass === "AI Momentum Leader" && speculativeRiskScore <= 52
      ? "Momentum Expansion"
      : speculativeRiskScore >= 68
      ? "Speculative Accumulation"
      : "Tactical Long";

  return {
    symbol: input.symbol,
    bias,
    confidence: Math.max(35, Math.min(88, durationConfidence)),
    longTermQuality: quality,
    accumulationZone: `${(input.support * 0.98).toFixed(2)} - ${(input.support * 1.04).toFixed(2)}`,
    expected3M: "4% to 9%",
    expected6M: "8% to 16%",
    expected1Y: "12% to 28%",
    leapSuitability: speculativeRiskScore >= 68 ? "Low" : bias === "LEAP Candidate" || bias === "Long Buy" ? "High" : quality === "Moderate" ? "Moderate" : "Low",
    institutionalStrength,
    fundamentalDrivers: ["Revenue durability", "Margin trajectory", "Sector leadership context"],
    assetCharacterClass,
    longDurationClass,
    speculativeRiskScore,
    eliteConvictionEligible,
    durationConfidence,
    swingConfidence,
    convictionLabel: eliteConvictionEligible ? "Elite Conviction" : speculativeRiskScore >= 65 ? "Speculative Accumulation" : quality === "Strong" ? "High Potential" : "Tactical",
  };
}
