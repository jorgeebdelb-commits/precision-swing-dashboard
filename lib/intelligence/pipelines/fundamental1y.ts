import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getSectorFactorWeights } from "@/lib/intelligence/sectors";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

export const fundamental1yPipeline: PipelineFn = (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = getSectorFactorWeights("oneYear", marketContext.sector);
  const macro = getMacroContextWeights("oneYear");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "oneYear" });

  const factorBreakdown = {
    longTermFundamentals: Math.max(1, Math.min(10, marketContext.macroScore * 0.9 + 0.5)),
    industryLeadership: Math.max(1, Math.min(10, marketContext.flowScore * 0.5 + marketContext.technicalScore * 0.5)),
    balanceSheetQuality: Math.max(1, Math.min(10, marketContext.macroScore * 0.86 + 0.6)),
    valuationRisk: Math.max(1, Math.min(10, 9.1 - marketContext.technicalScore * 0.32 - marketContext.volatility * 0.35)),
    macroCycle: Math.max(1, Math.min(10, marketContext.macroScore * (0.95 - macro.credit * 0.06) + macro.macroCycle * 0.9)),
    geopoliticalPolicyExposure: Math.max(1, Math.min(10, 8.8 - politics * 1.35 + marketContext.politicalScore * 0.2)),
    competitiveMoat: Math.max(1, Math.min(10, marketContext.macroScore * 0.64 + marketContext.flowScore * 0.36)),
  };

  return finalizePipeline({ symbol, horizon: "oneYear", marketContext, factorWeights, factorBreakdown });
};
