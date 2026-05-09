import type { BattlefieldOutput, MarketTerrain } from "@/lib/intelligence/types/battlefield";

export type BattlefieldState = "Stable Expansion" | "Controlled Momentum" | "Choppy Accumulation" | "Trap-Prone Momentum" | "High-Risk Expansion" | "Weak Trend Environment" | "No Edge";
export type PrimaryOpportunity = "Swing" | "Long-Term" | "Both" | "Neither";
export type AllocationBias = "Shares Preferred" | "Calls Allowed" | "Puts Conditional" | "LEAPS Preferred" | "Starter Only" | "Watch Only" | "Avoid";

export interface ResolvedBattlefieldState {
  symbol: string;
  battlefieldState: BattlefieldState;
  primaryOpportunity: PrimaryOpportunity;
  confidenceAdjusted: number;
  deploymentPermission: {
    sharesAllowed: boolean;
    callsAllowed: boolean;
    putsAllowed: boolean;
    leapsAllowed: boolean;
    reason: string;
  };
  riskFlags: string[];
  tacticalSummary: string;
  allocationBias: AllocationBias;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const isHostileTerrain = (terrain: MarketTerrain) => terrain === "Risk-Off" || terrain === "Unstable Ground";
const supportsWeakness = (terrain: MarketTerrain) => terrain === "Risk-Off" || terrain === "Unstable Ground" || terrain === "Choppy Market";

export function resolveBattlefieldState(input: Pick<BattlefieldOutput, "symbol" | "price" | "swing" | "longTerm" | "whale" | "macro" | "politics" | "sentiment" | "deployment">): ResolvedBattlefieldState {
  const riskFlags: string[] = [];
  const trapRisk = input.whale.trapRisk;
  const highTrapRisk = trapRisk === "High";
  const terrain = input.macro.terrain;
  const politicalHostile = input.politics.politicalRisk === "High" || input.politics.regulatoryRisk === "High";
  const hypeRisk = input.sentiment.sentimentState === "Hype Risk";

  const swingSignal = input.swing.bias === "Swing Buy" || input.swing.bias === "Swing Put Opportunity";
  const swingConfidenceOk = input.swing.confidence >= 55;
  const swingValid = swingSignal && swingConfidenceOk && !isHostileTerrain(terrain) && !highTrapRisk;

  const longBiasValid = ["Long Buy", "Shares Preferred", "LEAP Candidate"].includes(input.longTerm.bias);
  const longQualityValid = input.longTerm.longTermQuality === "Moderate" || input.longTerm.longTermQuality === "Strong";
  const longValid = longBiasValid && longQualityValid && !politicalHostile;

  let primaryOpportunity: PrimaryOpportunity = "Neither";
  if (swingValid && longValid) primaryOpportunity = "Both";
  else if (swingValid) primaryOpportunity = "Swing";
  else if (longValid) primaryOpportunity = "Long-Term";

  let confidence = Math.max(input.swing.confidence, input.longTerm.confidence);
  if (highTrapRisk) confidence -= 20;
  if (trapRisk === "Moderate") confidence -= 10;
  if (hypeRisk) confidence -= 15;
  if (terrain === "Choppy Market") confidence -= 10;
  if (terrain === "Risk-Off" || terrain === "Unstable Ground") confidence -= 20;
  if (politicalHostile) confidence -= 10;
  if (input.longTerm.longTermQuality === "Strong") confidence += 5;
  if (terrain === "Stable Terrain") confidence += 5;
  if (trapRisk === "Low") confidence += 5;
  const confidenceAdjusted = clamp(confidence);

  if (highTrapRisk) riskFlags.push("Elevated trap risk — avoid chasing momentum.");
  if (hypeRisk) riskFlags.push("Crowding/hype risk detected.");
  if (terrain === "Choppy Market") riskFlags.push("Choppy market — reduce position size.");
  if (terrain === "Risk-Off" || terrain === "Unstable Ground") riskFlags.push("Risk-off regime — aggressive deployment restricted.");
  if (politicalHostile) riskFlags.push("High political/regulatory risk present.");

  const callsAllowed = swingValid && !highTrapRisk && !hypeRisk && !isHostileTerrain(terrain) && terrain !== "Choppy Market";
  const putsAllowed = input.swing.bias === "Swing Put Opportunity" || (input.swing.breakoutQuality === "Failed" && supportsWeakness(terrain));
  const leapsAllowed = (input.longTerm.bias === "LEAP Candidate" || input.longTerm.longTermQuality === "Strong") && input.longTerm.confidence >= 65;
  const sharesAllowed = longValid || swingValid;

  let allocationBias: AllocationBias = "Watch Only";
  if (primaryOpportunity === "Both") allocationBias = callsAllowed ? "Calls Allowed" : "Shares Preferred";
  if (primaryOpportunity === "Long-Term") allocationBias = leapsAllowed ? "LEAPS Preferred" : "Shares Preferred";
  if (primaryOpportunity === "Swing") allocationBias = callsAllowed ? "Calls Allowed" : highTrapRisk ? "Starter Only" : "Shares Preferred";
  if (primaryOpportunity === "Neither") allocationBias = isHostileTerrain(terrain) || highTrapRisk ? "Watch Only" : "Starter Only";
  if (hypeRisk && allocationBias === "Calls Allowed") allocationBias = "Starter Only";

  let tacticalSummary = "No clear directional edge; remain selective and capital-preserving.";
  if (primaryOpportunity === "Long-Term" && !swingValid && longValid) {
    tacticalSummary = "Long-term structure is favorable, but short-term timing is weak.";
    riskFlags.push("Calls blocked until swing conditions improve.");
  } else if (primaryOpportunity === "Swing" && !longValid) {
    tacticalSummary = "Swing momentum is tradable, while long-term structure remains weak.";
  } else if (primaryOpportunity === "Both") {
    tacticalSummary = "Swing and long-term structure align; deploy with measured risk.";
  }

  const battlefieldState: BattlefieldState = highTrapRisk
    ? "Trap-Prone Momentum"
    : isHostileTerrain(terrain)
      ? "High-Risk Expansion"
      : terrain === "Choppy Market"
        ? "Choppy Accumulation"
        : primaryOpportunity === "Neither"
          ? "No Edge"
          : primaryOpportunity === "Both"
            ? "Stable Expansion"
            : primaryOpportunity === "Swing"
              ? "Controlled Momentum"
              : "Weak Trend Environment";

  const reason = callsAllowed
    ? "Calls permitted: swing setup is valid with acceptable trap/sentiment/macro risk."
    : allocationBias === "Watch Only"
      ? "Watch-only posture: macro/trap conditions are unfavorable."
      : allocationBias === "Starter Only"
        ? "Starter-only posture: risk conditions require reduced aggressiveness."
        : "Options blocked pending better setup quality and risk alignment.";

  return {
    symbol: input.symbol,
    battlefieldState,
    primaryOpportunity,
    confidenceAdjusted,
    deploymentPermission: { sharesAllowed, callsAllowed, putsAllowed, leapsAllowed, reason },
    riskFlags,
    tacticalSummary,
    allocationBias,
  };
}
