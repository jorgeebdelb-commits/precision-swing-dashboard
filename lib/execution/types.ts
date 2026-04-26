import type { ConfidenceLevel, RiskLevel } from "@/lib/intelligence/types";

export type ExecutionVehicle = "shares" | "calls" | "puts";
export type ExecutionRating = "Strong" | "Moderate" | "Weak";
export type SharesAction = "Buy Shares" | "Starter Shares" | "Watch" | "Avoid";
export type CallsAction = "Buy Calls" | "Watch" | "Avoid";
export type PutsAction = "Buy Puts Now" | "Add Puts Only Below Support" | "Hedge Only" | "Avoid Puts";

export type FinalExecutionStrategy =
  | "Buy Shares"
  | "Buy Calls"
  | "Buy Puts"
  | "Buy Shares + Calls"
  | "Starter Shares"
  | "Starter Shares + Calls on Breakout"
  | "Hedge Only"
  | "Watch"
  | "Avoid";

export interface HorizonOutput {
  horizon: "swing" | "threeMonth" | "sixMonth" | "oneYear";
  score: number;
  rating: string;
  strategy?: string;
  reason?: string;
}

export interface ExecutionInput {
  symbol: string;
  price: number;
  sector?: string;
  selectedHorizonScores: Partial<Record<"swing" | "threeMonth" | "sixMonth" | "oneYear", number>>;
  swingOutput?: HorizonOutput;
  threeMonthOutput?: HorizonOutput;
  sixMonthOutput?: HorizonOutput;
  oneYearOutput?: HorizonOutput;
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  environmentScore: number;
  momentum: number;
  volatilityRisk: number;
  confidence: ConfidenceLevel;
  support?: number;
  resistance?: number;
  entryZone?: string;
  stopLoss?: string;
  targetPrices?: string[];
  catalystContext?: string;
  hasVolumeConfirmation?: boolean;
  belowVWAP?: boolean;
  eventRiskHigh?: boolean;
}

export interface SharesDecision {
  vehicle: "shares";
  score: number;
  rating: ExecutionRating;
  suggestedAction: SharesAction;
  entryPlan: string;
  stopPlan: string;
  scalePlan: string;
  reason: string;
}

export interface CallsDecision {
  vehicle: "calls";
  score: number;
  rating: ExecutionRating;
  suggestedAction: CallsAction;
  entryTrigger: string;
  expirationGuidance: string;
  strikeGuidance: string;
  riskPlan: string;
  reason: string;
}

export interface PutsDecision {
  vehicle: "puts";
  score: number;
  rating: ExecutionRating;
  suggestedAction: PutsAction;
  breakdownTrigger: string;
  expirationGuidance: string;
  strikeGuidance: string;
  riskPlan: string;
  reason: string;
}

export interface ExecutionStrategyPlan {
  symbol: string;
  finalStrategy: FinalExecutionStrategy;
  action: string;
  sharesPlan: SharesDecision;
  callsPlan: CallsDecision;
  putsPlan: PutsDecision;
  sequencing: string[];
  confidence: ConfidenceLevel;
  risk: RiskLevel;
  reason: string;
  invalidationRules: string[];
  selectedVehicle: ExecutionVehicle | "combo" | "none";
}

export interface ExecutionSignalRecord {
  id?: string;
  symbol: string;
  horizon: string;
  finalStrategy: string;
  sharesScore: number;
  callsScore: number;
  putsScore: number;
  sharesAction: string;
  callsAction: string;
  putsAction: string;
  selectedVehicle: string;
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  confidence: string;
  risk: string;
  reason: string;
  refreshSession?: string;
  createdAt?: string;
  evaluatedAt?: string | null;
  outcomeReturn?: number | null;
  outcomeStatus?: string | null;
  modelVersion?: string;
  sector?: string | null;
}

export interface ExecutionWeightState {
  sharesWeight: number;
  callsWeight: number;
  putsWeight: number;
}
