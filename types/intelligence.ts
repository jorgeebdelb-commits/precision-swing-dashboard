import type {
  AnalysisResult,
  IntelligenceApiResponse,
  IntelligenceSymbolSummary,
  ModulePerformance,
  RefreshIntelligenceRequest,
  SignalPerformance,
} from "@/lib/intelligence/types";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type IntelligenceLabel =
  | "Strong Buy"
  | "Buy"
  | "Watch"
  | "Caution"
  | "Avoid";

export type StrategyRecommendation =
  | "BUY_SHARES"
  | "BUY_CALLS"
  | "BUY_SHARES_AND_CALLS"
  | "BUY_PUTS"
  | "WATCH"
  | "AVOID";

export interface BaseScores {
  technical: number;
  fundamentals: number;
  flow: number;
  news: number;
  macro: number;
  crowd: number;
}

export interface HorizonScores {
  swing: number;
  threeMonth: number;
  sixMonth: number;
  oneYear: number;
}

export interface IntelligenceFactors {
  symbol: string;
  technical: number;
  fundamentals: number;
  flow: number;
  news: number;
  macro: number;
  crowd: number;
}

export interface LegacyIntelligenceScoreResult {
  symbol: string;
  baseScores: BaseScores;
  horizonScores: HorizonScores;
  overallScore: number;
  label: IntelligenceLabel;
  bestStrategy: StrategyRecommendation;
  confidencePct: number;
  riskLevel: RiskLevel;
  generatedAt: string;
}

export type HorizonAnalysisResult = AnalysisResult;
export type IntelligenceScoreResult = LegacyIntelligenceScoreResult;

export type {
  IntelligenceApiResponse,
  IntelligenceSymbolSummary,
  ModulePerformance,
  SignalPerformance,
  RefreshIntelligenceRequest,
};
