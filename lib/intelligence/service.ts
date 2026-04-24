import { scoreSymbolIntelligence } from "@/lib/scoring";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  IntelligenceApiResponse,
  IntelligenceFactors,
  IntelligenceScoreResult,
} from "@/types/intelligence";

interface WatchlistRow {
  symbol: string;
  technicalScore: number | null;
  macroScore: number | null;
  politicalScore: number | null;
}

interface FlowEventRow {
  symbol: string;
  score: number | null;
}

interface NewsEventRow {
  symbol: string;
  sentiment_score: number | null;
}

interface CacheRow {
  symbol: string;
  payload: IntelligenceScoreResult;
  generated_at: string;
}

function toBase10Score(value: number | null | undefined, fallback: number): number {
  if (value == null || Number.isNaN(value)) {
    return fallback;
  }

  const from100 = value > 10 ? value / 10 : value;
  return Math.min(10, Math.max(1, Number(from100.toFixed(2))));
}

function average(values: number[]): number {
  if (!values.length) {
    return 5.5;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function getCachedScores(symbols: string[]): Promise<IntelligenceScoreResult[]> {
  const supabase = getSupabaseServerClient();
  const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("intelligence_cache")
    .select("symbol, payload, generated_at")
    .in("symbol", symbols)
    .gte("generated_at", oneHourAgoIso);

  if (error || !data) {
    return [];
  }

  return (data as CacheRow[]).map((row) => ({
    ...row.payload,
    generatedAt: row.generated_at,
  }));
}

async function buildFactors(symbols: string[]): Promise<IntelligenceFactors[]> {
  const supabase = getSupabaseServerClient();

  const [watchlistRes, flowRes, newsRes] = await Promise.all([
    supabase
      .from("watchlist")
      .select("symbol, technicalScore, macroScore, politicalScore")
      .in("symbol", symbols),
    supabase.from("flow_events").select("symbol, score").in("symbol", symbols),
    supabase
      .from("news_events")
      .select("symbol, sentiment_score")
      .in("symbol", symbols),
  ]);

  const watchRows = ((watchlistRes.data ?? []) as WatchlistRow[]).reduce<
    Record<string, WatchlistRow>
  >((acc, row) => {
    acc[row.symbol] = row;
    return acc;
  }, {});

  const flowRows = (flowRes.data ?? []) as FlowEventRow[];
  const flowMap = flowRows.reduce<Record<string, number[]>>((acc, row) => {
    if (!acc[row.symbol]) {
      acc[row.symbol] = [];
    }

    if (row.score != null) {
      acc[row.symbol].push(Number(row.score));
    }

    return acc;
  }, {});

  const newsRows = (newsRes.data ?? []) as NewsEventRow[];
  const newsMap = newsRows.reduce<Record<string, number[]>>((acc, row) => {
    if (!acc[row.symbol]) {
      acc[row.symbol] = [];
    }

    if (row.sentiment_score != null) {
      acc[row.symbol].push(Number(row.sentiment_score));
    }

    return acc;
  }, {});

  return symbols.map((symbol) => {
    const watch = watchRows[symbol];

    return {
      symbol,
      technical: toBase10Score(watch?.technicalScore, 6),
      fundamentals: toBase10Score(watch?.macroScore, 6.1),
      flow: toBase10Score(average(flowMap[symbol] ?? []), 5.8),
      news: toBase10Score(average(newsMap[symbol] ?? []), 5.7),
      macro: toBase10Score(watch?.macroScore, 6),
      crowd: toBase10Score(watch?.politicalScore, 5.9),
    };
  });
}

async function persistScores(scores: IntelligenceScoreResult[]): Promise<void> {
  if (!scores.length) {
    return;
  }

  const supabase = getSupabaseServerClient();

  await supabase.from("intelligence_scores").upsert(
    scores.map((score) => ({
      symbol: score.symbol,
      generated_at: score.generatedAt,
      overall_score: score.overallScore,
      technical_score: score.baseScores.technical,
      fundamentals_score: score.baseScores.fundamentals,
      flow_score: score.baseScores.flow,
      news_score: score.baseScores.news,
      macro_score: score.baseScores.macro,
      crowd_score: score.baseScores.crowd,
      swing_score: score.horizonScores.swing,
      three_month_score: score.horizonScores.threeMonth,
      six_month_score: score.horizonScores.sixMonth,
      one_year_score: score.horizonScores.oneYear,
      label: score.label,
      best_strategy: score.bestStrategy,
      confidence_pct: score.confidencePct,
      risk_level: score.riskLevel,
      updated_at: score.generatedAt,
    })),
    { onConflict: "symbol" }
  );

  await supabase.from("intelligence_cache").upsert(
    scores.map((score) => ({
      symbol: score.symbol,
      payload: score,
      generated_at: score.generatedAt,
      updated_at: score.generatedAt,
    })),
    { onConflict: "symbol" }
  );

  await supabase.from("scoring_runs").insert({
    symbols: scores.map((score) => score.symbol),
    result_count: scores.length,
    run_type: "refresh",
    status: "success",
    completed_at: new Date().toISOString(),
  });
}

export async function getWatchlistSymbols(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("watchlist")
    .select("symbol")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row: { symbol: string }) => row.symbol);
}

export async function getIntelligence(
  symbols: string[],
  forceRefresh = false
): Promise<IntelligenceApiResponse> {
  if (!symbols.length) {
    return {
      items: [],
      generatedAt: new Date().toISOString(),
      source: "fresh",
    };
  }

  if (!forceRefresh) {
    const cachedItems = await getCachedScores(symbols);

    if (cachedItems.length === symbols.length) {
      return {
        items: cachedItems,
        generatedAt: new Date().toISOString(),
        source: "cache",
      };
    }
  }

  const generatedAt = new Date().toISOString();
  const factors = await buildFactors(symbols);
  const scored = factors.map((factor) => scoreSymbolIntelligence(factor, generatedAt));

  await persistScores(scored);

  return {
    items: scored,
    generatedAt,
    source: "fresh",
  };
}
