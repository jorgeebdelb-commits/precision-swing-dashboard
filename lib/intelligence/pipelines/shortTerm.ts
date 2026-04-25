import type { AdaptiveWeight, PipelineFn } from "@/lib/intelligence/types";
import { getAdaptiveWeights } from "@/lib/intelligence/weights";
import { buildSignals, finalizeResult } from "@/lib/intelligence/pipelines/helpers";

const BASE_WEIGHTS: AdaptiveWeight[] = [
  { signal: "RSI", weight: 0.16 },
  { signal: "Momentum", weight: 0.14 },
  { signal: "EMA Trend", weight: 0.14 },
  { signal: "Volume Spike", weight: 0.12 },
  { signal: "Breakout Probability", weight: 0.12 },
  { signal: "Support/Resistance", weight: 0.1 },
  { signal: "Volatility Trend", weight: 0.1 },
  { signal: "Relative Strength", weight: 0.12 },
];

export const shortTermPipeline: PipelineFn = async (input) => {
  const { market } = input.context;
  const weights = await getAdaptiveWeights("shortTerm", BASE_WEIGHTS);

  const signals = buildSignals(
    [
      {
        signal: "RSI",
        value: Math.max(1, Math.min(10, 10 - Math.abs(market.rsi - 52) / 5)),
        note: `RSI at ${market.rsi.toFixed(1)} indicates near-neutral momentum setup.`,
      },
      {
        signal: "Momentum",
        value: Math.max(1, Math.min(10, 4 + market.flowScore * 0.6)),
        note: `Flow momentum score is ${market.flowScore.toFixed(1)} based on recent capital activity.`,
      },
      {
        signal: "EMA Trend",
        value: Math.max(1, Math.min(10, 5 + market.trendSlope * 8)),
        note: `Trend slope at ${market.trendSlope.toFixed(3)} reflects current EMA direction.`,
      },
      {
        signal: "Volume Spike",
        value: Math.max(1, Math.min(10, 3 + market.volumeRatio * 3)),
        note: `Volume ratio of ${market.volumeRatio.toFixed(2)}x supports follow-through probability.`,
      },
      {
        signal: "Breakout Probability",
        value: Math.max(1, Math.min(10, market.technicalScore * 0.9 + market.flowScore * 0.3)),
        note: `Breakout probability tracks technical score ${market.technicalScore.toFixed(1)} and flow alignment.`,
      },
      {
        signal: "Support/Resistance",
        value: Math.max(1, Math.min(10, 10 - market.volatility * 2.5)),
        note: `Support stability adjusts for volatility at ${market.volatility.toFixed(2)}%.`,
      },
      {
        signal: "Volatility Trend",
        value: Math.max(1, Math.min(10, 8 - market.volatility * 2.8)),
        note: `Short-term volatility trend remains ${market.volatility < 1.8 ? "contained" : "elevated"}.`,
      },
      {
        signal: "Relative Strength",
        value: Math.max(1, Math.min(10, (market.technicalScore + market.newsSentiment) / 2)),
        note: `Relative strength blends technical score and sentiment at ${market.newsSentiment.toFixed(1)}.`,
      },
    ],
    weights
  );

  return finalizeResult({ pipelineInput: input, horizon: "Short-Term", signals });
};
