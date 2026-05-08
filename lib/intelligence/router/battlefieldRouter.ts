import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";
import { runLongEngine } from "@/lib/intelligence/core/longEngine";
import { runSwingEngine } from "@/lib/intelligence/core/swingEngine";
import { buildCapitalDeployment } from "@/lib/intelligence/deployment/capitalDeployment";
import { runMacroModule } from "@/lib/intelligence/support/macroModule";
import { runPoliticsModule } from "@/lib/intelligence/support/politicsModule";
import { runSentimentModule } from "@/lib/intelligence/support/sentimentModule";
import { runWhaleModule } from "@/lib/intelligence/support/whaleModule";
import type { BattlefieldOutput } from "@/lib/intelligence/types/battlefield";

export function routeBattlefield(input: NormalizedSymbolInput): BattlefieldOutput {
  console.log("[battlefieldRouter] input symbol:", input.symbol);
  const swing = runSwingEngine(input);
  const longTerm = runLongEngine(input);
  const whale = runWhaleModule(input);
  const macro = runMacroModule(input);
  const politics = runPoliticsModule(input);
  const sentiment = runSentimentModule(input);
  const deployment = buildCapitalDeployment(swing, longTerm, whale, macro, sentiment);
  const primaryOpportunity: BattlefieldOutput["primaryOpportunity"] = swing.bias === "Swing Buy" && (longTerm.bias === "Long Buy" || longTerm.bias === "LEAP Candidate") ? "Both" : swing.bias === "Swing Buy" ? "Swing" : longTerm.bias === "Long Buy" || longTerm.bias === "Shares Preferred" ? "Long-Term" : "Neither";
  const warnings = [whale.trapRisk === "High" ? "High Trap Risk" : "", macro.terrain === "Risk-Off" ? "Risk-Off terrain: reduce aggressiveness" : "", sentiment.sentimentState === "Hype Risk" ? "Hype risk: avoid chasing calls" : ""].filter(Boolean);
  const output = { symbol: input.symbol, swing, longTerm, whale, macro, politics, sentiment, battlefieldSummary: `${input.symbol}: ${primaryOpportunity} opportunity with ${warnings.length ? "active warnings" : "balanced conditions"}.`, primaryOpportunity, warnings, confidenceAdjustment: Math.round((macro.aggressivenessModifier * 10 - (whale.trapRisk === "High" ? 12 : 0))), deployment };
  console.log("[battlefieldRouter] output summary:", {
    symbol: output.symbol,
    swingBias: output.swing.bias,
    longBias: output.longTerm.bias,
    primaryOpportunity: output.primaryOpportunity,
  });
  return output;
}
