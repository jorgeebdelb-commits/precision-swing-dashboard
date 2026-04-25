import type {
  AnalysisHorizon,
  HorizonKey,
  IntelligenceSignal,
  ModulePerformance,
  SignalPerformance,
} from "@/lib/intelligence/types";
import { updateWeightsFromOutcome } from "@/lib/intelligence/learning";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface LogSignalInput {
  symbol: string;
  sector?: string | null;
  horizon: HorizonKey;
  rating: string;
  strategy?: string;
  confidence: string;
  risk: string;
  score: number;
  entryPrice: number | null;
  targetPrice?: number | null;
  stopPrice?: number | null;
  factorWeights: Record<string, number>;
  factorBreakdown: Record<string, number>;
  reason: string;
  modelVersion?: string;
}

const EVALUATION_WINDOWS: Record<HorizonKey, { tradingDays?: number; calendarDays?: number }> = {
  swing: { tradingDays: 5 },
  threeMonth: { calendarDays: 30 },
  sixMonth: { calendarDays: 90 },
  oneYear: { calendarDays: 180 },
};

function toPercent(value: number): number {
  return Number((value * 100).toFixed(2));
}

function addTradingDays(start: Date, tradingDays: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < tradingDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return result;
}

function isDueForEvaluation(signal: IntelligenceSignal, now = new Date()): boolean {
  const createdAt = new Date(signal.created_at);
  const window = EVALUATION_WINDOWS[signal.horizon];
  if (!window) return false;

  const dueAt = window.tradingDays
    ? addTradingDays(createdAt, window.tradingDays)
    : new Date(createdAt.getTime() + (window.calendarDays ?? 0) * 24 * 60 * 60 * 1000);

  return now >= dueAt;
}

function resolveOutcomeStatus(outcomeReturn: number): string {
  if (outcomeReturn > 0.01) return "success";
  if (outcomeReturn < -0.01) return "fail";
  return "flat";
}

function calcMaxDrawdown(returns: number[]): number {
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;

  for (const item of returns) {
    equity += item;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return Number(maxDrawdown.toFixed(2));
}

export async function logSignal(signal: LogSignalInput): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("intelligence_signals")
      .insert({
        symbol: signal.symbol,
        sector: signal.sector ?? null,
        horizon: signal.horizon,
        rating: signal.rating,
        strategy: signal.strategy ?? null,
        confidence: signal.confidence,
        risk: signal.risk,
        score: signal.score,
        entry_price: signal.entryPrice,
        target_price: signal.targetPrice ?? null,
        stop_price: signal.stopPrice ?? null,
        factor_weights: signal.factorWeights,
        factor_breakdown: signal.factorBreakdown,
        reason: signal.reason,
        model_version: signal.modelVersion ?? "v1",
      })
      .select("id")
      .single();

    if (error || !data) {
      return null;
    }

    return data.id as string;
  } catch {
    return null;
  }
}

export async function evaluateSignal(signalId: string, currentPrice: number): Promise<IntelligenceSignal | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("intelligence_signals")
      .select("*")
      .eq("id", signalId)
      .maybeSingle();

    if (error || !data) return null;

    const signal = data as IntelligenceSignal;
    if (signal.entry_price == null || currentPrice <= 0) {
      return null;
    }

    const outcomeReturn = (currentPrice - signal.entry_price) / signal.entry_price;
    const outcomeStatus = resolveOutcomeStatus(outcomeReturn);

    await supabase
      .from("intelligence_signals")
      .update({
        evaluated_at: new Date().toISOString(),
        outcome_return: toPercent(outcomeReturn),
        outcome_status: outcomeStatus,
      })
      .eq("id", signal.id);

    await updateWeightsFromOutcome(signal, {
      outcomeReturn: toPercent(outcomeReturn),
      status: outcomeStatus,
    });

    return {
      ...signal,
      evaluated_at: new Date().toISOString(),
      outcome_return: toPercent(outcomeReturn),
      outcome_status: outcomeStatus,
    };
  } catch {
    return null;
  }
}

export async function evaluateDueSignals(priceMap: Record<string, number>): Promise<IntelligenceSignal[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("intelligence_signals")
    .select("*")
    .is("evaluated_at", null);

  if (error || !data) {
    return [];
  }

  const signals = data as IntelligenceSignal[];
  const due = signals.filter((signal) => isDueForEvaluation(signal) && typeof priceMap[signal.symbol] === "number");

  const outcomes = await Promise.all(
    due.map((signal) => evaluateSignal(signal.id, Number(priceMap[signal.symbol])))
  );

  return outcomes.filter((signal): signal is IntelligenceSignal => signal !== null);
}

export async function getSignalHistory(symbol: string, horizon: AnalysisHorizon): Promise<IntelligenceSignal[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("intelligence_signals")
    .select("*")
    .eq("symbol", symbol)
    .eq("horizon", horizon)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    return [];
  }

  return data as IntelligenceSignal[];
}

export async function getPerformanceSummary(filters?: {
  symbol?: string;
  sector?: string;
  horizon?: AnalysisHorizon;
}): Promise<{ sampleSize: number; winRate: number; avgReturn: number; success: number; failure: number }> {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("intelligence_signals")
    .select("outcome_return, outcome_status")
    .not("evaluated_at", "is", null);

  if (filters?.symbol) query = query.eq("symbol", filters.symbol);
  if (filters?.sector) query = query.eq("sector", filters.sector);
  if (filters?.horizon) query = query.eq("horizon", filters.horizon);

  const { data, error } = await query;
  if (error || !data) {
    return { sampleSize: 0, winRate: 0, avgReturn: 0, success: 0, failure: 0 };
  }

  const rows = data as Array<{ outcome_return: number | null; outcome_status: string | null }>;
  const success = rows.filter((row) => row.outcome_status === "success").length;
  const failure = rows.filter((row) => row.outcome_status === "fail").length;
  const avgReturn =
    rows.reduce((sum, row) => sum + (row.outcome_return ?? 0), 0) /
    Math.max(1, rows.length);

  return {
    sampleSize: rows.length,
    winRate: rows.length ? Number(((success / rows.length) * 100).toFixed(2)) : 0,
    avgReturn: Number(avgReturn.toFixed(2)),
    success,
    failure,
  };
}

export async function getModulePerformance(): Promise<ModulePerformance[]> {
  const supabase = getSupabaseServerClient();
  const last30Start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("intelligence_signals")
    .select("horizon, outcome_return, outcome_status, created_at")
    .not("evaluated_at", "is", null);

  if (error || !data) {
    return [];
  }

  const grouped = new Map<HorizonKey, Array<{ outcome_return: number | null; outcome_status: string | null; created_at: string }>>();
  for (const row of data as Array<{ horizon: HorizonKey; outcome_return: number | null; outcome_status: string | null; created_at: string }>) {
    const current = grouped.get(row.horizon) ?? [];
    current.push({
      outcome_return: row.outcome_return,
      outcome_status: row.outcome_status,
      created_at: row.created_at,
    });
    grouped.set(row.horizon, current);
  }

  return (["swing", "threeMonth", "sixMonth", "oneYear"] as HorizonKey[])
    .filter((h) => grouped.has(h))
    .map((horizon) => {
      const group = grouped.get(horizon) ?? [];
      const wins = group.filter((item) => item.outcome_status === "success").length;
      const avgReturn = group.reduce((sum, item) => sum + (item.outcome_return ?? 0), 0) / Math.max(1, group.length);
      const returns = group.map((item) => item.outcome_return ?? 0);
      return {
        moduleName: horizon,
        horizon,
        winRate: group.length ? Number(((wins / group.length) * 100).toFixed(2)) : 0,
        avgReturn: Number(avgReturn.toFixed(2)),
        last30Trades: group.filter((item) => item.created_at >= last30Start).length,
        sampleSize: group.length,
        maxDrawdown: calcMaxDrawdown(returns),
      };
    });
}

export async function getBestSignals(limit = 8): Promise<SignalPerformance[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("intelligence_signals")
    .select("factor_breakdown, outcome_return, outcome_status")
    .not("evaluated_at", "is", null);

  if (error || !data) {
    return [];
  }

  const stats = new Map<string, { wins: number; count: number; sumReturn: number }>();
  for (const row of data as Array<{
    factor_breakdown: Record<string, number> | null;
    outcome_return: number | null;
    outcome_status: string | null;
  }>) {
    const factors = Object.keys(row.factor_breakdown ?? {});
    for (const factor of factors) {
      const current = stats.get(factor) ?? { wins: 0, count: 0, sumReturn: 0 };
      current.count += 1;
      if (row.outcome_status === "success") current.wins += 1;
      current.sumReturn += row.outcome_return ?? 0;
      stats.set(factor, current);
    }
  }

  return [...stats.entries()]
    .filter(([, item]) => item.count >= 5)
    .map(([signal, item]) => ({
      signal,
      winRate: Number(((item.wins / item.count) * 100).toFixed(2)),
      avgReturn: Number((item.sumReturn / item.count).toFixed(2)),
      sampleSize: item.count,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.avgReturn - a.avgReturn)
    .slice(0, limit);
}
