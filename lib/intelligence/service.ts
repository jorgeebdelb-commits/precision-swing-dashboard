import { routeAnalysis } from "@/lib/intelligence/router";
import { getBestSignals, getModulePerformance, logSignalRun } from "@/lib/intelligence/performance";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AnalysisHorizon,
  IntelligenceApiResponse,
  IntelligenceSymbolSummary,
  MarketContextSnapshot,
} from "@/lib/intelligence/types";

interface WatchlistRow {
  symbol: string;
  technicalScore: number | null;
  macroScore: number | null;
  politicalScore: number | null;
  rsi: number | null;
  volumeRatio: number | null;
  priceVolatility: number | null;
  earningsDays: number | null;
  price: number | null;
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
  payload: IntelligenceApiResponse;
  generated_at: string;
}

function n(value: number | null | undefined, fallback: number): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return Number(value);
}

function avg(values: number[]): number {
  if (!values.length) return 5.8;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toScore10(value: number): number {
  if (value > 10) {
    return Math.max(1, Math.min(10, Number((value / 10).toFixed(2))));
  }
  return Math.max(1, Math.min(10, Number(value.toFixed(2))));
}

function resolveBestHorizon(analyses: IntelligenceSymbolSummary["analyses"]): AnalysisHorizon {
  const top = [...analyses].sort((a, b) => b.score - a.score)[0];
  return top?.horizon ?? "Short-Term";
}

async function getCachedDashboard(cacheKey: string): Promise<IntelligenceApiResponse | null> {
  const supabase = getSupabaseServerClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("intelligence_cache")
    .select("symbol, payload, generated_at")
    .eq("symbol", cacheKey)
    .gte("generated_at", oneHourAgo)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as CacheRow;
  return {
    ...row.payload,
    generatedAt: row.generated_at,
    source: "cache",
  };
}

async function persistDashboard(cacheKey: string, payload: IntelligenceApiResponse): Promise<void> {
  const supabase = getSupabaseServerClient();
  const generatedAt = payload.generatedAt;

  await supabase.from("intelligence_cache").upsert(
    {
      symbol: cacheKey,
      payload,
      generated_at: generatedAt,
      updated_at: generatedAt,
    },
    { onConflict: "symbol" }
  );
}

async function buildMarketContext(symbols: string[]): Promise<Record<string, MarketContextSnapshot>> {
  const supabase = getSupabaseServerClient();

  const [watchlistRes, flowRes, newsRes] = await Promise.all([
    supabase
      .from("watchlist")
      .select(
        "symbol, technicalScore, macroScore, politicalScore, rsi, volumeRatio, priceVolatility, earningsDays, price"
      )
      .in("symbol", symbols),
    supabase.from("flow_events").select("symbol, score").in("symbol", symbols),
    supabase.from("news_events").select("symbol, sentiment_score").in("symbol", symbols),
  ]);

  const watchRows = (watchlistRes.data ?? []) as WatchlistRow[];
  const flowRows = (flowRes.data ?? []) as FlowEventRow[];
  const newsRows = (newsRes.data ?? []) as NewsEventRow[];

  const flowMap = flowRows.reduce<Record<string, number[]>>((acc, row) => {
    if (!acc[row.symbol]) {
      acc[row.symbol] = [];
    }
    if (row.score != null) {
      acc[row.symbol].push(Number(row.score));
    }
    return acc;
  }, {});

  const newsMap = newsRows.reduce<Record<string, number[]>>((acc, row) => {
    if (!acc[row.symbol]) {
      acc[row.symbol] = [];
    }
    if (row.sentiment_score != null) {
      acc[row.symbol].push(Number(row.sentiment_score));
    }
    return acc;
  }, {});

  return watchRows.reduce<Record<string, MarketContextSnapshot>>((acc, row) => {
    const technical = toScore10(n(row.technicalScore, 62));
    const macro = toScore10(n(row.macroScore, 61));
    const political = toScore10(n(row.politicalScore, 59));
    const rsi = n(row.rsi, 50);
    const volumeRatio = n(row.volumeRatio, 1);
    const volatility = n(row.priceVolatility, 1.8);
    const flowScore = toScore10(avg(flowMap[row.symbol] ?? []));
    const newsSentiment = toScore10(avg(newsMap[row.symbol] ?? []));

    acc[row.symbol] = {
      price: n(row.price, 0),
      rsi,
      volumeRatio,
      technicalScore: technical,
      macroScore: macro,
      politicalScore: political,
      earningsDays: row.earningsDays == null ? null : Number(row.earningsDays),
      newsSentiment,
      flowScore,
      volatility,
      trendSlope: Number(((technical - 5) / 30).toFixed(4)),
    };

    return acc;
  }, {});
}

export async function getWatchlistSymbols(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("watchlist")
    .select("symbol")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row: { symbol: string }) => row.symbol).filter(Boolean);
}

export async function getIntelligence(
  symbols: string[],
  forceRefresh = false,
  horizon?: string
): Promise<IntelligenceApiResponse> {
  if (!symbols.length) {
    return {
      items: [],
      performance: [],
      bestSignals: [],
      generatedAt: new Date().toISOString(),
      source: "fresh",
    };
  }

  const cacheKey = `${symbols.sort().join(",")}::${(horizon ?? "all").toLowerCase()}`;

  if (!forceRefresh) {
    const cached = await getCachedDashboard(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const marketContext = await buildMarketContext(symbols);
  const nowIso = new Date().toISOString();

  const items = await Promise.all(
    symbols.map(async (symbol) => {
      const context = marketContext[symbol];
      if (!context) {
        return null;
      }

      const runs = await routeAnalysis(symbol, horizon, {
        context: { symbol, market: context },
        nowIso,
      });

      for (const run of runs) {
        await logSignalRun({
          symbol,
          horizon: run.result.horizon,
          moduleName: run.moduleName,
          recommendation: run.result.recommendation,
          score: run.result.score,
          triggeredSignals: run.result.triggeredSignals,
          marketContext: context,
        });
      }

      const analyses = runs.map((run) => run.result);
      return {
        symbol,
        analyses,
        bestHorizon: resolveBestHorizon(analyses),
        updatedAt: nowIso,
      } satisfies IntelligenceSymbolSummary;
    })
  );

  const cleanItems = items.filter((item): item is IntelligenceSymbolSummary => item !== null);
  const [performance, bestSignals] = await Promise.all([getModulePerformance(), getBestSignals()]);

  const payload: IntelligenceApiResponse = {
    items: cleanItems,
    performance,
    bestSignals,
    generatedAt: nowIso,
    source: "fresh",
  };

  await persistDashboard(cacheKey, payload);

  return payload;
}
