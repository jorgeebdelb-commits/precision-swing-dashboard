export type HorizonKey = "swing" | "threeMonth" | "sixMonth" | "oneYear";

export type AnalysisHorizon = HorizonKey;

export type ConfidenceLevel = "High" | "Medium" | "Low";
export type RiskLevel = "Low" | "Medium" | "High" | "Extreme";
export type RatingLabel = "Strong Buy" | "Buy" | "Watch" | "Avoid";
export type StrategyRecommendation =
  | "Buy Shares"
  | "Buy Shares + Calls"
  | "Buy Calls"
  | "Starter Size Only"
  | "Watch"
  | "Avoid"
  | "Buy Puts";

export interface MarketContextSnapshot {
  price: number;
  rsi: number;
  volumeRatio: number;
  technicalScore: number;
  macroScore: number;
  politicalScore: number;
  earningsDays: number | null;
  newsSentiment: number;
  flowScore: number;
  volatility: number;
  trendSlope: number;
  sector?: string;
}

export interface FactorWeight {
  factor: string;
  weight: number;
}

export interface AdaptiveWeight {
  signal: string;
  weight: number;
}

export interface AnalysisResult {
  symbol: string;
  horizon: AnalysisHorizon;
  score: number;
  rating: RatingLabel;
  strategy: StrategyRecommendation;
  confidence: ConfidenceLevel;
  risk: RiskLevel;
  reason: string;
  factorWeights: FactorWeight[];
  factorBreakdown: Record<string, number>;
}

export interface PipelineInput {
  symbol: string;
  horizon: AnalysisHorizon;
  marketContext: MarketContextSnapshot;
}

export type PipelineFn = (input: PipelineInput) => AnalysisResult;

export interface PerformanceLogInsert {
  symbol: string;
  horizon: AnalysisHorizon;
  moduleName: HorizonKey;
  recommendation: string;
  score: number;
  triggeredSignals: string[];
  marketContext: MarketContextSnapshot;
}

export interface ModulePerformance {
  moduleName: HorizonKey;
  horizon: AnalysisHorizon;
  winRate: number;
  avgReturn: number;
  last30Trades: number;
  sampleSize: number;
  maxDrawdown: number;
}

export interface SignalPerformance {
  signal: string;
  winRate: number;
  avgReturn: number;
  sampleSize: number;
}

export interface IntelligenceSymbolSummary {
  symbol: string;
  analyses: AnalysisResult[];
  bestHorizon: AnalysisHorizon;
  updatedAt: string;
}

export interface IntelligenceApiResponse {
  items: IntelligenceSymbolSummary[];
  performance: ModulePerformance[];
  bestSignals: SignalPerformance[];
  generatedAt: string;
  source: "cache" | "fresh";
}

export interface RefreshIntelligenceRequest {
  symbols?: string[];
  force?: boolean;
  horizon?: string;
}
