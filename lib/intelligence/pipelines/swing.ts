import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

function sectorSwingBoost(sector: string | undefined): { momentum: number; catalysts: number; flow: number } {
  switch (sector) {
    case "Semiconductors":
      return { momentum: 1.14, catalysts: 1.16, flow: 1.1 };
    case "Energy":
      return { momentum: 1.06, catalysts: 1.18, flow: 1.04 };
    case "Crypto Mining":
      return { momentum: 1.22, catalysts: 1.08, flow: 1.18 };
    case "Defense":
      return { momentum: 1.04, catalysts: 1.15, flow: 1.06 };
    case "Biotech":
      return { momentum: 0.96, catalysts: 1.24, flow: 1.02 };
    default:
      return { momentum: 1, catalysts: 1, flow: 1 };
  }
}

export const swingPipeline: PipelineFn = async (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = await getAdaptiveWeights(symbol, marketContext.sector, "swing");
  const macro = getMacroContextWeights("swing");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "swing" });
  const boosts = sectorSwingBoost(marketContext.sector);

  const factorBreakdown = {
    technicals: Math.max(1, Math.min(10, marketContext.technicalScore * 1.02 - 0.15)),
    momentum: Math.max(
      1,
      Math.min(10, (4.65 + marketContext.trendSlope * 15.5 + (marketContext.rsi - 50) * 0.07) * boosts.momentum)
    ),
    volume: Math.max(1, Math.min(10, 2.1 + marketContext.volumeRatio * 3.9)),
    sentiment: Math.max(1, Math.min(10, marketContext.newsSentiment)),
    whalesOptions: Math.max(
      1,
      Math.min(10, (marketContext.flowScore * 0.92 + marketContext.volumeRatio * 1.9) * boosts.flow)
    ),
    nearTermCatalysts: Math.max(
      1,
      Math.min(
        10,
        (7.8 - (marketContext.earningsDays ?? 36) * 0.07 + macro.riskAppetite * 2.9 - politics * 0.22) * boosts.catalysts
      )
    ),
  };

  return finalizePipeline({ symbol, horizon: "swing", marketContext, factorWeights, factorBreakdown });
};
