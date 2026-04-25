import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdaptiveWeight, HorizonKey } from "@/lib/intelligence/types";

const MIN_CLOSED_TRADES = 20;
const MAX_ADJUSTMENT = 0.2;
const REBALANCE_STEP = 0.08;

interface SignalStatRow {
  triggered_signals: string[] | null;
  return_pct: number | null;
  profitable: boolean | null;
  closed_at: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeWeights(weights: AdaptiveWeight[]): AdaptiveWeight[] {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  if (!total) {
    const even = 1 / Math.max(weights.length, 1);
    return weights.map((item) => ({ ...item, weight: Number(even.toFixed(4)) }));
  }

  return weights.map((item) => ({
    ...item,
    weight: Number((item.weight / total).toFixed(4)),
  }));
}

export async function getAdaptiveWeights(
  moduleName: HorizonKey,
  baseWeights: AdaptiveWeight[]
): Promise<AdaptiveWeight[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("performance_logs")
    .select("triggered_signals, return_pct, profitable, closed_at")
    .eq("module_name", moduleName)
    .not("closed_at", "is", null);

  if (error || !data) {
    return normalizeWeights(baseWeights);
  }

  const closedRows = data as SignalStatRow[];
  if (closedRows.length < MIN_CLOSED_TRADES) {
    return normalizeWeights(baseWeights);
  }

  const signalStats = new Map<string, { count: number; wins: number; sumReturn: number }>();

  for (const row of closedRows) {
    if (!row.triggered_signals?.length) continue;

    for (const signal of row.triggered_signals) {
      const existing = signalStats.get(signal) ?? { count: 0, wins: 0, sumReturn: 0 };
      existing.count += 1;
      if (row.profitable) {
        existing.wins += 1;
      }
      existing.sumReturn += row.return_pct ?? 0;
      signalStats.set(signal, existing);
    }
  }

  const adjusted = baseWeights.map((weightItem) => {
    const stats = signalStats.get(weightItem.signal);
    if (!stats || stats.count < 5) {
      return weightItem;
    }

    const winRate = stats.wins / stats.count;
    const avgReturn = stats.sumReturn / stats.count;
    const performanceBoost = (winRate - 0.5) * 0.6 + avgReturn * 0.02;
    const cappedBoost = clamp(performanceBoost, -MAX_ADJUSTMENT, MAX_ADJUSTMENT);
    const nextWeight = weightItem.weight * (1 + cappedBoost * REBALANCE_STEP);

    return {
      signal: weightItem.signal,
      weight: Number(clamp(nextWeight, 0.02, 0.55).toFixed(4)),
    };
  });

  return normalizeWeights(adjusted);
}
