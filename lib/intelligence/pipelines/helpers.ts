import type {
  AdaptiveWeight,
  AnalysisResult,
  PipelineInput,
  Recommendation,
  SignalContext,
} from "@/lib/intelligence/types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildSignals(
  signals: Omit<SignalContext, "weight">[],
  weights: AdaptiveWeight[]
): SignalContext[] {
  const map = new Map(weights.map((item) => [item.signal, item.weight]));
  return signals.map((signal) => ({
    ...signal,
    weight: map.get(signal.signal) ?? 0.1,
  }));
}

export function finalizeResult(input: {
  pipelineInput: PipelineInput;
  horizon: AnalysisResult["horizon"];
  signals: SignalContext[];
}): AnalysisResult {
  const weightTotal = input.signals.reduce((sum, signal) => sum + signal.weight, 0);
  const weightedScore =
    input.signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0) /
    Math.max(weightTotal, 0.0001);

  const score = Number(clamp(weightedScore, 1, 10).toFixed(2));
  const confidence = Number(
    clamp(35 + score * 6 + input.signals.length * 1.8, 35, 97).toFixed(1)
  );
  const recommendation: Recommendation = score >= 7.2 ? "Buy" : score >= 4.8 ? "Watch" : "Sell";

  return {
    symbol: input.pipelineInput.symbol,
    horizon: input.horizon,
    recommendation,
    score,
    confidence,
    reasoning: input.signals.slice(0, 5).map((signal) => signal.note),
    triggeredSignals: input.signals
      .filter((signal) => signal.value >= 5.5)
      .map((signal) => signal.signal),
    updatedAt: input.pipelineInput.nowIso,
  };
}
