import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

export const swingPipeline: PipelineFn = async (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = await getAdaptiveWeights(symbol, marketContext.sector, "swing");
  const macro = getMacroContextWeights("swing");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "swing" });

  const factorBreakdown = {
    technicals: Math.max(1, Math.min(10, marketContext.technicalScore * 0.92 + 0.5)),
    momentum: Math.max(1, Math.min(10, 5 + marketContext.trendSlope * 11 + (marketContext.rsi - 50) * 0.05)),
    volume: Math.max(1, Math.min(10, 2.8 + marketContext.volumeRatio * 3.3)),
    sentiment: Math.max(1, Math.min(10, marketContext.newsSentiment)),
    whalesOptions: Math.max(1, Math.min(10, marketContext.flowScore * 0.75 + marketContext.volumeRatio * 1.6)),
    nearTermCatalysts: Math.max(
      1,
      Math.min(10, 6.5 - (marketContext.earningsDays ?? 40) * 0.08 + macro.riskAppetite * 2.2 - politics * 0.35)
    ),
  };

  return finalizePipeline({ symbol, horizon: "swing", marketContext, factorWeights, factorBreakdown });
};
