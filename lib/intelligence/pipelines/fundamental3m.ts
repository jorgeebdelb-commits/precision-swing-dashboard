import type { AdaptiveWeight, PipelineFn } from "@/lib/intelligence/types";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { buildSignals, finalizeResult } from "@/lib/intelligence/pipelines/helpers";

const BASE_WEIGHTS: AdaptiveWeight[] = [
  { signal: "Upcoming Earnings", weight: 0.18 },
  { signal: "Revenue Trend", weight: 0.16 },
  { signal: "Guidance Changes", weight: 0.14 },
  { signal: "Analyst Sentiment", weight: 0.12 },
  { signal: "Industry Momentum", weight: 0.13 },
  { signal: "Sector Rotation", weight: 0.1 },
  { signal: "Macro Backdrop", weight: 0.17 },
];

export const fundamental3mPipeline: PipelineFn = async (input) => {
  const { market } = input.context;
  const weights = await getAdaptiveWeights("fundamental3m", BASE_WEIGHTS);
  const earningsProximity =
    market.earningsDays == null ? 5.4 : Math.max(1, Math.min(10, 9.5 - market.earningsDays / 9));

  const signals = buildSignals(
    [
      {
        signal: "Upcoming Earnings",
        value: earningsProximity,
        note: `Earnings timing score is ${earningsProximity.toFixed(1)} with days-to-event context included.`,
      },
      {
        signal: "Revenue Trend",
        value: Math.max(1, Math.min(10, market.macroScore * 0.8 + market.technicalScore * 0.2)),
        note: `Near-term revenue trend proxies at ${market.macroScore.toFixed(1)} from watchlist fundamentals.`,
      },
      {
        signal: "Guidance Changes",
        value: Math.max(1, Math.min(10, market.newsSentiment * 0.7 + market.flowScore * 0.3)),
        note: `Guidance tone inferred from sentiment ${market.newsSentiment.toFixed(1)} and flow confirmation.`,
      },
      {
        signal: "Analyst Sentiment",
        value: Math.max(1, Math.min(10, market.newsSentiment)),
        note: `Analyst and news sentiment currently score ${market.newsSentiment.toFixed(1)}.`,
      },
      {
        signal: "Industry Momentum",
        value: Math.max(1, Math.min(10, market.flowScore * 0.75 + market.technicalScore * 0.25)),
        note: `Industry momentum reflects capital flow score ${market.flowScore.toFixed(1)}.`,
      },
      {
        signal: "Sector Rotation",
        value: Math.max(1, Math.min(10, market.politicalScore * 0.6 + market.flowScore * 0.4)),
        note: `Sector rotation score weighs institutional flow and policy sensitivity.`,
      },
      {
        signal: "Macro Backdrop",
        value: Math.max(1, Math.min(10, market.macroScore)),
        note: `Current macro backdrop contributes ${market.macroScore.toFixed(1)} to 3-month outlook.`,
      },
    ],
    weights
  );

  return finalizeResult({ pipelineInput: input, horizon: "3-Month", signals });
};
