import { routeAllHorizons, routeAnalysis } from "@/lib/intelligence/router";
import { getBestSignals, getModulePerformance, logSignal } from "@/lib/intelligence/performance";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalysisHorizon, IntelligenceApiResponse, IntelligenceSymbolSummary, MarketContextSnapshot } from "@/lib/intelligence/types";

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
  sector: string | null;
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

function avg(values: number[], fallback: number): number {
  if (!values.length) return fallback;
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
  return top?.horizon ?? "swing";
}

const SYMBOL_SECTOR_FALLBACK: Record<string, string> = {
  NVDA: "Semiconductors",
  AMD: "Semiconductors",
  AMZN: "Consumer",
  TSLA: "EV",
  MP: "Materials",
  MARA: "Crypto Mining",
  RIOT: "Crypto Mining",
  KEEL: "Defense",
};

const SECTOR_CONTEXT_FALLBACK: Record<
  string,
  { technical: number; macro: number; political: number; flow: number; news: number; volatility: number }
> = {
  Semiconductors: { technical: 66, macro: 67, political: 56, flow: 6.8, news: 6.7, volatility: 1.9 },
  Energy: { technical: 59, macro: 63, political: 62, flow: 6.1, news: 6.0, volatility: 2.1 },
  EV: { technical: 58, macro: 57, political: 60, flow: 6.0, news: 5.8, volatility: 2.4 },
  Defense: { technical: 61, macro: 64, political: 70, flow: 6.2, news: 6.1, volatility: 1.7 },
  Biotech: { technical: 54, macro: 55, political: 58, flow: 5.6, news: 5.5, volatility: 2.6 },
  "Crypto Mining": { technical: 57, macro: 54, political: 63, flow: 6.5, news: 6.2, volatility: 3.1 },
  Consumer: { technical: 60, macro: 62, political: 57, flow: 6.0, news: 6.1, volatility: 1.8 },
  Materials: { technical: 58, macro: 60, political: 58, flow: 5.7, news: 5.8, volatility: 2.1 },
  __DEFAULT__: { technical: 61, macro: 61, political: 59, flow: 5.9, news: 5.9, volatility: 1.9 },
};

function resolveSector(symbol: string, rawSector: string | null): string | undefined {
  if (rawSector && rawSector.trim()) return rawSector.trim();
  return SYMBOL_SECTOR_FALLBACK[symbol.toUpperCase()];
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
        "symbol, technicalScore, macroScore, politicalScore, rsi, volumeRatio, priceVolatility, earningsDays, price, sector"
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
    const sector = resolveSector(row.symbol, row.sector);
    const sectorDefaults = SECTOR_CONTEXT_FALLBACK[sector ?? ""] ?? SECTOR_CONTEXT_FALLBACK.__DEFAULT__;
    const technical = toScore10(n(row.technicalScore, sectorDefaults.technical));
    const macro = toScore10(n(row.macroScore, sectorDefaults.macro));
    const political = toScore10(n(row.politicalScore, sectorDefaults.political));
    const rsi = n(row.rsi, 50);
    const volumeRatio = n(row.volumeRatio, 1);
    const volatility = n(row.priceVolatility, sectorDefaults.volatility);
    const flowScore = toScore10(avg(flowMap[row.symbol] ?? [], sectorDefaults.flow));
    const newsSentiment = toScore10(avg(newsMap[row.symbol] ?? [], sectorDefaults.news));

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
      sector,
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

      const analyses = horizon
        ? [await routeAnalysis(symbol, horizon, context)]
        : await routeAllHorizons(symbol, context);

      if (forceRefresh) {
        const loggedInSession = new Set<string>();
        for (const analysis of analyses) {
          const dedupeKey = `${symbol}::${analysis.horizon}`;
          if (loggedInSession.has(dedupeKey)) continue;
          loggedInSession.add(dedupeKey);

          const factorWeights = analysis.factorWeights.reduce<Record<string, number>>((acc, item) => {
            acc[item.factor] = item.weight;
            return acc;
          }, {});

          await logSignal({
            symbol,
            sector: context.sector ?? null,
            horizon: analysis.horizon,
            rating: analysis.rating,
            strategy: analysis.strategy,
            confidence: analysis.confidence,
            risk: analysis.risk,
            score: analysis.score,
            entryPrice: context.price || null,
            factorWeights,
            factorBreakdown: analysis.factorBreakdown,
            reason: analysis.reason,
            modelVersion: "v1",
          });
        }
      }
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
