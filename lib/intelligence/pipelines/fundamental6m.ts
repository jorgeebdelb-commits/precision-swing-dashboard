import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getSectorFactorWeights } from "@/lib/intelligence/sectors";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

export const fundamental6mPipeline: PipelineFn = (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = getSectorFactorWeights("sixMonth", marketContext.sector);
  const macro = getMacroContextWeights("sixMonth");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "sixMonth" });

  const factorBreakdown = {
    fundamentals: Math.max(1, Math.min(10, marketContext.macroScore * 0.88 + 0.6)),
    sectorTrend: Math.max(1, Math.min(10, marketContext.flowScore * 0.56 + marketContext.newsSentiment * 0.44)),
    macroTrend: Math.max(1, Math.min(10, marketContext.macroScore * (0.92 - macro.fedPolicy * 0.08) + macro.growth * 0.8)),
    earningsQuality: Math.max(1, Math.min(10, marketContext.macroScore * 0.7 + marketContext.technicalScore * 0.3)),
    politicalRegulatoryExposure: Math.max(1, Math.min(10, 8.5 - politics * 1.45 + marketContext.politicalScore * 0.22)),
    institutionalBehavior: Math.max(1, Math.min(10, marketContext.flowScore * 0.72 + marketContext.volumeRatio * 1.05)),
  };

  return finalizePipeline({ symbol, horizon: "sixMonth", marketContext, factorWeights, factorBreakdown });
};
