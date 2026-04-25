import { getSectorFactorWeights } from "@/lib/intelligence/sectors";
import type { FactorWeight, HorizonKey } from "@/lib/intelligence/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const FALLBACK_MODEL_VERSION = "v1";

interface AdaptiveWeightRow {
  symbol: string;
  sector: string | null;
  horizon: HorizonKey;
  weights: Record<string, number>;
  model_version: string;
  updated_at: string;
}

function normalizeToOne(weights: FactorWeight[]): FactorWeight[] {
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

function mapToWeights(base: FactorWeight[], overrides: Record<string, number> | null | undefined): FactorWeight[] {
  if (!overrides) {
    return normalizeToOne(base);
  }

  const merged = base.map((item) => ({
    factor: item.factor,
    weight: typeof overrides[item.factor] === "number" ? Number(overrides[item.factor]) : item.weight,
  }));

  return normalizeToOne(merged);
}

export function getDefaultWeights(sector: string | null | undefined, horizon: HorizonKey): FactorWeight[] {
  return normalizeToOne(getSectorFactorWeights(horizon, sector ?? undefined));
}

export async function getAdaptiveWeights(
  symbol: string,
  sector: string | null | undefined,
  horizon: HorizonKey
): Promise<FactorWeight[]> {
  const supabase = getSupabaseServerClient();

  const base = getDefaultWeights(sector, horizon);

  const { data, error } = await supabase
    .from("intelligence_adaptive_weights")
    .select("symbol, sector, horizon, weights, model_version, updated_at")
    .eq("symbol", symbol)
    .eq("horizon", horizon)
    .maybeSingle();

  if (error || !data) {
    return base;
  }

  const row = data as AdaptiveWeightRow;
  return mapToWeights(base, row.weights);
}

export async function saveAdaptiveWeights(
  symbol: string,
  sector: string | null | undefined,
  horizon: HorizonKey,
  weights: Record<string, number>,
  modelVersion = FALLBACK_MODEL_VERSION
): Promise<void> {
  const supabase = getSupabaseServerClient();

  await supabase.from("intelligence_adaptive_weights").upsert(
    {
      symbol,
      sector: sector ?? null,
      horizon,
      weights,
      model_version: modelVersion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "symbol,horizon" }
  );
}
