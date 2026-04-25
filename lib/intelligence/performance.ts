import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AnalysisHorizon,
  HorizonKey,
  ModulePerformance,
  PerformanceLogInsert,
  SignalPerformance,
} from "@/lib/intelligence/types";

interface PerformanceLogRow {
  id: string;
  module_name: HorizonKey;
  horizon: AnalysisHorizon;
  return_pct: number | null;
  profitable: boolean | null;
  closed_at: string | null;
  created_at: string;
  triggered_signals: string[] | null;
}

function toPercent(value: number): number {
  return Number((value * 100).toFixed(1));
}

function calcMaxDrawdown(returns: number[]): number {
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;

  for (const item of returns) {
    equity += item;
    if (equity > peak) {
      peak = equity;
    }

    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return Number(maxDrawdown.toFixed(2));
}

export async function logSignalRun(input: PerformanceLogInsert): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("performance_logs")
    .insert({
      symbol: input.symbol,
      horizon: input.horizon,
      module_name: input.moduleName,
      recommendation: input.recommendation,
      score: input.score,
      triggered_signals: input.triggeredSignals,
      market_context: input.marketContext,
    })
    .select("id")
    .single();

  if (error || !data) {
    return null;
  }

  return data.id as string;
}

export async function closePerformanceLog(input: {
  id: string;
  exitPrice: number;
  returnPct: number;
  holdDurationDays: number;
}): Promise<void> {
  const supabase = getSupabaseServerClient();

  await supabase
    .from("performance_logs")
    .update({
      exit_price: input.exitPrice,
      return_pct: input.returnPct,
      profitable: input.returnPct > 0,
      hold_duration_days: input.holdDurationDays,
      closed_at: new Date().toISOString(),
    })
    .eq("id", input.id);
}

export async function getModulePerformance(): Promise<ModulePerformance[]> {
  const supabase = getSupabaseServerClient();
  const last30Start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("performance_logs")
    .select("id, module_name, horizon, return_pct, profitable, closed_at, created_at")
    .not("closed_at", "is", null);

  if (error || !data) {
    return [];
  }

  const rows = data as PerformanceLogRow[];
  const grouped = new Map<string, PerformanceLogRow[]>();

  for (const row of rows) {
    const key = `${row.module_name}::${row.horizon}`;
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const [moduleName, horizon] = key.split("::") as [HorizonKey, AnalysisHorizon];
    const winners = group.filter((item) => item.profitable).length;
    const winRate = group.length ? winners / group.length : 0;
    const avgReturn =
      group.reduce((sum, item) => sum + (item.return_pct ?? 0), 0) / Math.max(group.length, 1);
    const recentTrades = group.filter((item) => item.created_at >= last30Start).length;
    const returns = group
      .map((item) => item.return_pct)
      .filter((item): item is number => typeof item === "number");

    return {
      moduleName,
      horizon,
      winRate: toPercent(winRate),
      avgReturn: Number(avgReturn.toFixed(2)),
      last30Trades: recentTrades,
      sampleSize: group.length,
      maxDrawdown: calcMaxDrawdown(returns),
    };
  });
}

export async function getBestSignals(limit = 8): Promise<SignalPerformance[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("performance_logs")
    .select("triggered_signals, return_pct, profitable, closed_at")
    .not("closed_at", "is", null);

  if (error || !data) {
    return [];
  }

  const rows = data as PerformanceLogRow[];
  const stats = new Map<string, { wins: number; count: number; sumReturn: number }>();

  for (const row of rows) {
    if (!row.triggered_signals?.length) continue;

    for (const signal of row.triggered_signals) {
      const current = stats.get(signal) ?? { wins: 0, count: 0, sumReturn: 0 };
      current.count += 1;
      if (row.profitable) {
        current.wins += 1;
      }
      current.sumReturn += row.return_pct ?? 0;
      stats.set(signal, current);
    }
  }

  return [...stats.entries()]
    .filter(([, item]) => item.count >= 5)
    .map(([signal, item]) => ({
      signal,
      winRate: toPercent(item.wins / item.count),
      avgReturn: Number((item.sumReturn / item.count).toFixed(2)),
      sampleSize: item.count,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.avgReturn - a.avgReturn)
    .slice(0, limit);
}
