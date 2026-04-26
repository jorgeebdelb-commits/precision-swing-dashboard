import { updateExecutionWeightsFromOutcome } from "@/lib/execution/learning";
import type { ExecutionSignalRecord } from "@/lib/execution/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function resolveOutcomeStatus(outcomeReturn: number): string {
  if (outcomeReturn > 1) return "success";
  if (outcomeReturn < -1) return "fail";
  return "flat";
}

export async function logExecutionSignal(signal: ExecutionSignalRecord): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();

    if (signal.refreshSession) {
      const { data: existing } = await supabase
        .from("execution_signals")
        .select("id")
        .eq("symbol", signal.symbol)
        .eq("refresh_session", signal.refreshSession)
        .limit(1)
        .maybeSingle();
      if (existing?.id) return existing.id as string;
    }

    const { data, error } = await supabase
      .from("execution_signals")
      .insert({
        symbol: signal.symbol,
        sector: signal.sector ?? null,
        horizon: signal.horizon,
        final_strategy: signal.finalStrategy,
        shares_score: signal.sharesScore,
        calls_score: signal.callsScore,
        puts_score: signal.putsScore,
        shares_action: signal.sharesAction,
        calls_action: signal.callsAction,
        puts_action: signal.putsAction,
        selected_vehicle: signal.selectedVehicle,
        entry_price: signal.entryPrice,
        stop_price: signal.stopPrice,
        target_price: signal.targetPrice,
        confidence: signal.confidence,
        risk: signal.risk,
        reason: signal.reason,
        refresh_session: signal.refreshSession ?? null,
        model_version: signal.modelVersion ?? "execution_v1",
      })
      .select("id")
      .single();

    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

export async function evaluateExecutionSignal(signalId: string, currentPrice: number): Promise<ExecutionSignalRecord | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("execution_signals").select("*").eq("id", signalId).maybeSingle();
    if (error || !data || data.entry_price == null || currentPrice <= 0) return null;

    const outcomeReturn = Number((((currentPrice - Number(data.entry_price)) / Number(data.entry_price)) * 100).toFixed(2));
    const outcomeStatus = resolveOutcomeStatus(outcomeReturn);

    await supabase
      .from("execution_signals")
      .update({ evaluated_at: new Date().toISOString(), outcome_return: outcomeReturn, outcome_status: outcomeStatus })
      .eq("id", signalId);

    await updateExecutionWeightsFromOutcome(
      {
        symbol: data.symbol,
        finalStrategy: data.final_strategy,
        horizon: data.horizon,
        sharesScore: Number(data.shares_score ?? 0),
        callsScore: Number(data.calls_score ?? 0),
        putsScore: Number(data.puts_score ?? 0),
        sharesAction: data.shares_action,
        callsAction: data.calls_action,
        putsAction: data.puts_action,
        selectedVehicle: data.selected_vehicle,
        entryPrice: Number(data.entry_price ?? 0),
        stopPrice: Number(data.stop_price ?? 0),
        targetPrice: Number(data.target_price ?? 0),
        confidence: data.confidence,
        risk: data.risk,
        reason: data.reason,
        sector: data.sector,
      },
      { outcomeReturn, status: outcomeStatus }
    );

    return {
      id: data.id,
      symbol: data.symbol,
      horizon: data.horizon,
      finalStrategy: data.final_strategy,
      sharesScore: Number(data.shares_score ?? 0),
      callsScore: Number(data.calls_score ?? 0),
      putsScore: Number(data.puts_score ?? 0),
      sharesAction: data.shares_action,
      callsAction: data.calls_action,
      putsAction: data.puts_action,
      selectedVehicle: data.selected_vehicle,
      entryPrice: Number(data.entry_price ?? 0),
      stopPrice: Number(data.stop_price ?? 0),
      targetPrice: Number(data.target_price ?? 0),
      confidence: data.confidence,
      risk: data.risk,
      reason: data.reason,
      createdAt: data.created_at,
      evaluatedAt: new Date().toISOString(),
      outcomeReturn,
      outcomeStatus,
      sector: data.sector,
    };
  } catch {
    return null;
  }
}

export async function evaluateDueExecutionSignals(priceMap: Record<string, number>): Promise<ExecutionSignalRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("execution_signals").select("id, symbol").is("evaluated_at", null);
  if (error || !data) return [];

  const due = data.filter((s: { symbol: string }) => typeof priceMap[s.symbol] === "number");
  const outcomes = await Promise.all(due.map((s: { id: string; symbol: string }) => evaluateExecutionSignal(s.id, priceMap[s.symbol])));
  return outcomes.filter((item): item is ExecutionSignalRecord => item !== null);
}

export async function getExecutionHistory(symbol: string): Promise<ExecutionSignalRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("execution_signals").select("*").eq("symbol", symbol).order("created_at", { ascending: false }).limit(200);
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    symbol: String(row.symbol),
    horizon: String(row.horizon),
    finalStrategy: String(row.final_strategy),
    sharesScore: Number(row.shares_score ?? 0),
    callsScore: Number(row.calls_score ?? 0),
    putsScore: Number(row.puts_score ?? 0),
    sharesAction: String(row.shares_action ?? ""),
    callsAction: String(row.calls_action ?? ""),
    putsAction: String(row.puts_action ?? ""),
    selectedVehicle: String(row.selected_vehicle ?? ""),
    entryPrice: Number(row.entry_price ?? 0),
    stopPrice: Number(row.stop_price ?? 0),
    targetPrice: Number(row.target_price ?? 0),
    confidence: String(row.confidence ?? ""),
    risk: String(row.risk ?? ""),
    reason: String(row.reason ?? ""),
    createdAt: String(row.created_at ?? ""),
    evaluatedAt: row.evaluated_at ? String(row.evaluated_at) : null,
    outcomeReturn: row.outcome_return == null ? null : Number(row.outcome_return),
    outcomeStatus: row.outcome_status == null ? null : String(row.outcome_status),
    sector: row.sector ? String(row.sector) : null,
  }));
}

export async function getExecutionSummary(symbol?: string, sector?: string): Promise<{ sampleSize: number; winRate: number; avgReturn: number }> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("execution_signals").select("outcome_return, outcome_status").not("evaluated_at", "is", null);
  if (symbol) query = query.eq("symbol", symbol);
  if (sector) query = query.eq("sector", sector);

  const { data, error } = await query;
  if (error || !data) return { sampleSize: 0, winRate: 0, avgReturn: 0 };

  const rows = data as Array<{ outcome_return: number | null; outcome_status: string | null }>;
  const wins = rows.filter((r) => r.outcome_status === "success").length;
  const avg = rows.reduce((sum, row) => sum + Number(row.outcome_return ?? 0), 0) / Math.max(1, rows.length);

  return {
    sampleSize: rows.length,
    winRate: rows.length ? Number(((wins / rows.length) * 100).toFixed(2)) : 0,
    avgReturn: Number(avg.toFixed(2)),
  };
}
