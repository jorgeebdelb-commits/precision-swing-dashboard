import type { MacroModuleOutput } from "@/lib/intelligence/types/battlefield";
import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";

export function runMacroModule(input: NormalizedSymbolInput): MacroModuleOutput {
  const terrain = input.macroScore >= 7.2 ? "Stable Terrain" : input.macroScore <= 4.5 ? "Risk-Off" : input.atrPercent > 5.8 ? "High Volatility" : "Choppy Market";
  return { terrain, aggressivenessModifier: terrain === "Risk-Off" ? -0.35 : terrain === "Stable Terrain" ? 0.2 : -0.1, optionsRiskModifier: terrain === "High Volatility" || terrain === "Risk-Off" ? 0.4 : 0.1, sectorPressure: input.macroScore >= 6.8 ? "Tailwind" : input.macroScore <= 4.8 ? "Headwind" : "Neutral", volatilityState: input.atrPercent > 5.4 ? "Expansion" : input.atrPercent < 2.5 ? "Compression" : "Normal", macroNotes: ["Macro is support intelligence only."] };
}
