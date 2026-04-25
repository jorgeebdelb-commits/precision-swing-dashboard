export type HorizonKey = "shortTerm" | "fundamental3m" | "fundamental6m" | "fundamental1y";

export type AnalysisHorizon = "Short-Term" | "3-Month" | "6-Month" | "1-Year+";

export type Recommendation = "Buy" | "Watch" | "Sell";

export interface AnalysisResult {
  symbol: string;
  horizon: AnalysisHorizon;
  recommendation: Recommendation;
  score: number;
  confidence: number;
  reasoning: string[];
  triggeredSignals: string[];
  updatedAt: string;
}

export interface SignalContext {
  signal: string;
  value: number;
  weight: number;
  note: string;
}

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
}

export interface SymbolContext {
  symbol: string;
  market: MarketContextSnapshot;
}

export interface PipelineInput {
  symbol: string;
  context: SymbolContext;
  nowIso: string;
}

export type PipelineFn = (input: PipelineInput) => Promise<AnalysisResult>;

export interface PerformanceLogInsert {
  symbol: string;
  horizon: AnalysisHorizon;
  moduleName: HorizonKey;
  recommendation: Recommendation;
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

export interface AdaptiveWeight {
  signal: string;
  weight: number;
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
