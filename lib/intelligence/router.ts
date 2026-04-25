import type { AnalysisResult, HorizonKey, MarketContextSnapshot } from "@/lib/intelligence/types";
import { swingPipeline } from "@/lib/intelligence/pipelines/swing";
import { fundamental3mPipeline } from "@/lib/intelligence/pipelines/fundamental3m";
import { fundamental6mPipeline } from "@/lib/intelligence/pipelines/fundamental6m";
import { fundamental1yPipeline } from "@/lib/intelligence/pipelines/fundamental1y";

const ROUTE_MAP = {
  swing: swingPipeline,
  threeMonth: fundamental3mPipeline,
  sixMonth: fundamental6mPipeline,
  oneYear: fundamental1yPipeline,
} as const;

function normalizeHorizon(horizon: string | HorizonKey | null | undefined): HorizonKey {
  if (!horizon) return "swing";
  if (horizon === "swing" || horizon === "threeMonth" || horizon === "sixMonth" || horizon === "oneYear") {
    return horizon;
  }

  const value = horizon.toLowerCase().trim();
  if (value.includes("three") || value === "3m" || value.includes("3 month")) return "threeMonth";
  if (value.includes("six") || value === "6m" || value.includes("6 month")) return "sixMonth";
  if (value.includes("year") || value === "1y" || value.includes("12 month")) return "oneYear";
  return "swing";
}

export function routeAnalysis(
  symbol: string,
  horizon: string | HorizonKey | null | undefined,
  marketContext: MarketContextSnapshot
): AnalysisResult {
  const resolvedHorizon = normalizeHorizon(horizon);
  return ROUTE_MAP[resolvedHorizon]({ symbol, horizon: resolvedHorizon, marketContext });
}

export function routeAllHorizons(symbol: string, marketContext: MarketContextSnapshot): AnalysisResult[] {
  const order: HorizonKey[] = ["swing", "threeMonth", "sixMonth", "oneYear"];
  return order.map((horizon) => routeAnalysis(symbol, horizon, marketContext));
}
