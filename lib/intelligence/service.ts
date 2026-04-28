import { routeAllHorizons, routeAnalysis } from "@/lib/intelligence/router";
import { getBestSignals, getModulePerformance, logSignal } from "@/lib/intelligence/performance";
import { routeExecutionStrategy } from "@/lib/execution/router";
import { logExecutionSignal } from "@/lib/execution/performance";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WATCHLIST_MARKET_CONTEXT_SELECT } from "@/lib/watchlist/dbMapper";
import { WATCHLIST_TABLE, type WatchlistRow } from "@/lib/watchlist/schema";
import type { AnalysisHorizon, IntelligenceApiResponse, IntelligenceSymbolSummary, MarketContextSnapshot } from "@/lib/intelligence/types";

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


function toTenScale(score: number): number {
  if (score <= 10) return Number(score.toFixed(2));
  return Number((score / 10).toFixed(2));
}

function firstNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\\d+(\\.\\d+)?/);
  return match ? Number(match[0]) : null;
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
      .from(WATCHLIST_TABLE)
      .select(WATCHLIST_MARKET_CONTEXT_SELECT)
      .in("symbol", symbols),
    supabase.from("flow_events").select("symbol, score").in("symbol", symbols),
    supabase.from("news_events").select("symbol, sentiment_score").in("symbol", symbols),
  ]);

  const watchRows = (watchlistRes.data ?? []) as Pick<WatchlistRow, "symbol">[];
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
    const sector = resolveSector(row.symbol, null);
    const sectorDefaults = SECTOR_CONTEXT_FALLBACK[sector ?? ""] ?? SECTOR_CONTEXT_FALLBACK.__DEFAULT__;
    const technical = toScore10(sectorDefaults.technical);
    const macro = toScore10(sectorDefaults.macro);
    const political = toScore10(sectorDefaults.political);
    const rsi = 50;
    const volumeRatio = 1;
    const volatility = sectorDefaults.volatility;
    const flowScore = toScore10(avg(flowMap[row.symbol] ?? [], sectorDefaults.flow));
    const newsSentiment = toScore10(avg(newsMap[row.symbol] ?? [], sectorDefaults.news));

    acc[row.symbol] = {
      price: 0,
      rsi,
      volumeRatio,
      technicalScore: technical,
      macroScore: macro,
      politicalScore: political,
      earningsDays: null,
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
    .from(WATCHLIST_TABLE)
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
  const refreshSession = nowIso;

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
            score: toTenScale(analysis.score),
            entryPrice: context.price || null,
            factorWeights,
            factorBreakdown: analysis.factorBreakdown,
            reason: analysis.reason,
            modelVersion: "v1",
          });
        }

        const scoreMap = analyses.reduce<Partial<Record<"swing" | "threeMonth" | "sixMonth" | "oneYear", number>>>(
          (acc, analysis) => {
            acc[analysis.horizon] = toTenScale(analysis.score);
            return acc;
          },
          {}
        );
        const bestAnalysis = [...analyses].sort((a, b) => b.score - a.score)[0];
        const executionPlan = routeExecutionStrategy({
          symbol,
          price: context.price,
          sector: context.sector,
          selectedHorizonScores: scoreMap,
          swingOutput: analyses.find((a) => a.horizon === "swing"),
          threeMonthOutput: analyses.find((a) => a.horizon === "threeMonth"),
          sixMonthOutput: analyses.find((a) => a.horizon === "sixMonth"),
          oneYearOutput: analyses.find((a) => a.horizon === "oneYear"),
          technicalScore: context.technicalScore,
          fundamentalScore: Number(((scoreMap.threeMonth ?? 5) * 0.35 + (scoreMap.sixMonth ?? 5) * 0.3 + (scoreMap.oneYear ?? 5) * 0.35).toFixed(2)),
          sentimentScore: context.newsSentiment,
          environmentScore: Number(((context.macroScore + context.politicalScore) / 2).toFixed(2)),
          momentum: Number((((scoreMap.swing ?? 5) * 0.5 + context.flowScore * 0.5)).toFixed(2)),
          volatilityRisk: Math.max(1, Math.min(10, context.volatility * 3)),
          confidence: bestAnalysis?.confidence ?? "Medium",
          support: context.price * 0.97,
          resistance: context.price * 1.03,
          entryZone: `${(context.price * 0.995).toFixed(2)}-${(context.price * 1.005).toFixed(2)}`,
          stopLoss: `${(context.price * 0.965).toFixed(2)}`,
          targetPrices: [`${(context.price * 1.04).toFixed(2)}`, `${(context.price * 1.08).toFixed(2)}`],
          catalystContext: bestAnalysis?.reason,
          hasVolumeConfirmation: context.volumeRatio >= 1.05,
          belowVWAP: context.price < context.price * (1 + context.trendSlope),
          eventRiskHigh: context.earningsDays != null && context.earningsDays <= 5,
        });

        await logExecutionSignal({
          symbol,
          sector: context.sector ?? null,
          horizon: bestAnalysis?.horizon ?? "swing",
          finalStrategy: executionPlan.finalStrategy,
          sharesScore: executionPlan.sharesPlan.score,
          callsScore: executionPlan.callsPlan.score,
          putsScore: executionPlan.putsPlan.score,
          sharesAction: executionPlan.sharesPlan.suggestedAction,
          callsAction: executionPlan.callsPlan.suggestedAction,
          putsAction: executionPlan.putsPlan.suggestedAction,
          selectedVehicle: executionPlan.selectedVehicle,
          entryPrice: context.price || null,
          stopPrice: firstNumber(executionPlan.sharesPlan.stopPlan),
          targetPrice: firstNumber(executionPlan.callsPlan.entryTrigger) ?? firstNumber(executionPlan.putsPlan.breakdownTrigger),
          confidence: executionPlan.confidence,
          risk: executionPlan.risk,
          reason: executionPlan.reason,
          modelVersion: "execution_v1",
          refreshSession,
        });
      }
      const summary: IntelligenceSymbolSummary = {
        symbol,
        analyses,
        executionStrategy: forceRefresh ? routeExecutionStrategy({
          symbol,
          price: context.price,
          sector: context.sector,
          selectedHorizonScores: analyses.reduce((acc, a) => ({ ...acc, [a.horizon]: toTenScale(a.score) }), {}),
          technicalScore: context.technicalScore,
          fundamentalScore: analyses.reduce((sum, a) => sum + toTenScale(a.score), 0) / Math.max(1, analyses.length),
          sentimentScore: context.newsSentiment,
          environmentScore: (context.macroScore + context.politicalScore) / 2,
          momentum: context.flowScore,
          volatilityRisk: Math.max(1, Math.min(10, context.volatility * 3)),
          confidence: analyses[0]?.confidence ?? "Medium",
        }).finalStrategy : undefined,
        bestHorizon: resolveBestHorizon(analyses),
        updatedAt: nowIso,
      };
      return summary;
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
