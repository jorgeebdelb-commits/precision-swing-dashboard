export type Direction = "Swing Buy" | "Swing Watch" | "Swing Avoid" | "Swing Put Opportunity" | "No Trade";
export type LongDirection = "Long Buy" | "Long Watch" | "Long Avoid" | "LEAP Candidate" | "Shares Preferred";

export type SwingSignals = {
  trend: number;
  momentum: number;
  volume: number;
  rsi: number;
  atr: number;
  vwapDelta: number;
  breakoutQuality: number;
  rejectionRisk: number;
};

export type LongSignals = {
  earnings: number;
  revenue: number;
  sectorStrength: number;
  institutionalQuality: number;
  catalysts: number;
  valuation: number;
  durability: number;
  macroResilience: number;
};

export type SupportState = {
  confidence: number;
  status: "Stable" | "Caution" | "Danger";
  notes: string[];
};

export type DeploymentPlan = {
  mode: "Buy Shares" | "Buy Calls" | "Buy Puts" | "Buy LEAPS" | "Starter Position" | "Wait for Pullback" | "Watch Only" | "No Trade";
  entryZone: string;
  stopZone: string;
  targets: string[];
  expectedMove: string;
  riskReward: string;
  aggressiveness: number;
};

export type BattlefieldRecord = {
  symbol: string;
  price: number;
  swingSignals: SwingSignals;
  longSignals: LongSignals;
  swingDirection: Direction;
  longDirection: LongDirection;
  whale: SupportState;
  macro: SupportState;
  politics: SupportState;
  sentiment: SupportState;
  deployment: DeploymentPlan;
  alerts: string[];
};

export type SymbolInput = { symbol: string; [key: string]: number | string };
export type BattlefieldApiResponse = {
  items: Array<{ symbol: string; primaryOpportunity?: string; battlefieldSummary?: string; deployment: { bestDeployment?: string; vehicleScores?: { name: string; score: number }[] }; confidence?: number; riskLevel?: string; }>;
  generatedAt: string;
  source: string;
};

export type SwingEngineOutput = { bias: string; confidence: number; summary?: string };
export type LongEngineOutput = { bias: string; confidence: number; summary?: string };
export type WhaleModuleOutput = { status: string; confidence: number; notes: string[] };
export type MacroModuleOutput = { status: string; confidence: number; notes: string[] };
export type PoliticsModuleOutput = { status: string; confidence: number; notes: string[] };
export type SentimentModuleOutput = { status: string; confidence: number; notes: string[] };
export type CapitalDeploymentOutput = { bestDeployment: string; rationale?: string; vehicleScores?: { name: string; score: number }[] };
