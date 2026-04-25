import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

export const fundamental3mPipeline: PipelineFn = async (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = await getAdaptiveWeights(symbol, marketContext.sector, "threeMonth");
  const macro = getMacroContextWeights("threeMonth");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "threeMonth" });
  const earningsWindow = marketContext.earningsDays == null ? 5.8 : Math.max(1, Math.min(10, 9.3 - marketContext.earningsDays / 9));

  const factorBreakdown = {
    earningsTrend: Math.max(1, Math.min(10, earningsWindow * 0.65 + marketContext.macroScore * 0.35)),
    sectorTrend: Math.max(1, Math.min(10, marketContext.flowScore * 0.62 + marketContext.newsSentiment * 0.38)),
    sentiment: Math.max(1, Math.min(10, marketContext.newsSentiment)),
    macroPressure: Math.max(1, Math.min(10, marketContext.macroScore * (1 - macro.fedPolicy * 0.15))),
    catalystCalendar: Math.max(1, Math.min(10, earningsWindow * 0.7 + marketContext.flowScore * 0.3 - politics * 0.15)),
    technicalStructure: Math.max(1, Math.min(10, marketContext.technicalScore * 0.74 + marketContext.trendSlope * 8 + 1.2)),
  };

  return finalizePipeline({ symbol, horizon: "threeMonth", marketContext, factorWeights, factorBreakdown });
};
