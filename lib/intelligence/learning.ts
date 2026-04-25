import type { FactorWeight, IntelligenceSignal } from "@/lib/intelligence/types";
import { getAdaptiveWeights, getDefaultWeights, saveAdaptiveWeights } from "@/lib/intelligence/weights";

const MAX_ADJUSTMENT_PER_EVAL = 0.05;
const MIN_WEIGHT = 0.05;
const MAX_WEIGHT = 0.45;

function toWeightMap(weights: FactorWeight[]): Record<string, number> {
  return weights.reduce<Record<string, number>>((acc, item) => {
    acc[item.factor] = item.weight;
    return acc;
  }, {});
}

export function calculateFactorContribution(signal: Pick<IntelligenceSignal, "factor_weights" | "factor_breakdown">): Record<string, number> {
  const weights = signal.factor_weights ?? {};
  const breakdown = signal.factor_breakdown ?? {};

  const raw = Object.entries(weights).reduce<Record<string, number>>((acc, [factor, weight]) => {
    const score = Number(breakdown[factor] ?? 0);
    acc[factor] = Number(weight) * score;
    return acc;
  }, {});

  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  if (!total) return raw;

  return Object.entries(raw).reduce<Record<string, number>>((acc, [factor, value]) => {
    acc[factor] = value / total;
    return acc;
  }, {});
}

export function clampWeights(weights: Record<string, number>): Record<string, number> {
  return Object.entries(weights).reduce<Record<string, number>>((acc, [factor, weight]) => {
    acc[factor] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, Number(weight)));
    return acc;
  }, {});
}

export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (!total) return weights;

  return Object.entries(weights).reduce<Record<string, number>>((acc, [factor, value]) => {
    acc[factor] = Number((value / total).toFixed(6));
    return acc;
  }, {});
}

export async function updateWeightsFromOutcome(
  signal: IntelligenceSignal,
  outcome: { outcomeReturn: number | null; status: string | null }
): Promise<void> {
  if (outcome.outcomeReturn == null || !outcome.status) {
    return;
  }

  const baseWeights = getDefaultWeights(signal.sector, signal.horizon);
  const adaptive = await getAdaptiveWeights(signal.symbol, signal.sector, signal.horizon);
  const contributions = calculateFactorContribution(signal);
  const current = toWeightMap(adaptive.length ? adaptive : baseWeights);

  if (!Object.keys(current).length) {
    return;
  }

  const succeeded = outcome.outcomeReturn > 0;
  const ranked = Object.entries(contributions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (!ranked.length) {
    return;
  }

  const adjusted = { ...current };
  for (const [factor, contribution] of ranked) {
    const direction = succeeded ? 1 : -1;
    const delta = Math.min(MAX_ADJUSTMENT_PER_EVAL, MAX_ADJUSTMENT_PER_EVAL * Math.max(0.2, contribution));
    adjusted[factor] = (adjusted[factor] ?? 0) * (1 + direction * delta);
  }

  const next = normalizeWeights(clampWeights(adjusted));
  await saveAdaptiveWeights(signal.symbol, signal.sector, signal.horizon, next, signal.model_version ?? "v1");
}
