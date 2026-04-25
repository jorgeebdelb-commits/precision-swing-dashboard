import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

function sector6mBoost(sector: string | undefined): { fundamentals: number; macro: number; policy: number } {
  switch (sector) {
    case "Semiconductors":
      return { fundamentals: 1.14, macro: 1.12, policy: 1.04 };
    case "Energy":
      return { fundamentals: 1.06, macro: 1.2, policy: 1.12 };
    case "Crypto Mining":
      return { fundamentals: 0.98, macro: 1.24, policy: 1.08 };
    case "Defense":
      return { fundamentals: 1.08, macro: 1.08, policy: 1.2 };
    case "Biotech":
      return { fundamentals: 1.04, macro: 0.96, policy: 1.14 };
    default:
      return { fundamentals: 1, macro: 1, policy: 1 };
  }
}

export const fundamental6mPipeline: PipelineFn = async (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = await getAdaptiveWeights(symbol, marketContext.sector, "sixMonth");
  const macro = getMacroContextWeights("sixMonth");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "sixMonth" });
  const boosts = sector6mBoost(marketContext.sector);

  const factorBreakdown = {
    fundamentals: Math.max(1, Math.min(10, (marketContext.macroScore * 0.95 + 0.45) * boosts.fundamentals)),
    sectorTrend: Math.max(1, Math.min(10, marketContext.flowScore * 0.62 + marketContext.newsSentiment * 0.38)),
    macroTrend: Math.max(
      1,
      Math.min(10, (marketContext.macroScore * (0.96 - macro.fedPolicy * 0.05) + macro.growth * 1.15) * boosts.macro)
    ),
    earningsQuality: Math.max(1, Math.min(10, marketContext.macroScore * 0.74 + marketContext.technicalScore * 0.26)),
    politicalRegulatoryExposure: Math.max(
      1,
      Math.min(10, (9.0 - politics * 1.18 + marketContext.politicalScore * 0.2) * boosts.policy)
    ),
    institutionalBehavior: Math.max(1, Math.min(10, marketContext.flowScore * 0.78 + marketContext.volumeRatio * 1.2)),
  };

  return finalizePipeline({ symbol, horizon: "sixMonth", marketContext, factorWeights, factorBreakdown });
};
