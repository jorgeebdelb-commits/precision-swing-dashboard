import { normalizeSymbolInput, type NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";
import { routeBattlefield } from "@/lib/intelligence/router/battlefieldRouter";
import { getLiveQuote } from "@/lib/market/liveQuote";
import { createFallbackSnapshot } from "@/lib/market/fallbackSnapshot";
import type { BattlefieldApiResponse } from "@/lib/intelligence/types/battlefield";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WATCHLIST_TABLE } from "@/lib/watchlist/schema";

export async function getWatchlistSymbols(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from(WATCHLIST_TABLE).select("symbol").order("created_at", { ascending: true });
  const symbols = (data ?? []).map((row: { symbol: string }) => row.symbol).filter(Boolean);
  console.log("[watchlist] symbols from db:", symbols);
  return symbols;
}

async function buildInput(symbol: string): Promise<NormalizedSymbolInput> {
  try {
    const live = await getLiveQuote(symbol);
    const price = typeof live.price === "number" && live.price > 0 ? live.price : 0;
    const spread = typeof live.bid === "number" && typeof live.ask === "number" ? Math.max(0, live.ask - live.bid) : Math.max(price * 0.003, 0.01);
    const support = Math.max(0.01, price - Math.max(spread * 4, price * 0.015));
    const resistance = price + Math.max(spread * 4, price * 0.015);

    if (live.unavailable || live.price == null || live.price <= 0) {
      console.warn("[LIVE SNAPSHOT] using stale cached market data", symbol, live.unavailableReason);
    }

    return normalizeSymbolInput({
      symbol,
      price,
      priceTimestamp: live.timestamp ?? null,
      marketDataState: live.price != null && live.price > 0 ? (live.stale ? "cached" : "live") : "offline",
      staleData: live.stale || live.price == null || live.price <= 0,
      quoteProvider: live.provider,
      lastQuoteSuccessAt: live.lastSuccessAt ?? null,
      lastQuoteError: live.lastError ?? live.unavailableReason ?? null,
      support,
      resistance,
      lr50: price,
      lr100: price,
      vwap: price,
      rsi: 50,
      atrPercent: price > 0 ? (Math.max(0.01, resistance - support) / price) * 100 : 0,
      volumeRatio: 1,
      volume: live.volume ?? 0,
      technicalScore: 0,
      fundamentalsScore: 0,
      macroScore: 0,
      politicalScore: 0,
      sentimentScore: 0,
      flowScore: 0,
    });
  } catch (error) {
    const fallback = createFallbackSnapshot({ symbol, session: "closed", reason: "buildInput failed" });
    console.error("[LIVE SNAPSHOT] buildInput failed", symbol, error, fallback);
    const price = 0;
    return normalizeSymbolInput({
      symbol,
      price,
      priceTimestamp: fallback.timestamp ?? null,
      marketDataState: "offline",
      staleData: true,
      support: 0.01,
      resistance: 0.02,
      lr50: price,
      lr100: price,
      vwap: price,
      rsi: 50,
      atrPercent: 3,
      volumeRatio: 1,
      volume: 0,
      technicalScore: 0,
      fundamentalsScore: 0,
      macroScore: 0,
      politicalScore: 0,
      sentimentScore: 0,
      flowScore: 0,
    });
  }
}

export interface GetIntelligenceConfig {
  symbols: string[];
  force?: boolean;
  horizon?: string;
}

export async function getIntelligence({ symbols }: GetIntelligenceConfig): Promise<BattlefieldApiResponse> {
  console.log("[intelligence] symbols entering getIntelligence:", symbols);
  const settled = await Promise.allSettled(symbols.map((symbol) => buildInput(symbol.toUpperCase())));
  const inputs = settled
    .filter((item): item is PromiseFulfilledResult<NormalizedSymbolInput> => item.status === "fulfilled")
    .map((item) => item.value);
  const items = inputs.map((input) => routeBattlefield(input));
  console.log(
    "[intelligence] battlefield results:",
    items.map((item) => ({
      symbol: item.symbol,
      primaryOpportunity: item.primaryOpportunity,
      deployment: item.deployment.bestDeployment,
    }))
  );
  return {
    items,
    generatedAt: new Date().toISOString(),
    source: "fresh",
  };
}
