export type SwingBias = "Swing Buy" | "Swing Watch" | "Swing Avoid" | "Swing Put Opportunity" | "No Trade";
export type LongBias = "Long Buy" | "Long Watch" | "Long Avoid" | "LEAP Candidate" | "Shares Preferred";
export type AssetCharacterClass = "Institutional Compounder" | "High-Growth Speculative" | "Cyclical Momentum" | "AI Momentum Leader" | "Distressed / High Volatility";
export type LongDurationClassification =
  | "Institutional Accumulation"
  | "Tactical Long"
  | "Speculative Accumulation"
  | "Momentum Expansion"
  | "High-Risk Growth"
  | "Cyclical Recovery"
  | "Defensive Compounder";
export type MarketTerrain = "Stable Terrain" | "Risk-Off" | "Momentum Expansion" | "High Volatility" | "Unstable Ground" | "Choppy Market";
export type BattlefieldRiskLevel = "Low" | "Moderate" | "High";
export interface SymbolInput { symbol: string; price: number; support: number; resistance: number; lr50: number; lr100: number; vwap: number; rsi: number; atrPercent: number; volumeRatio: number; technicalScore: number; fundamentalsScore: number; macroScore: number; politicalScore: number; sentimentScore: number; flowScore: number; }
export interface SwingEngineOutput { symbol: string; bias: SwingBias; confidence: number; momentumQuality: "Strong"|"Moderate"|"Weak"; entryZone: string; stopZone: string; target1: string; target2: string; breakoutQuality: "Clean"|"Questionable"|"Failed"|"None"; riskReward: string; executionNotes: string[]; }
export interface LongEngineOutput { symbol: string; bias: LongBias; confidence: number; longTermQuality: "Strong"|"Moderate"|"Weak"; accumulationZone: string; expected3M: string; expected6M: string; expected1Y: string; leapSuitability: "High"|"Moderate"|"Low"; institutionalStrength: "Strong"|"Moderate"|"Weak"; fundamentalDrivers: string[]; assetCharacterClass: AssetCharacterClass; longDurationClass: LongDurationClassification; speculativeRiskScore: number; eliteConvictionEligible: boolean; durationConfidence: number; swingConfidence: number; convictionLabel: "Elite Conviction" | "High Potential" | "Speculative Accumulation" | "Tactical"; }
export interface WhaleModuleOutput { trapRisk: BattlefieldRiskLevel; exhaustionRisk: BattlefieldRiskLevel; distributionDetected: boolean; unusualFlow: "Call Heavy"|"Put Heavy"|"Balanced"|"None"; liquidityWarning: boolean; squeezePotential: BattlefieldRiskLevel; interpretation: string; flowCharacter: "Institutional Accumulation" | "Speculative Call Chasing" | "Distribution / Hedge Flow" | "Mixed"; }
export interface MacroModuleOutput { terrain: MarketTerrain; aggressivenessModifier: number; optionsRiskModifier: number; sectorPressure: "Tailwind"|"Neutral"|"Headwind"; volatilityState: "Expansion"|"Normal"|"Compression"; macroNotes: string[]; }
export interface PoliticsModuleOutput { politicalRisk: BattlefieldRiskLevel; regulatoryRisk: BattlefieldRiskLevel; geopoliticalPressure: BattlefieldRiskLevel; policyTailwind: boolean; interpretation: string; }
export interface SentimentModuleOutput { sentimentState: "Positive"|"Neutral"|"Negative"|"Crowded"|"Hype Risk"; confirmationStrength: "Strong"|"Moderate"|"Weak"; crowdingRisk: BattlefieldRiskLevel; interpretation: string; }
export interface CapitalDeploymentOutput { bestDeployment: "Buy Shares"|"Buy Calls"|"Buy Puts"|"Buy LEAPS"|"Starter Position"|"Wait for Pullback"|"Watch Only"|"No Trade"; preferredInstrument: "Shares"|"Calls"|"Puts"|"LEAPS"|"None"; entryRange: string; stopRange: string; targetRange: string; expectedMove: string; estimatedReturn: string; riskReward: string; sizingAggressiveness: "Full Size"|"Half Size"|"Starter Only"|"Watch Only"|"Avoid"; deploymentReason: string; }
export interface BattlefieldOutput { symbol: string; price: number; priceTimestamp?: string | null; marketDataState?: "live" | "cached" | "offline"; staleData?: boolean; marketDataProvider?: string; lastQuoteSuccessAt?: string | null; lastQuoteError?: string | null; providerLatencyMs?: number | null; quoteRetryCount?: number | null; staleAgeSeconds?: number | null; quoteQuotaStatus?: string | null; quoteIntegrityScore?: number; quoteSuspect?: boolean; swing: SwingEngineOutput; longTerm: LongEngineOutput; whale: WhaleModuleOutput; macro: MacroModuleOutput; politics: PoliticsModuleOutput; sentiment: SentimentModuleOutput; battlefieldSummary: string; primaryOpportunity: "Swing"|"Institutional Accumulation"|"Tactical Long"|"Both"|"Watch"|"Neither"; warnings: string[]; confidenceAdjustment: number; deployment: CapitalDeploymentOutput; signalAttribution?: SignalAttribution; tradeOutcome?: OutcomeLabel | null; }
export interface SignalAttribution { technicalWeight: number; macroWeight: number; sentimentWeight: number; whaleWeight: number; politicalWeight: number; }
export type OutcomeLabel = "worked" | "stopped_out" | "target_hit" | "wrong_instrument";
export interface BattlefieldApiResponse { items: BattlefieldOutput[]; generatedAt: string; source: "cache"|"fresh"; }
