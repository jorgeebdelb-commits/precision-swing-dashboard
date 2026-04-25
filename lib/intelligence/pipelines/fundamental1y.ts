import type { AdaptiveWeight, PipelineFn } from "@/lib/intelligence/types";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { buildSignals, finalizeResult } from "@/lib/intelligence/pipelines/helpers";

const BASE_WEIGHTS: AdaptiveWeight[] = [
  { signal: "Revenue CAGR", weight: 0.14 },
  { signal: "Earnings Durability", weight: 0.13 },
  { signal: "Balance Sheet Quality", weight: 0.12 },
  { signal: "Debt/Cash Strength", weight: 0.1 },
  { signal: "Industry Leadership", weight: 0.1 },
  { signal: "Moat Quality", weight: 0.12 },
  { signal: "Valuation Reasonableness", weight: 0.1 },
  { signal: "Secular Tailwinds", weight: 0.09 },
  { signal: "Long-Cycle Macro", weight: 0.1 },
];

export const fundamental1yPipeline: PipelineFn = async (input) => {
  const { market } = input.context;
  const weights = await getAdaptiveWeights("fundamental1y", BASE_WEIGHTS);

  const baseQuality = Math.max(1, Math.min(10, market.macroScore * 0.7 + market.technicalScore * 0.3));

  const signals = buildSignals(
    [
      {
        signal: "Revenue CAGR",
        value: Math.max(1, Math.min(10, baseQuality)),
        note: `Revenue CAGR proxy scores ${baseQuality.toFixed(1)} from long-run quality factors.`,
      },
      {
        signal: "Earnings Durability",
        value: Math.max(1, Math.min(10, market.macroScore * 0.85 + market.newsSentiment * 0.15)),
        note: `Earnings durability remains ${market.macroScore >= 6 ? "resilient" : "fragile"}.`,
      },
      {
        signal: "Balance Sheet Quality",
        value: Math.max(1, Math.min(10, 6.5 + (market.macroScore - 5) * 0.6)),
        note: `Balance sheet quality tracks macro fundamental score at ${market.macroScore.toFixed(1)}.`,
      },
      {
        signal: "Debt/Cash Strength",
        value: Math.max(1, Math.min(10, 6 + (market.macroScore - market.volatility) * 0.5)),
        note: `Debt and cash resilience accounts for volatility-adjusted quality factors.`,
      },
      {
        signal: "Industry Leadership",
        value: Math.max(1, Math.min(10, market.technicalScore * 0.55 + market.flowScore * 0.45)),
        note: `Industry leadership combines trend persistence and institutional sponsorship.`,
      },
      {
        signal: "Moat Quality",
        value: Math.max(1, Math.min(10, market.macroScore * 0.8 + market.politicalScore * 0.2)),
        note: `Moat quality benefits from stable macro and policy positioning.`,
      },
      {
        signal: "Valuation Reasonableness",
        value: Math.max(1, Math.min(10, 8.5 - market.technicalScore * 0.35 + market.macroScore * 0.2)),
        note: `Valuation reasonableness tempers strength with positioning risk.`,
      },
      {
        signal: "Secular Tailwinds",
        value: Math.max(1, Math.min(10, market.newsSentiment * 0.45 + market.flowScore * 0.55)),
        note: `Secular trend score integrates sentiment and persistent capital allocation.`,
      },
      {
        signal: "Long-Cycle Macro",
        value: Math.max(1, Math.min(10, market.macroScore * 0.75 + market.politicalScore * 0.25)),
        note: `Long-cycle macro themes contribute ${market.macroScore.toFixed(1)} to the one-year lens.`,
      },
    ],
    weights
  );

  return finalizeResult({ pipelineInput: input, horizon: "1-Year+", signals });
};
