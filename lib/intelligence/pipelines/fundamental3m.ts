import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

function sector3mBoost(sector: string | undefined): { trend: number; macro: number; catalysts: number } {
  switch (sector) {
    case "Semiconductors":
      return { trend: 1.16, macro: 1.08, catalysts: 1.14 };
    case "Energy":
      return { trend: 1.1, macro: 1.18, catalysts: 1.1 };
    case "Crypto Mining":
      return { trend: 1.12, macro: 1.22, catalysts: 1.06 };
    case "Defense":
      return { trend: 1.08, macro: 1.08, catalysts: 1.18 };
    case "Biotech":
      return { trend: 0.94, macro: 0.98, catalysts: 1.24 };
    default:
      return { trend: 1, macro: 1, catalysts: 1 };
  }
}

export const fundamental3mPipeline: PipelineFn = async (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = await getAdaptiveWeights(symbol, marketContext.sector, "threeMonth");
  const macro = getMacroContextWeights("threeMonth");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "threeMonth" });
  const boosts = sector3mBoost(marketContext.sector);
  const earningsWindow =
    marketContext.earningsDays == null ? 6.4 : Math.max(1, Math.min(10, 9.7 - marketContext.earningsDays / 8.2));

  const factorBreakdown = {
    earningsTrend: Math.max(1, Math.min(10, earningsWindow * 0.58 + marketContext.macroScore * 0.42)),
    sectorTrend: Math.max(
      1,
      Math.min(10, (marketContext.flowScore * 0.67 + marketContext.newsSentiment * 0.33) * boosts.trend)
    ),
    sentiment: Math.max(1, Math.min(10, marketContext.newsSentiment)),
    macroPressure: Math.max(
      1,
      Math.min(10, marketContext.macroScore * (1.02 - macro.fedPolicy * 0.11) * boosts.macro + macro.growth * 0.45)
    ),
    catalystCalendar: Math.max(
      1,
      Math.min(10, (earningsWindow * 0.73 + marketContext.flowScore * 0.27 - politics * 0.1) * boosts.catalysts)
    ),
    technicalStructure: Math.max(
      1,
      Math.min(10, marketContext.technicalScore * 0.8 + marketContext.trendSlope * 10.5 + 0.75)
    ),
  };

  return finalizePipeline({ symbol, horizon: "threeMonth", marketContext, factorWeights, factorBreakdown });
};
