export type HorizonKey = "swing" | "threeMonth" | "sixMonth" | "oneYear";

export type AnalysisHorizon = HorizonKey;

export type ConfidenceLevel = "High" | "Medium" | "Low";
export type RiskLevel = "Low" | "Medium" | "High" | "Extreme";
export type RatingLabel = "Strong Buy" | "Buy" | "Watch" | "Neutral" | "Avoid" | "Strong Avoid";
export type StrategyRecommendation =
  | "Buy Shares"
  | "Buy Calls"
  | "Buy Shares + Calls"
  | "Buy LEAPS"
  | "Buy Puts"
  | "Watchlist Only"
  | "Avoid"
  | "Starter Shares"
  | "Starter Shares + Calls on Breakout"
  | "Hedge Only"
  | "Watch";

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
  topReasons?: string[];
  layerScores?: {
    technicalScore: number;
    sentimentScore: number;
    flowScore: number;
    macroScore: number;
    fundamentalScore: number;
  };
  factorWeights: FactorWeight[];
  factorBreakdown: Record<string, number>;
}

export interface PipelineInput {
  symbol: string;
  horizon: AnalysisHorizon;
  marketContext: MarketContextSnapshot;
}

export type PipelineFn = (input: PipelineInput) => Promise<AnalysisResult>;

export interface IntelligenceSignal {
  id: string;
  symbol: string;
  sector?: string | null;
  horizon: AnalysisHorizon;
  rating: RatingLabel;
  strategy?: StrategyRecommendation | string | null;
  confidence: ConfidenceLevel;
  risk: RiskLevel;
  score: number;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  factor_weights: Record<string, number> | null;
  factor_breakdown: Record<string, number> | null;
  reason: string | null;
  created_at: string;
  evaluated_at: string | null;
  outcome_return: number | null;
  outcome_status: string | null;
  model_version: string;
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
  executionStrategy?: string;
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
