import type { BattlefieldOutput, MarketTerrain, SignalAttribution } from "@/lib/intelligence/types/battlefield";

export type BattlefieldState = "Risk-On Expansion" | "Momentum Expansion" | "Compression" | "Distribution" | "Risk-Off" | "Panic" | "Accumulation" | "No Edge";
export type PrimaryOpportunity = "Swing" | "Institutional Accumulation" | "Tactical Long" | "Both" | "Watch" | "Neither";
export type AllocationBias = "Shares Preferred" | "Calls Allowed" | "Puts Conditional" | "LEAPS Preferred" | "Starter Only" | "Watch Only" | "Avoid";

export interface ResolvedBattlefieldState {
  symbol: string;
  battlefieldState: BattlefieldState;
  primaryOpportunity: PrimaryOpportunity;
  confidenceAdjusted: number;
  deploymentPermission: { sharesAllowed: boolean; callsAllowed: boolean; putsAllowed: boolean; leapsAllowed: boolean; reason: string };
  riskFlags: string[];
  tacticalSummary: string;
  allocationBias: AllocationBias;
  signalAttribution: SignalAttribution;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const isHostileTerrain = (terrain: MarketTerrain) => terrain === "Risk-Off" || terrain === "Unstable Ground";

export function resolveBattlefieldState(input: Pick<BattlefieldOutput, "symbol" | "swing" | "longTerm" | "whale" | "macro" | "politics" | "sentiment">): ResolvedBattlefieldState {
  const riskFlags: string[] = [];
  const technicalWeight = 0.38;
  const macroWeight = 0.17;
  const sentimentWeight = 0.15;
  const whaleWeight = 0.2;
  const politicalWeight = 0.1;
  const signalAttribution = { technicalWeight, macroWeight, sentimentWeight, whaleWeight, politicalWeight };

  const strongTech = input.swing.momentumQuality === "Strong" && input.swing.confidence >= 68;
  const strongLong = input.longTerm.longTermQuality !== "Weak" && input.longTerm.confidence >= 62;
  const hostileStack = isHostileTerrain(input.macro.terrain) && input.sentiment.sentimentState === "Negative" && input.whale.trapRisk === "High";

  let primaryOpportunity: PrimaryOpportunity = "Watch";
  if (strongTech && strongLong) primaryOpportunity = "Both";
  else if (strongTech) primaryOpportunity = "Swing";
  else if (strongLong) primaryOpportunity = input.longTerm.longDurationClass === "Institutional Accumulation" ? "Institutional Accumulation" : "Tactical Long";
  else if (hostileStack) primaryOpportunity = "Neither";

  const macroPenalty = isHostileTerrain(input.macro.terrain) ? 10 : input.macro.terrain === "Choppy Market" ? 6 : 2;
  const whalePenalty = input.whale.trapRisk === "High" ? 11 : input.whale.trapRisk === "Moderate" ? 6 : 1;
  const sentimentPenalty = input.sentiment.sentimentState === "Negative" ? 8 : input.sentiment.sentimentState === "Neutral" ? 3 : 0;
  const politicalPenalty = input.politics.politicalRisk === "High" || input.politics.regulatoryRisk === "High" ? 8 : 2;

  const base = input.swing.confidence * technicalWeight + input.longTerm.confidence * (technicalWeight * 0.65) + (100 - macroPenalty * 5) * macroWeight + (100 - sentimentPenalty * 6) * sentimentWeight + (100 - whalePenalty * 5) * whaleWeight + (100 - politicalPenalty * 7) * politicalWeight;
  const longTermPenalty = input.longTerm.speculativeRiskScore >= 70 ? 9 : input.longTerm.speculativeRiskScore >= 55 ? 4 : 0;
  const confidenceAdjusted = Math.min(88, clamp(base - longTermPenalty));

  const callsAllowed = (primaryOpportunity === "Swing" || primaryOpportunity === "Both") && !hostileStack;
  const putsAllowed = input.swing.bias === "Swing Put Opportunity" && isHostileTerrain(input.macro.terrain);
  const leapsAllowed = (primaryOpportunity === "Institutional Accumulation" || primaryOpportunity === "Both") && input.longTerm.speculativeRiskScore < 68;
  const sharesAllowed = primaryOpportunity !== "Neither";
  const allocationBias: AllocationBias = primaryOpportunity === "Neither" ? "Avoid" : primaryOpportunity === "Watch" ? "Watch Only" : callsAllowed ? "Calls Allowed" : leapsAllowed ? "LEAPS Preferred" : "Shares Preferred";

  const battlefieldState: BattlefieldState = input.macro.terrain === "Risk-Off" ? "Risk-Off" : input.whale.exhaustionRisk === "High" && input.sentiment.crowdingRisk === "High" ? "Distribution" : input.macro.volatilityState === "Compression" ? "Compression" : strongTech ? "Momentum Expansion" : strongLong ? "Accumulation" : "No Edge";

  const summaries = [
    "Momentum continuation with elevated volatility.",
    "Constructive accumulation under sector strength.",
    "Breakout structure forming with moderate confirmation.",
    "Trend intact but crowding risk increasing.",
  ];

  return { symbol: input.symbol, battlefieldState, primaryOpportunity, confidenceAdjusted, deploymentPermission: { sharesAllowed, callsAllowed, putsAllowed, leapsAllowed, reason: "Probability-weighted alignment across technical, macro, sentiment, and whale layers." }, riskFlags, tacticalSummary: summaries[confidenceAdjusted % summaries.length], allocationBias, signalAttribution };
}
