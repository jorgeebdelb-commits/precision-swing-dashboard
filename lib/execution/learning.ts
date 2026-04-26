import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ExecutionSignalRecord, ExecutionWeightState } from "@/lib/execution/types";

const DEFAULT_WEIGHTS: ExecutionWeightState = { sharesWeight: 0.5, callsWeight: 0.3, putsWeight: 0.2 };

function clampWeight(value: number): number {
  return Math.max(0.1, Math.min(0.8, Number(value.toFixed(6))));
}

function normalize(weights: ExecutionWeightState): ExecutionWeightState {
  const total = weights.sharesWeight + weights.callsWeight + weights.putsWeight;
  return {
    sharesWeight: Number((weights.sharesWeight / total).toFixed(6)),
    callsWeight: Number((weights.callsWeight / total).toFixed(6)),
    putsWeight: Number((weights.putsWeight / total).toFixed(6)),
  };
}

export async function getExecutionWeights(symbol: string, sector?: string): Promise<ExecutionWeightState> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("execution_adaptive_weights")
      .select("weights")
      .eq("symbol", symbol)
      .eq("sector", sector ?? "")
      .limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row?.weights) return DEFAULT_WEIGHTS;

    return { ...DEFAULT_WEIGHTS, ...(row.weights as Partial<ExecutionWeightState>) };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export async function saveExecutionWeights(symbol: string, sector: string | undefined, weights: ExecutionWeightState): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("execution_adaptive_weights").upsert(
      {
        symbol,
        sector: sector ?? "",
        weights: normalize(weights),
        model_version: "execution_v1",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "symbol,sector" }
    );
  } catch {
    // no-op
  }
}

export async function updateExecutionWeightsFromOutcome(
  signal: ExecutionSignalRecord,
  outcome: { outcomeReturn: number | null; status: string | null }
): Promise<void> {
  if (outcome.outcomeReturn == null || !outcome.status) return;

  const current = await getExecutionWeights(signal.symbol, signal.sector ?? undefined);
  const direction = outcome.outcomeReturn > 0 ? 1 : -1;
  const adjustment = Math.min(0.04, Math.max(0.01, Math.abs(outcome.outcomeReturn) / 250));

  const next: ExecutionWeightState = { ...current };
  if (signal.selectedVehicle === "shares") next.sharesWeight = clampWeight(next.sharesWeight + direction * adjustment);
  if (signal.selectedVehicle === "calls") next.callsWeight = clampWeight(next.callsWeight + direction * adjustment);
  if (signal.selectedVehicle === "puts") next.putsWeight = clampWeight(next.putsWeight + direction * adjustment);

  await saveExecutionWeights(signal.symbol, signal.sector ?? undefined, normalize(next));
}
