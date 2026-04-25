import type { AdaptiveWeight, PipelineFn } from "@/lib/intelligence/types";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { buildSignals, finalizeResult } from "@/lib/intelligence/pipelines/helpers";

const BASE_WEIGHTS: AdaptiveWeight[] = [
  { signal: "Multi-Quarter Earnings", weight: 0.19 },
  { signal: "Margin Expansion", weight: 0.14 },
  { signal: "Industry Cycle", weight: 0.15 },
  { signal: "Competitive Position", weight: 0.14 },
  { signal: "Capital Flows", weight: 0.13 },
  { signal: "Rate Sensitivity", weight: 0.1 },
  { signal: "Macro Regime", weight: 0.15 },
];

export const fundamental6mPipeline: PipelineFn = async (input) => {
  const { market } = input.context;
  const weights = await getAdaptiveWeights("fundamental6m", BASE_WEIGHTS);

  const signals = buildSignals(
    [
      {
        signal: "Multi-Quarter Earnings",
        value: Math.max(1, Math.min(10, market.macroScore * 0.85 + market.newsSentiment * 0.15)),
        note: `Multi-quarter earnings quality inferred at ${market.macroScore.toFixed(1)}.`,
      },
      {
        signal: "Margin Expansion",
        value: Math.max(1, Math.min(10, market.macroScore * 0.7 + market.technicalScore * 0.3)),
        note: `Margin trend proxy combines operating and price action strength.`,
      },
      {
        signal: "Industry Cycle",
        value: Math.max(1, Math.min(10, market.flowScore * 0.65 + market.newsSentiment * 0.35)),
        note: `Industry cycle momentum is supported by current flow and sentiment.`,
      },
      {
        signal: "Competitive Position",
        value: Math.max(1, Math.min(10, market.technicalScore * 0.6 + market.macroScore * 0.4)),
        note: `Competitive position score favors sustained execution indicators.`,
      },
      {
        signal: "Capital Flows",
        value: Math.max(1, Math.min(10, market.flowScore)),
        note: `Capital flows remain ${market.flowScore >= 6 ? "constructive" : "mixed"} at ${market.flowScore.toFixed(1)}.`,
      },
      {
        signal: "Rate Sensitivity",
        value: Math.max(1, Math.min(10, 7.5 - Math.abs(market.politicalScore - market.macroScore) * 0.7)),
        note: `Rate sensitivity balance factors macro and policy exposure.`,
      },
      {
        signal: "Macro Regime",
        value: Math.max(1, Math.min(10, market.macroScore * 0.8 + market.politicalScore * 0.2)),
        note: `Macro regime outlook contributes ${market.macroScore.toFixed(1)} to 6-month thesis.`,
      },
    ],
    weights
  );

  return finalizeResult({ pipelineInput: input, horizon: "6-Month", signals });
};
