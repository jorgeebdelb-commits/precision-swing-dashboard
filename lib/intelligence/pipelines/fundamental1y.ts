import { getMacroContextWeights } from "@/lib/intelligence/macro";
import { getPoliticalExposure } from "@/lib/intelligence/politics";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { finalizePipeline } from "@/lib/intelligence/pipelines/helpers";
import type { PipelineFn } from "@/lib/intelligence/types";

function sector1yBoost(sector: string | undefined): { leadership: number; macro: number; policy: number; valuation: number } {
  switch (sector) {
    case "Semiconductors":
      return { leadership: 1.18, macro: 1.1, policy: 1.06, valuation: 0.96 };
    case "Energy":
      return { leadership: 1.04, macro: 1.18, policy: 1.14, valuation: 1.02 };
    case "Crypto Mining":
      return { leadership: 1.08, macro: 1.22, policy: 1.12, valuation: 0.9 };
    case "Defense":
      return { leadership: 1.08, macro: 1.08, policy: 1.2, valuation: 1.04 };
    case "Biotech":
      return { leadership: 1.02, macro: 0.98, policy: 1.14, valuation: 0.88 };
    default:
      return { leadership: 1, macro: 1, policy: 1, valuation: 1 };
  }
}

export const fundamental1yPipeline: PipelineFn = async (input) => {
  const { marketContext, symbol } = input;
  const factorWeights = await getAdaptiveWeights(symbol, marketContext.sector, "oneYear");
  const macro = getMacroContextWeights("oneYear");
  const politics = getPoliticalExposure({ symbol, sector: marketContext.sector, horizon: "oneYear" });
  const boosts = sector1yBoost(marketContext.sector);

  const factorBreakdown = {
    longTermFundamentals: Math.max(1, Math.min(10, marketContext.macroScore * 0.98 + 0.25)),
    industryLeadership: Math.max(
      1,
      Math.min(10, (marketContext.flowScore * 0.56 + marketContext.technicalScore * 0.44) * boosts.leadership)
    ),
    balanceSheetQuality: Math.max(1, Math.min(10, marketContext.macroScore * 0.94 + 0.35)),
    valuationRisk: Math.max(
      1,
      Math.min(10, (9.4 - marketContext.technicalScore * 0.24 - marketContext.volatility * 0.4) * boosts.valuation)
    ),
    macroCycle: Math.max(
      1,
      Math.min(10, (marketContext.macroScore * (1.02 - macro.credit * 0.04) + macro.macroCycle * 1.2) * boosts.macro)
    ),
    geopoliticalPolicyExposure: Math.max(
      1,
      Math.min(10, (9.15 - politics * 1.12 + marketContext.politicalScore * 0.16) * boosts.policy)
    ),
    competitiveMoat: Math.max(1, Math.min(10, marketContext.macroScore * 0.62 + marketContext.flowScore * 0.38)),
  };

  return finalizePipeline({ symbol, horizon: "oneYear", marketContext, factorWeights, factorBreakdown });
};
